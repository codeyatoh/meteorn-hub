"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Loader2, MailWarning } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";

type TempMailRequest = {
  user_id: string;
  user_name: string;
  status: "none" | "pending" | "approved" | "rejected";
  daily_count: number;
  last_reset_date: string;
  created_at: string;
};

export default function AdminTempMailRequestsPage() {
  const [requests, setRequests] = useState<TempMailRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/admin/temp-mail-requests");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      toast.error("Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => fetchRequests(), 0);
  }, []);

  const handleUpdateStatus = async (userId: string, newStatus: "approved" | "rejected") => {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/temp-mail-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      
      setRequests((prev) =>
        prev.map((r) => (r.user_id === userId ? { ...r, status: newStatus } : r))
      );
      toast.success(`Request ${newStatus}.`);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="px-6 py-10">
      <AutoRefresh />
      <div className="mx-auto max-w-5xl space-y-10">
        
        {/* Header */}
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
            <MailWarning className="size-3" />
            <span>Temp Mail Access</span>
          </div>
          <h1 className="mt-1 font-heading text-4xl tracking-tight text-foreground">
            Access Requests
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground text-sm">
            Approve or reject user requests for the Temp Mail generator feature.
          </p>
        </div>

        {/* Requests List */}
        <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No access requests found.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {requests.map((req) => (
                <div key={req.user_id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-foreground/[0.02] transition-colors">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-foreground">{req.user_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-bold ${
                        req.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                        req.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      User ID: {req.user_id}
                    </div>
                    {req.status === 'approved' && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Generated today: {req.daily_count} / 100
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStatus(req.user_id, "approved")}
                      disabled={updating === req.user_id || req.status === "approved"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                    >
                      {updating === req.user_id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(req.user_id, "rejected")}
                      disabled={updating === req.user_id || req.status === "rejected"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                    >
                      {updating === req.user_id ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
