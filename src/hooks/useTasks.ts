import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ChecklistItem } from '@/data/Tasks'

export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  clientId: string
  clientName: string
  taskType: string
  customName?: string
  financialYear: string
  period?: string
  dueDate: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo?: string
  assignedToName?: string
  documentChecklist: ChecklistItem[]
  filingReference?: string
  ackNumber?: string
  notes?: string
  completedAt?: string
  createdAt: string
}

export interface TaskFormData {
  client_id: string
  task_type: string
  custom_name?: string
  financial_year: string
  period?: string
  due_date: string
  priority?: TaskPriority
  assigned_to?: string
  document_checklist?: ChecklistItem[]
  notes?: string
}

export function useTasks(statusFilter?: TaskStatus) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('tasks')
        .select(`
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
          filing_reference,
          ack_number,
          notes,
          completed_at,
          created_at,
          clients(name),
          staff(name)
        `)
        .order('due_date', { ascending: true })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const shaped: Task[] = (data ?? []).map((row: any) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.clients?.name ?? 'Unknown Client',
        taskType: row.task_type,
        customName: row.custom_name,
        financialYear: row.financial_year ?? '',
        period: row.period,
        dueDate: row.due_date,
        status: row.status as TaskStatus,
        priority: row.priority as TaskPriority,
        assignedTo: row.assigned_to,
        assignedToName: row.staff?.name ?? 'Unassigned',
        documentChecklist: row.document_checklist ?? [],
        filingReference: row.filing_reference,
        ackNumber: row.ack_number,
        notes: row.notes,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      }))

      setTasks(shaped)
    } catch (err: any) {
      console.error('useTasks fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const addTask = async (formData: TaskFormData): Promise<boolean> => {
    try {
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
        .from('tasks')
        .insert({
          firm_id: staffRow.firm_id,
          client_id: formData.client_id,
          task_type: formData.task_type,
          custom_name: formData.custom_name,
          financial_year: formData.financial_year,
          period: formData.period,
          due_date: formData.due_date,
          status: 'pending',
          priority: formData.priority ?? 'medium',
          assigned_to: formData.assigned_to,
          document_checklist: formData.document_checklist ?? [],
          notes: formData.notes,
        })

      if (insertErr) throw insertErr

      await fetchTasks()
      return true
    } catch (err: any) {
      console.error('addTask error:', err)
      setError(err.message)
      return false
    }
  }

  const updateTaskStatus = async (id: string, newStatus: TaskStatus): Promise<boolean> => {
    const previousTasks = tasks

    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, status: newStatus } : t)
    )

    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString()
      }

      const { error: updateErr } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)

      if (updateErr) throw updateErr

      // Optimistic update — no need to refetch entire list
      setTasks(prev =>
        prev.map(t => t.id === id ? { ...t, status: newStatus } : t)
      )
      return true
    } catch (err: any) {
      console.error('updateTaskStatus error:', err)
      setTasks(previousTasks)
      setError(err.message)
      toast.error('Failed to update task status. Please try again.')
      return false
    }
  }

  const updateTask = async (id: string, updates: Partial<TaskFormData>): Promise<boolean> => {
    try {
      const { error: updateErr } = await supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      await fetchTasks()
      return true
    } catch (err: any) {
      console.error('updateTask error:', err)
      setError(err.message)
      return false
    }
  }

  const deleteTask = async (id: string): Promise<boolean> => {
    const previousTasks = tasks
    setTasks(prev => prev.filter(task => task.id !== id))

    try {
      const { error: deleteErr } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (deleteErr) throw deleteErr
      return true
    } catch (err: any) {
      console.error('deleteTask error:', err)
      setTasks(previousTasks)
      setError(err.message)
      toast.error('Failed to delete task. Please try again.')
      return false
    }
  }

  // Overdue count — useful for dashboard badge
  const overdueCount = tasks.filter(
    t => t.status !== 'completed' && new Date(t.dueDate) < new Date()
  ).length

  // Due this week
  const dueThisWeek = tasks.filter(t => {
    if (t.status === 'completed') return false
    const due = new Date(t.dueDate)
    const now = new Date()
    const weekFromNow = new Date()
    weekFromNow.setDate(now.getDate() + 7)
    return due >= now && due <= weekFromNow
  }).length

  return {
    tasks,
    loading,
    error,
    overdueCount,
    dueThisWeek,
    addTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    refetch: fetchTasks,
  }
}
