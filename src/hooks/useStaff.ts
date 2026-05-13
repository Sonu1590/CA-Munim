import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export function useStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, email, role")
        .eq("active", true)
        .order("name");

      if (error) {
        console.error("Staff fetch failed:", error);
        return;
      }

      setStaff(data || []);
    } catch (err) {
      console.error("Staff fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    staff,
    loading,
  };
}