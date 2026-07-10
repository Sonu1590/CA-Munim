import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type StaffRole = 'admin' | 'staff'

// Mirrors the RBAC migration's two-value staff.role column — the actual
// enforcement lives in RLS (get_my_staff_role()), this is only for hiding
// controls the user can't use and short-circuiting obviously-blocked
// requests before they round-trip to the server.
export function useUserRole() {
  const [role, setRole] = useState<StaffRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) { setRole(null); setLoading(false) }
        return
      }

      const { data } = await supabase
        .from('staff')
        .select('role')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!cancelled) {
        setRole(data?.role === 'admin' ? 'admin' : 'staff')
        setLoading(false)
      }
    }

    loadRole()
    return () => { cancelled = true }
  }, [])

  return { role, isAdmin: role === 'admin', loading }
}
