import { supabase } from '@/lib/supabase'

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Partially Paid" | "Overdue" | "Cancelled"
export type PaymentMode = "UPI" | "NEFT" | "RTGS" | "IMPS" | "Cash" | "Cheque" | "Demand Draft"

export interface InvoiceLineItem {
  id: string
  description: string
  sacCode: string
  amount: number
}

export interface Payment {
  id: string
  invoiceId: string
  date: string
  amount: number
  mode: PaymentMode
  reference: string
  notes?: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string
  clientName: string
  clientState: string
  invoiceDate: string
  dueDate: string
  financialYear: string
  lineItems: InvoiceLineItem[]
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  grandTotal: number
  gstApplicable: boolean
  isSameState: boolean
  status: InvoiceStatus
  payments: Payment[]
  amountPaid: number
  amountDue: number
  notes?: string
}

export const mockInvoices: Invoice[] = []

const statusMap: Record<string, InvoiceStatus> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partially_paid: "Partially Paid",
  "partially paid": "Partially Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
}

function normalizeStatus(status: string): InvoiceStatus {
  return statusMap[status.toLowerCase()] ?? "Draft"
}

export async function fetchInvoicesFromSupabase(): Promise<Invoice[]> {
  const { data, error } = await supabase
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
      clients(name, state),
      payments(id, amount, mode, reference, payment_date, notes)
    `)
    .order('invoice_date', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => {
    const payments: Payment[] = (row.payments ?? []).map((payment: any) => ({
      id: payment.id,
      invoiceId: row.id,
      date: payment.payment_date ?? payment.date ?? '',
      amount: payment.amount ?? 0,
      mode: payment.mode as PaymentMode,
      reference: payment.reference ?? '',
      notes: payment.notes,
    }))

    const amountPaid = payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
    const storedTax = (row.cgst ?? 0) + (row.sgst ?? 0) + (row.igst ?? 0)
    const mockGstFallback = String(row.invoice_number ?? '').startsWith('INV-MOCK') && storedTax === 0 && (row.subtotal ?? 0) > 0
    const fallbackTax = mockGstFallback ? (row.subtotal ?? 0) * 0.18 : 0
    const cgst = mockGstFallback ? fallbackTax / 2 : (row.cgst ?? 0)
    const sgst = mockGstFallback ? fallbackTax / 2 : (row.sgst ?? 0)
    const igst = row.igst ?? 0
    const grandTotal = row.total && row.total > (row.subtotal ?? 0)
      ? row.total
      : ((row.subtotal ?? 0) + cgst + sgst + igst)
    const amountDue = Math.max(grandTotal - amountPaid, 0)

    return {
      id: row.id,
      invoiceNumber: row.invoice_number ?? '',
      clientId: row.client_id ?? '',
      clientName: row.clients?.name ?? '',
      clientState: row.clients?.state ?? '',
      invoiceDate: row.invoice_date ?? '',
      dueDate: row.due_date ?? row.invoice_date ?? '',
      financialYear: row.financial_year ?? '',
      lineItems: row.line_items ?? [],
      subtotal: row.subtotal ?? 0,
      cgst,
      sgst,
      igst,
      grandTotal,
      gstApplicable: (cgst + sgst + igst) > 0,
      isSameState: (cgst + sgst) > 0,
      status: normalizeStatus(row.status ?? ''),
      payments,
      amountPaid,
      amountDue,
      notes: row.notes,
    }
  })
}
