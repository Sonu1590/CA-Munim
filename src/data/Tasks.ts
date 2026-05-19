import { supabase } from '@/lib/supabase'

export type TaskStatus = "pending" | "in_progress" | "completed"
export type TaskPriority = "low" | "medium" | "high" | "urgent"

export type TaskType =
  | "GSTR-1" | "GSTR-3B" | "GSTR-9" | "GSTR-9C" | "GSTR-4" | "CMP-08"
  | "ITR Filing" | "Advance Tax" | "Tax Audit" | "Form 3CD" | "Form 26QB"
  | "TDS Challan" | "24Q" | "26Q" | "27Q" | "27EQ" | "Form 16" | "Form 16A" | "Form 27D"
  | "MGT-7" | "AOC-4" | "DIR-3 KYC" | "ADT-1" | "INC-20A" | "PAS-3"
  | "Bookkeeping" | "Payroll" | "GST Registration" | "Company Incorporation" | "Custom"

export interface ChecklistItem {
  id: string
  label: string
  received: boolean
  receivedAt?: string
  source?: "client_upload" | "manual"
}

export interface Task {
  id: string
  clientName: string
  clientId: string
  taskType: TaskType
  customTaskName?: string
  financialYear: string
  quarter?: string
  month?: string
  dueDate: string
  priority: TaskPriority
  status: TaskStatus
  assignedTo: string
  assignedInitials: string
  docsReceived: number
  docsTotal: number
  notes?: string
  documentChecklist?: ChecklistItem[]
}

export const taskTypeGroups = {
  GST: ["GSTR-1", "GSTR-3B", "GSTR-9", "GSTR-9C", "GSTR-4", "CMP-08"] as TaskType[],
  "Income Tax": ["ITR Filing", "Advance Tax", "Tax Audit", "Form 3CD", "Form 26QB"] as TaskType[],
  TDS: ["TDS Challan", "24Q", "26Q", "27Q", "27EQ", "Form 16", "Form 16A", "Form 27D"] as TaskType[],
  "ROC / MCA": ["MGT-7", "AOC-4", "DIR-3 KYC", "ADT-1", "INC-20A", "PAS-3"] as TaskType[],
  Other: ["Bookkeeping", "Payroll", "GST Registration", "Company Incorporation", "Custom"] as TaskType[],
}


export const dueDateRules: Record<string, string> = {
  "GSTR-1": "11th of following month",
  "GSTR-3B": "20th of following month (turnover > ₹5cr)",
  "GSTR-9": "31st December of the year",
  "GSTR-4": "30th April",
  "CMP-08": "18th of month following quarter",
  "TDS Challan": "7th of following month (30th April for March)",
  "24Q": "31st of month following quarter end (Q4: 31st May)",
  "26Q": "31st of month following quarter end (Q4: 31st May)",
  "Form 16": "15th June",
  "ITR Filing": "31st July (non-audit) / 31st October (audit cases)",
  "Advance Tax": "15th Jun (15%), 15th Sep (45%), 15th Dec (75%), 15th Mar (100%)",
  "DIR-3 KYC": "30th September each year",
  "MGT-7": "60 days from AGM date",
  "AOC-4": "30 days from AGM date",
}

export const financialYears = [
  "FY 2022-23",
  "FY 2023-24",
  "FY 2024-25",
  "FY 2025-26",
  "FY 2026-27",
  "FY 2027-28",
]
export const quarters = ["Q1 (Apr-Jun)", "Q2 (Jul-Sep)", "Q3 (Oct-Dec)", "Q4 (Jan-Mar)"]
export const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"]

export const mockTasks: Task[] = []

const taskSelectColumns = `
  id,
  client_id,
  task_type,
  custom_name,
  financial_year,
  period,
  due_date,
  status,
  priority,
  assigned_to,
  document_checklist,
  notes,
  completed_at,
  created_at,
  clients(name),
  staff(name)
`

function mapDbRowToTask(row: any): Task {
  const assignedName = row.staff?.name ?? row.assigned_to ?? 'Unassigned'
  return {
    id: row.id,
    clientName: row.clients?.name ?? 'Unknown Client',
    clientId: row.client_id,
    taskType: row.task_type as TaskType,
    customTaskName: row.custom_name,
    financialYear: row.financial_year ?? '',
    month: typeof row.period === 'string' && row.period.startsWith('Q') ? undefined : row.period,
    quarter: typeof row.period === 'string' && row.period.startsWith('Q') ? row.period : undefined,
    dueDate: row.due_date,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    assignedTo: assignedName,
    assignedInitials: assignedName
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    docsReceived: (row.document_checklist ?? []).filter((d: any) => d.received || d.checked).length,
    docsTotal: (row.document_checklist ?? []).length,
    notes: row.notes,
    documentChecklist: row.document_checklist ?? [],
  }
}

export async function fetchTasksFromSupabase(statusFilter?: TaskStatus): Promise<Task[]> {
  let query = supabase.from('tasks').select(taskSelectColumns).order('due_date', { ascending: true })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapDbRowToTask)
}

/** Open tasks with due dates for the compliance calendar report (FY-scoped per client). */
export async function fetchComplianceTasksForClient(clientId: string, financialYear: string): Promise<Task[]> {
  if (!clientId || !financialYear) return []

  const { data, error } = await supabase
    .from('tasks')
    .select(taskSelectColumns)
    .eq('client_id', clientId)
    .eq('financial_year', financialYear)
    .neq('status', 'completed')
    .order('due_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapDbRowToTask)
}
