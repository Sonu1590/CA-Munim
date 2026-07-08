import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// The recurrence engine: "your Add Client modal collects Services
// Subscribed and then does nothing with it" (PM review, 2026-07-06).
// Runs daily, well before send-task-reminders, so a newly-generated task
// already has lead time before that scan's 3-day window.
//
// Deliberately excludes: ROC forms that need an AGM date to compute a due
// date (MGT-7, AOC-4, ADT-1 — clients.agm_due_month is a column but nothing
// in the UI sets it yet), and event-based/one-time services (Company
// Incorporation, IEC, MSME Registration, INC-20A, PAS-3). Also defaults
// every GST client to monthly cadence — clients.gst_filing_freq exists but
// nothing populates it either, same gap as QRMP flagged in the H6 P2 work.

const MONTHS = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"]

function calendarMonthToName(calMonth: number): string {
  const idx = calMonth >= 4 ? calMonth - 4 : calMonth + 8
  return MONTHS[idx]
}

// Recurring filings driven by the services_subscribed checklist.
const SERVICE_TASK_MAP: Record<string, { taskTypes: string[]; cadence: "monthly" | "quarterly" | "annual" }> = {
  "ITR Filing (Annual)": { taskTypes: ["ITR Filing"], cadence: "annual" },
  "GST Returns (Monthly / Quarterly)": { taskTypes: ["GSTR-1", "GSTR-3B"], cadence: "monthly" },
  "TDS Returns (Quarterly)": { taskTypes: ["24Q"], cadence: "quarterly" },
  "Bookkeeping": { taskTypes: ["Bookkeeping"], cadence: "monthly" },
  "Tax Audit (u/s 44AB)": { taskTypes: ["Tax Audit"], cadence: "annual" },
  "GST Annual Return (GSTR-9)": { taskTypes: ["GSTR-9"], cadence: "annual" },
}

// mca_filings is a separate multi-select (MGT-7/AOC-4/DIR-3 KYC/ADT-1/
// INC-20A/PAS-3) — only DIR-3 KYC has a due date computable from the FY
// alone, so it's the only one auto-generated here.
const RECURRING_MCA_FILINGS = new Set(["DIR-3 KYC"])

// Maps a TaskType to compliance_rules.filing_type — mirrors
// BulkTaskGenerator.tsx's FILING_TYPE_MAP (duplicated; Deno edge functions
// can't share a module with the Vite frontend).
const FILING_TYPE_MAP: Record<string, string> = {
  "GSTR-1": "GSTR-1_MONTHLY",
  "GSTR-3B": "GSTR-3B_MONTHLY_ABOVE5CR",
  "GSTR-9": "GSTR-9",
  "GSTR-4": "GSTR-4",
  "24Q": "TDS_RETURN_24Q_26Q",
  "ITR Filing": "ITR_NON_AUDIT",
  "Tax Audit": "TAX_AUDIT",
  "DIR-3 KYC": "DIR-3 KYC",
}

const pad = (n: number) => String(n).padStart(2, "0")

// Condensed port of computeDueDate from src/data/ComplianceRules.ts — same
// duplication tradeoff as FILING_TYPE_MAP above.
function computeDueDate(rule: any, fyStartYear: number, period?: { month: number; year: number }): string | null {
  const r = rule.due_date_rule
  if (!r) return null

  if (r.type === "fixed_date") {
    const yearOffset = r.year_offset ?? (rule.period_type === "annual" ? 1 : r.month <= 3 ? 1 : 0)
    const year = fyStartYear + yearOffset
    return `${year}-${pad(r.month)}-${pad(r.day)}`
  }

  if (!period) return null
  if (period.month === 3 && r.march_exception) {
    return `${period.year}-${pad(r.march_exception.month)}-${pad(r.march_exception.day)}`
  }
  if (period.month === 3 && r.q4_exception) {
    return `${period.year}-${pad(r.q4_exception.month)}-${pad(r.q4_exception.day)}`
  }
  let month = period.month + r.month_offset
  let year = period.year
  if (month > 12) { month -= 12; year += 1 }
  return `${year}-${pad(month)}-${pad(r.day)}`
}

function selectRuleForFY(rules: any[], filingType: string, fyStartYear: number): any {
  const candidates = rules.filter((r) => r.filing_type === filingType)
  if (candidates.length <= 1) return candidates[0]
  return candidates.find((r) => {
    const min = r.due_date_rule?.min_fy_start_year
    const max = r.due_date_rule?.max_fy_start_year
    if (min != null && fyStartYear < min) return false
    if (max != null && fyStartYear > max) return false
    return true
  }) ?? candidates[0]
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date()
  const calMonth = today.getMonth() + 1 // 1-12
  const calYear = today.getFullYear()
  const fyStartYear = calMonth >= 4 ? calYear : calYear - 1
  const financialYear = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`

  const monthlyPeriod = { month: calMonth, year: calYear }
  const quarterEndMonth = calMonth <= 6 ? 6 : calMonth <= 9 ? 9 : calMonth <= 12 ? 12 : 3
  // Jan-Mar (calMonth 1-3) is the Oct-Dec quarter's continuation only for
  // billing display; the actual quarter ending March is calMonth 1-3 itself.
  const quarterlyPeriod = calMonth <= 3
    ? { month: 3, year: calYear }
    : { month: quarterEndMonth, year: calYear }
  const completedFYStart = fyStartYear - 1 // annual filings due now are for the FY that just ended

  const { data: rules, error: rulesError } = await supabase
    .from('compliance_rules')
    .select('filing_type, period_type, due_date_rule')
    .eq('active', true)
  if (rulesError) {
    return new Response(JSON.stringify({ error: rulesError.message }), { status: 500 })
  }

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, firm_id, services_subscribed, mca_filings')
    .eq('is_active', true)
  if (clientsError) {
    return new Response(JSON.stringify({ error: clientsError.message }), { status: 500 })
  }

  let created = 0
  let skippedExisting = 0
  let skippedNoRule = 0

  for (const client of clients ?? []) {
    const wants: { taskType: string; cadence: "monthly" | "quarterly" | "annual" }[] = []

    for (const service of (client.services_subscribed as string[] | null) ?? []) {
      const mapped = SERVICE_TASK_MAP[service]
      if (!mapped) continue
      for (const taskType of mapped.taskTypes) wants.push({ taskType, cadence: mapped.cadence })
    }
    for (const filing of (client.mca_filings as string[] | null) ?? []) {
      if (RECURRING_MCA_FILINGS.has(filing)) wants.push({ taskType: filing, cadence: "annual" })
    }

    for (const { taskType, cadence } of wants) {
      const filingType = FILING_TYPE_MAP[taskType]
      let dueDate: string | null = null
      let targetFY = financialYear
      let targetPeriod: string

      if (taskType === "Bookkeeping") {
        // No statutory due date — an internal work reminder, 10th of next month.
        const month = calMonth === 12 ? 1 : calMonth + 1
        const year = calMonth === 12 ? calYear + 1 : calYear
        dueDate = `${year}-${pad(month)}-10`
        targetPeriod = calendarMonthToName(calMonth)
      } else {
        const rule = filingType ? selectRuleForFY(rules ?? [], filingType, cadence === "annual" ? completedFYStart : fyStartYear) : undefined
        if (!rule) { skippedNoRule++; continue }

        if (cadence === "monthly") {
          dueDate = computeDueDate(rule, fyStartYear, monthlyPeriod)
          targetPeriod = calendarMonthToName(calMonth)
        } else if (cadence === "quarterly") {
          dueDate = computeDueDate(rule, fyStartYear, quarterlyPeriod)
          targetPeriod = calendarMonthToName(quarterlyPeriod.month)
        } else {
          dueDate = computeDueDate(rule, completedFYStart)
          targetPeriod = "Annual"
          targetFY = `FY ${completedFYStart}-${String(completedFYStart + 1).slice(2)}`
        }
      }

      if (!dueDate) { skippedNoRule++; continue }

      const existsQuery = supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('task_type', taskType)
        .eq('financial_year', targetFY)
      if (cadence !== "annual") existsQuery.eq('period', targetPeriod)

      const { count } = await existsQuery
      if (count && count > 0) { skippedExisting++; continue }

      const { error: insertError } = await supabase.from('tasks').insert({
        firm_id: client.firm_id,
        client_id: client.id,
        task_type: taskType,
        financial_year: targetFY,
        period: targetPeriod,
        due_date: dueDate,
        status: 'pending',
        priority: 'medium',
        document_checklist: [],
      })
      if (insertError) {
        console.error(`generate-recurring-tasks: insert failed for client ${client.id} / ${taskType}`, insertError)
      } else {
        created++
      }
    }
  }

  return new Response(JSON.stringify({ clientsScanned: clients?.length ?? 0, created, skippedExisting, skippedNoRule }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
