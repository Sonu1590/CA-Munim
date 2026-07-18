import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { roundMoney } from '@/lib/indianTaxUtils'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partially_paid'

// (M9) A real, structured set the UI can drive and due_date can be computed
// from — replacing the old free-text payment_terms, which in practice was
// only ever 'Due on receipt' or null and the create-invoice UI never even
// exposed a way to set.
export type PaymentTerms = 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45'

export const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string }[] = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
]

const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number> = {
  due_on_receipt: 0,
  net_15: 15,
  net_30: 30,
  net_45: 45,
}

/**
 * Mirrors the DB backfill/CASE logic in the invoice_due_date migration.
 * Pure calendar-date arithmetic anchored to UTC throughout (Date.UTC on the
 * way in, getUTCDate/toISOString on the way out) — constructing from
 * `dateString + 'T00:00:00'` would parse in the runtime's local timezone,
 * so serializing back via toISOString() could roll the date back a day
 * whenever the runtime's local zone is behind UTC.
 */
export function computeInvoiceDueDate(invoiceDate: string, paymentTerms: PaymentTerms): string {
  const [year, month, day] = invoiceDate.split('-').map(Number)
  const due = new Date(Date.UTC(year, month - 1, day))
  due.setUTCDate(due.getUTCDate() + PAYMENT_TERMS_DAYS[paymentTerms])
  return due.toISOString().split('T')[0]
}

export interface LineItem {
  description: string
  sacCode: string
  amount: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string
  clientName: string
  clientState?: string
  invoiceDate: string
  dueDate: string
  financialYear: string
  lineItems: LineItem[]
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  total: number
  status: InvoiceStatus
  notes?: string
  paymentTerms: PaymentTerms
  createdAt: string
}

export interface InvoiceFormData {
  client_id: string
  invoice_date: string
  financial_year: string
  line_items: LineItem[]
  notes?: string
  payment_terms?: PaymentTerms // defaults to 'net_15' — matches invoices.payment_terms's DB default
  send_whatsapp?: boolean
  gst_applicable?: boolean // defaults to true — matches CreateInvoiceModal's default-on toggle
}

export interface Payment {
  id: string
  invoiceId: string
  clientId: string
  amount: number
  paymentDate: string
  mode: string
  reference?: string
  notes?: string
}

export function useBilling() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          client_id,
          invoice_date,
          due_date,
          financial_year,
          line_items,
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          status,
          notes,
          payment_terms,
          created_at,
          clients(name, state)
        `)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      const shaped: Invoice[] = (data ?? []).map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        clientId: row.client_id,
        clientName: row.clients?.name ?? '',
        clientState: row.clients?.state,
        invoiceDate: row.invoice_date,
        dueDate: row.due_date,
        financialYear: row.financial_year,
        lineItems: row.line_items ?? [],
        subtotal: row.subtotal ?? 0,
        cgst: row.cgst ?? 0,
        sgst: row.sgst ?? 0,
        igst: row.igst ?? 0,
        total: row.total ?? 0,
        status: row.status as InvoiceStatus,
        notes: row.notes,
        paymentTerms: row.payment_terms,
        createdAt: row.created_at,
      }))

      setInvoices(shaped)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  // ── Get next invoice number for current FY ─────────────────────────────────
  async function getNextInvoiceNumber(firmId: string): Promise<string> {
    const now = new Date()
    const fyYear = now.getMonth() >= 3
      ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(-2)}`
      : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(-2)}`

    let attempts = 0
    while (attempts < 5) {
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('financial_year', `FY ${fyYear}`)

      const seq = String((count ?? 0) + 1 + attempts).padStart(4, '0')
      const candidate = `INV-${fyYear.replace('-', '')}-${seq}`

      const { count: existing } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('invoice_number', candidate)

      if (!existing) return candidate
      attempts++
    }

    return `INV-${fyYear.replace('-', '')}-${Date.now().toString().slice(-6)}`
  }

  // ── Create invoice ─────────────────────────────────────────────────────────
  const createInvoice = async (formData: InvoiceFormData, firmGstin: string, firmState: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: staffRow } = await supabase
        .from('staff')
        .select('firm_id')
        .eq('auth_user_id', user.id)
        .single()

      if (!staffRow) throw new Error('Staff record not found')

      // Get client's state for GST calculation
      const { data: clientRow } = await supabase
        .from('clients')
        .select('state')
        .eq('id', formData.client_id)
        .single()

      const subtotal = roundMoney(formData.line_items.reduce((sum, item) => sum + item.amount, 0))
      const isSameState = clientRow?.state === firmState
      // gst_applicable defaults to true so any caller that predates this
      // field keeps its existing (GST-always-on) behavior.
      const gstApplicable = formData.gst_applicable !== false
      const gstAmount = gstApplicable ? roundMoney(subtotal * 0.18) : 0

      const cgst = gstApplicable && isSameState ? roundMoney(gstAmount / 2) : 0
      const sgst = gstApplicable && isSameState ? roundMoney(gstAmount / 2) : 0
      const igst = gstApplicable && !isSameState ? gstAmount : 0
      // Sum the already-rounded line items, not gstAmount again, so the
      // parts printed on the invoice always add up to exactly this total.
      const total = roundMoney(subtotal + cgst + sgst + igst)

      const invoiceNumber = await getNextInvoiceNumber(staffRow.firm_id)
      const paymentTerms = formData.payment_terms ?? 'net_15'
      const dueDate = computeInvoiceDueDate(formData.invoice_date, paymentTerms)

      const { data: inserted, error: insertErr } = await supabase
        .from('invoices')
        .insert({
          firm_id: staffRow.firm_id,
          client_id: formData.client_id,
          invoice_number: invoiceNumber,
          invoice_date: formData.invoice_date,
          due_date: dueDate,
          financial_year: formData.financial_year,
          line_items: formData.line_items,
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          status: 'draft',
          notes: formData.notes,
          payment_terms: paymentTerms,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      await fetchInvoices()
      return inserted.id
    } catch (err: any) {
      console.error('createInvoice error:', err)
      setError(err.message)
      return null
    }
  }

  // ── Mark invoice as sent ───────────────────────────────────────────────────
  const markAsSent = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'sent' } : inv))
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    }
  }

  // ── Record payment ─────────────────────────────────────────────────────────
  const recordPayment = async (
    invoiceId: string,
    clientId: string,
    amount: number,
    mode: string,
    reference?: string,
    notes?: string,
    paymentDate?: string
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: staffRow } = await supabase
        .from('staff')
        .select('firm_id')
        .eq('auth_user_id', user.id)
        .single()

      // Insert payment record
      const { error: payErr } = await supabase
        .from('payments')
        .insert({
          firm_id: staffRow?.firm_id,
          invoice_id: invoiceId,
          client_id: clientId,
          amount,
          payment_date: paymentDate ?? new Date().toISOString().split('T')[0],
          mode,
          reference,
          notes,
        })

      if (payErr) throw payErr

      // Check if invoice is now fully paid
      const { data: invoice } = await supabase
        .from('invoices')
        .select('total')
        .eq('id', invoiceId)
        .single()

      const { data: allPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoiceId)

      const totalPaid = (allPayments ?? []).reduce((sum, p) => sum + p.amount, 0)
      const invoiceTotal = invoice?.total ?? 0
      const EPSILON = 0.01
      const newStatus: InvoiceStatus = (invoiceTotal - totalPaid) <= EPSILON ? 'paid' : 'partially_paid'

      await supabase
        .from('invoices')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', invoiceId)

      await fetchInvoices()
      return true
    } catch (err: any) {
      console.error('recordPayment error:', err)
      setError(err.message)
      return false
    }
  }

  // ── Summary stats for billing dashboard ───────────────────────────────────
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const invoicedThisMonth = invoices
    .filter(inv => inv.invoiceDate.startsWith(currentMonth))
    .reduce((sum, inv) => sum + inv.total, 0)

  const receivedThisMonth = invoices
    .filter(inv => inv.status === 'paid' && inv.invoiceDate.startsWith(currentMonth))
    .reduce((sum, inv) => sum + inv.total, 0)

  const totalOutstanding = invoices
    .filter(inv => ['sent', 'overdue', 'partially_paid'].includes(inv.status))
    .reduce((sum, inv) => sum + inv.total, 0)

  return {
    invoices,
    loading,
    error,
    createInvoice,
    markAsSent,
    recordPayment,
    refetch: fetchInvoices,
    stats: { invoicedThisMonth, receivedThisMonth, totalOutstanding },
  }
}
