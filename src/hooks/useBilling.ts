import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partially_paid'

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
  financialYear: string
  lineItems: LineItem[]
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  total: number
  status: InvoiceStatus
  notes?: string
  paymentTerms?: string
  createdAt: string
}

export interface InvoiceFormData {
  client_id: string
  invoice_date: string
  financial_year: string
  line_items: LineItem[]
  notes?: string
  payment_terms?: string
  send_whatsapp?: boolean
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

      const subtotal = formData.line_items.reduce((sum, item) => sum + item.amount, 0)
      const isSameState = clientRow?.state === firmState
      const gstAmount = subtotal * 0.18

      const cgst = isSameState ? gstAmount / 2 : 0
      const sgst = isSameState ? gstAmount / 2 : 0
      const igst = !isSameState ? gstAmount : 0
      const total = subtotal + gstAmount

      const invoiceNumber = await getNextInvoiceNumber(staffRow.firm_id)

      const { data: inserted, error: insertErr } = await supabase
        .from('invoices')
        .insert({
          firm_id: staffRow.firm_id,
          client_id: formData.client_id,
          invoice_number: invoiceNumber,
          invoice_date: formData.invoice_date,
          financial_year: formData.financial_year,
          line_items: formData.line_items,
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          status: 'draft',
          notes: formData.notes,
          payment_terms: formData.payment_terms,
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
    notes?: string
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
          payment_date: new Date().toISOString().split('T')[0],
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
