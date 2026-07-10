import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface DashboardMetrics {
  totalClients: number
  overdueTasks: number
  pendingFees: number
  dueThisWeek: number
}

export interface ComplianceAlert {
  id: string
  filingType: string
  dueDate: string
  clientsAffected: number
  daysUntilDue: number // negative = overdue
  urgency: 'safe' | 'upcoming' | 'overdue'
}

export interface ActivityItem {
  id: string
  description: string
  timestamp: string
  type: 'task' | 'document' | 'invoice' | 'client'
}

export interface MonthlyWorkData {
  completed: number
  total: number
  byType: { name: string; count: number }[]
}

export interface DigestItem {
  id: string
  taskType: string
  clientId: string
  clientName: string
  dueDate: string
  daysOverdue: number // 0 = due today, >0 = overdue
}

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalClients: 0,
    overdueTasks: 0,
    pendingFees: 0,
    dueThisWeek: 0,
  })
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([])
  const [digest, setDigest] = useState<DigestItem[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [monthlyWork, setMonthlyWork] = useState<MonthlyWorkData>({
    completed: 0,
    total: 0,
    byType: [],
  })
  const [loading, setLoading] = useState(true)
  const [firmName, setFirmName] = useState('')
  const [caName, setCaName] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      await Promise.all([
        fetchMetrics(),
        fetchComplianceAlerts(),
        fetchDigest(),
        fetchActivity(),
        fetchMonthlyWork(),
        fetchFirmInfo(),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function fetchFirmInfo() {
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr?.message?.includes('JWT expired')) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return
    }
    if (!user) return

    const { data } = await supabase
      .from('staff')
      .select('name, firms(name, ca_name)')
      .eq('auth_user_id', user.id)
      .single()

    if (data) {
      const firm = data.firms as any
      setFirmName(firm?.name ?? '')
      setCaName(firm?.ca_name ?? data.name ?? '')
    }
  }

  async function fetchMetrics() {
    const now = new Date()
    const weekFromNow = new Date()
    weekFromNow.setDate(now.getDate() + 7)

    // Total active clients
    const { count: clientCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Overdue tasks
    const { count: overdueCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'completed')
      .lt('due_date', now.toISOString().split('T')[0])

    // Due this week
    const { count: weekCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'completed')
      .gte('due_date', now.toISOString().split('T')[0])
      .lte('due_date', weekFromNow.toISOString().split('T')[0])

    // Pending fees — sum of all unpaid invoices
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('total')
      .in('status', ['sent', 'overdue'])

    const pendingFees = (invoiceData ?? []).reduce(
      (sum, inv) => sum + (inv.total ?? 0), 0
    )

    setMetrics({
      totalClients: clientCount ?? 0,
      overdueTasks: overdueCount ?? 0,
      pendingFees,
      dueThisWeek: weekCount ?? 0,
    })
  }

  async function fetchComplianceAlerts() {
    // Get all non-completed tasks due in next 30 days or already overdue
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data } = await supabase
      .from('tasks')
      .select('id, task_type, due_date, client_id')
      .neq('status', 'completed')
      .gte('due_date', thirtyDaysAgo.toISOString().split('T')[0])
      .lte('due_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .order('due_date', { ascending: true })

    if (!data) return

    // Group by task_type + due_date to count clients affected
    const grouped: Record<string, { dueDate: string; count: number }> = {}
    data.forEach(row => {
      const key = `${row.task_type}::${row.due_date}`
      if (!grouped[key]) {
        grouped[key] = { dueDate: row.due_date, count: 0 }
      }
      grouped[key].count++
    })

    const today = new Date()
    const alerts: ComplianceAlert[] = Object.entries(grouped).map(([key, val]) => {
      const [filingType] = key.split('::')
      const due = new Date(val.dueDate)
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: key,
        filingType,
        dueDate: val.dueDate,
        clientsAffected: val.count,
        daysUntilDue: diffDays,
        urgency: diffDays < 0 ? 'overdue' : diffDays <= 7 ? 'upcoming' : 'safe',
      }
    })

    // Sort: overdue first, then by soonest
    alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    setComplianceAlerts(alerts.slice(0, 10)) // top 10
  }

  // The "morning digest" (PM review: cheap to build once the scheduler
  // exists — this is the in-app version, since a pushed WhatsApp/email
  // digest hits the same Meta template-approval / no-email-provider
  // blockers as send-task-reminders). Unlike complianceAlerts (grouped by
  // filing type across a 30-day window, count-only), this lists individual
  // tasks with client names so it reads like an actual to-do list.
  async function fetchDigest() {
    const todayStr = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('tasks')
      .select('id, task_type, due_date, client_id, clients(name)')
      .neq('status', 'completed')
      .lte('due_date', todayStr)
      .order('due_date', { ascending: true })
      .limit(50)

    if (!data) { setDigest([]); return }

    const today = new Date(todayStr)
    const items: DigestItem[] = (data as { id: string; task_type: string; due_date: string; client_id: string; clients: { name: string } | null }[]).map((row) => {
      const due = new Date(row.due_date)
      const daysOverdue = Math.max(0, Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
      return {
        id: row.id,
        taskType: row.task_type,
        clientId: row.client_id,
        clientName: row.clients?.name ?? 'Unknown client',
        dueDate: row.due_date,
        daysOverdue,
      }
    })

    setDigest(items)
  }

  async function fetchActivity() {
    // Recent completed tasks
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('id, task_type, completed_at, clients(name)')
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5)

    // Recent invoices
    const { data: recentInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, created_at, clients(name)')
      .order('created_at', { ascending: false })
      .limit(5)

    // Recent documents
    const { data: recentDocs } = await supabase
      .from('documents')
      .select('id, file_name, created_at, clients(name)')
      .order('created_at', { ascending: false })
      .limit(5)

    const items: ActivityItem[] = []

    ;(recentTasks ?? []).forEach((t: any) => {
      items.push({
        id: `task-${t.id}`,
        description: `${t.task_type} filed for ${t.clients?.name ?? 'client'}`,
        timestamp: t.completed_at,
        type: 'task',
      })
    })

    ;(recentInvoices ?? []).forEach((inv: any) => {
      items.push({
        id: `inv-${inv.id}`,
        description: `Invoice ${inv.invoice_number} sent to ${inv.clients?.name ?? 'client'} — ₹${(inv.total ?? 0).toLocaleString('en-IN')}`,
        timestamp: inv.created_at,
        type: 'invoice',
      })
    })

    ;(recentDocs ?? []).forEach((doc: any) => {
      items.push({
        id: `doc-${doc.id}`,
        description: `Document received from ${doc.clients?.name ?? 'client'}: ${doc.file_name}`,
        timestamp: doc.created_at,
        type: 'document',
      })
    })

    // Sort all by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setActivity(items.slice(0, 10))
  }

  async function fetchMonthlyWork() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('tasks')
      .select('id, task_type, status')
      .gte('due_date', startOfMonth)
      .lte('due_date', endOfMonth)

    if (!data) return

    const total = data.length
    const completed = data.filter(t => t.status === 'completed').length

    // Count by category
    const categoryMap: Record<string, number> = {}
    data.forEach(t => {
      // Normalize to broad category
      let cat = 'Other'
      if (t.task_type.startsWith('GSTR') || t.task_type.includes('GST')) cat = 'GST'
      else if (t.task_type.startsWith('ITR') || t.task_type.includes('Advance Tax')) cat = 'ITR'
      else if (t.task_type.startsWith('TDS') || t.task_type.includes('Form 16') || t.task_type.includes('26Q') || t.task_type.includes('24Q')) cat = 'TDS'
      else if (t.task_type.startsWith('MGT') || t.task_type.startsWith('AOC') || t.task_type.startsWith('DIR') || t.task_type.includes('ROC')) cat = 'ROC'

      categoryMap[cat] = (categoryMap[cat] ?? 0) + 1
    })

    const byType = Object.entries(categoryMap).map(([name, count]) => ({ name, count }))

    setMonthlyWork({ total, completed, byType })
  }

  return {
    metrics,
    complianceAlerts,
    digest,
    activity,
    monthlyWork,
    loading,
    firmName,
    caName,
    refetch: fetchAll,
  }
}
