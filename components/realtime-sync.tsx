"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase.channel('admin_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_accounts' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_logs' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
