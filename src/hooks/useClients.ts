import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types (identical shape to mockClients so UI needs zero changes) ──────────
export type ClientType =
  | "Individual" | "HUF" | "Sole Proprietor" | "Partnership"
  | "LLP" | "Private Ltd" | "Public Ltd" | "Trust" | "Society" | "AOP" | "BOI"

export interface Client {
  id: string
  name: string
  type: ClientType
  pan: string
  phone: string
  alt_phone?: string
  email: string
  address?: string
  gstin?: string
  date_of_birth?: string
  gst_reg_date?: string
  annual_fees?: number
  activeTasks: number
  pendingFees: number
  feesOverdue: boolean
  lastActivity: string
  city: string
  state: string
  servicesSubscribed: string[]
}

export interface ClientFormData {
  name: string
  type: ClientType
  pan: string
  phone: string
  alt_phone?: string
  email: string
  date_of_birth?: string
  address?: string
  city: string
  state: string
  pin?: string
  gstin?: string
  gst_reg_date?: string
  gst_turnover_category?: string
  gst_filing_freq?: string
  tan?: string
  itax_ward?: string
  itr_type?: string
  cin_llpin?: string
  roc_jurisdiction?: string
  directors?: { name: string; din: string }[]
  agm_due_month?: number
  mca_filings?: string[]
  services_subscribed?: string[]
  annual_fees?: number
  gst_on_fees?: boolean
  billing_frequency?: string
  preferred_payment_mode?: string
  client_upi_id?: string
  notes?: string
}

// ── Raw Supabase row shape ───────────────────────────────────────────────────

// ── Transform DB row → Client interface the UI expects ──────────────────────

// ── Main hook ────────────────────────────────────────────────────────────────
export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch clients with task counts and fee summaries via Supabase
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          client_type,
          pan,
          phone,
          alt_phone,
          email,
          date_of_birth,
          address,
          gstin,
          gst_reg_date,
          city,
          state,
          services_subscribed,
          annual_fees,
          updated_at,
          tasks(id, status),
          invoices(total, status)
        `)
        .limit(500, { foreignTable: 'tasks' })
        .limit(500, { foreignTable: 'invoices' })
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (fetchError) throw fetchError

      // Compute derived fields (active tasks, pending fees, overdue)
      const shaped: Client[] = (data ?? []).map((row: any) => {
        const activeTasks = (row.tasks ?? []).filter(
          (t: any) => t.status !== 'completed'
        ).length

        if ((row.tasks ?? []).length >= 500 || (row.invoices ?? []).length >= 500) {
          console.warn('useClients nested task/invoice rows reached the safety limit for client', row.id)
        }

        const unpaidInvoices = (row.invoices ?? []).filter(
          (inv: any) => inv.status === 'sent' || inv.status === 'overdue'
        )

        const pendingFees = unpaidInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.total ?? 0), 0
        )

        const feesOverdue = (row.invoices ?? []).some(
          (inv: any) => inv.status === 'overdue'
        )

        return {
          id: row.id,
          name: row.name,
          type: row.client_type as ClientType,
          pan: row.pan ?? '',
          phone: row.phone ?? '',
          alt_phone: row.alt_phone ?? '',
          email: row.email ?? '',
          date_of_birth: row.date_of_birth ?? '',
          address: row.address ?? '',
          gstin: row.gstin,
          gst_reg_date: row.gst_reg_date ?? '',
          annual_fees: row.annual_fees ?? 0,
          activeTasks,
          pendingFees,
          feesOverdue,
          lastActivity: row.updated_at?.split('T')[0] ?? '',
          city: row.city ?? '',
          state: row.state ?? '',
          servicesSubscribed: row.services_subscribed ?? [],
        }
      })

      setClients(shaped)
    } catch (err: any) {
      console.error('useClients fetch error:', err)
      setError(err.message ?? 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // ── Add client ─────────────────────────────────────────────────────────────
  const addClient = async (formData: ClientFormData): Promise<boolean> => {
    try {
      if (!formData.date_of_birth) {
        throw new Error('Date of Birth / Incorporation is required')
      }

      // Get firm_id from current user's staff record
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: staffRow, error: staffErr } = await supabase
      .from('staff')
      .select('firm_id')
      .eq('auth_user_id', user.id)
  .maybeSingle()

if (staffErr) {
  console.error('Staff lookup failed:', staffErr)
  throw new Error('Unable to identify firm for current user')
}

if (!staffRow?.firm_id) {
  throw new Error('No firm linked to current user')
}

      const { error: insertErr } = await supabase
        .from('clients')
        .insert({
          firm_id: staffRow.firm_id,
          name: formData.name,
          client_type: formData.type,
          pan: formData.pan?.toUpperCase(),
          phone: formData.phone,
          alt_phone: formData.alt_phone,
          email: formData.email,
          date_of_birth: formData.date_of_birth,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pin: formData.pin,
          gstin: formData.gstin?.toUpperCase(),
          gst_reg_date: formData.gst_reg_date || null,
          gst_turnover_category: formData.gst_turnover_category,
          gst_filing_freq: formData.gst_filing_freq,
          tan: formData.tan?.toUpperCase(),
          itax_ward: formData.itax_ward,
          itr_type: formData.itr_type,
          cin_llpin: formData.cin_llpin,
          roc_jurisdiction: formData.roc_jurisdiction,
          directors: formData.directors ?? [],
          agm_due_month: formData.agm_due_month,
          mca_filings: formData.mca_filings ?? [],
          services_subscribed: formData.services_subscribed ?? [],
          annual_fees: formData.annual_fees ?? 0,
          gst_on_fees: formData.gst_on_fees ?? true,
          billing_frequency: formData.billing_frequency,
          preferred_payment_mode: formData.preferred_payment_mode,
          client_upi_id: formData.client_upi_id,
          notes: formData.notes,
          is_active: true,
        })

      if (insertErr) throw insertErr

      await fetchClients() // refresh list
      return true
    } catch (err: any) {
      console.error('addClient error:', err)
      return false
    }
  }

  // ── Update client ──────────────────────────────────────────────────────────
  const updateClient = async (id: string, formData: Partial<ClientFormData>): Promise<boolean> => {
    try {
      const clientExists = clients.find(c => c.id === id)
      if (!clientExists) {
        return false
      }

      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          name: formData.name,
          client_type: formData.type,
          pan: formData.pan?.toUpperCase(),
          phone: formData.phone,
          alt_phone: formData.alt_phone,
          email: formData.email,
          date_of_birth: formData.date_of_birth,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          gstin: formData.gstin?.toUpperCase(),
          gst_reg_date: formData.gst_reg_date || null,
          services_subscribed: formData.services_subscribed,
          annual_fees: formData.annual_fees,
          notes: formData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      await fetchClients()
      return true
    } catch (err: any) {
      console.error('updateClient error:', err)
      return false
    }
  }

  // ── Delete (soft delete) client ────────────────────────────────────────────
  const deleteClient = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteErr } = await supabase
        .from('clients')
        .update({ is_active: false })
        .eq('id', id)

      if (deleteErr) throw deleteErr

      await fetchClients()
      return true
    } catch (err: any) {
      console.error('deleteClient error:', err)
      return false
    }
  }

  return { clients, loading, error, addClient, updateClient, deleteClient, refetch: fetchClients }
}
