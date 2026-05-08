import { supabase } from '@/lib/supabase'

export type ClientType = "Individual" | "HUF" | "Sole Proprietor" | "Partnership" | "LLP" | "Private Ltd" | "Public Ltd" | "Trust" | "Society" | "AOP" | "BOI"

export interface Client {
  id: string
  name: string
  type: ClientType
  pan: string
  phone: string
  email: string
  gstin?: string
  activeTasks: number
  pendingFees: number
  feesOverdue: boolean
  lastActivity: string
  city: string
  state: string
  servicesSubscribed: string[]
}

export const mockClients: Client[] = []

export async function fetchClientsFromSupabase(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      client_type,
      pan,
      phone,
      email,
      gstin,
      city,
      state,
      services_subscribed,
      updated_at,
      tasks(id, status),
      invoices(total, status)
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row: any) => {
    const activeTasks = (row.tasks ?? []).filter((t: any) => t.status !== 'completed').length
    const unpaidInvoices = (row.invoices ?? []).filter((inv: any) => inv.status === 'sent' || inv.status === 'overdue')
    const pendingFees = unpaidInvoices.reduce((sum: number, inv: any) => sum + (inv.total ?? 0), 0)
    const feesOverdue = (row.invoices ?? []).some((inv: any) => inv.status === 'overdue')

    return {
      id: row.id,
      name: row.name,
      type: row.client_type as ClientType,
      pan: row.pan ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      gstin: row.gstin,
      city: row.city ?? '',
      state: row.state ?? '',
      servicesSubscribed: row.services_subscribed ?? [],
      activeTasks,
      pendingFees,
      feesOverdue,
      lastActivity: row.updated_at?.split('T')[0] ?? '',
    }
  })
}
