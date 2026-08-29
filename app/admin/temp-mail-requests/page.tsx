"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Loader2, MailWarning, SearchIcon, ChevronLeft, ChevronDown, ListFilterIcon } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { AnimatePresence, motion } from "motion/react";

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
  
  // "userId-approve" or "userId-reject"
  const [updating, setUpdating] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const ITEMS_PER_PAGE = 8;

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
    const t = setTimeout(() => fetchRequests(), 0);
    return () => clearTimeout(t);
  }, []);

  const handleUpdateStatus = async (userId: string, newStatus: "approved" | "rejected") => {
    setUpdating(`${userId}-${newStatus}`);
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

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = (req.user_name || "").toLowerCase().includes(search.toLowerCase()) || 
                          (req.user_id || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedRequests = filteredRequests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="px-4 sm:px-6 py-10 relative min-h-screen">
      <AutoRefresh />
      <div className="mx-auto max-w-7xl">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
              <MailWarning className="size-3" />
              <span>Temp Mail Access</span>
            </div>
            <h1 className="mt-1 font-heading text-3xl sm:text-4xl tracking-tight text-foreground">
              Access Requests
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground text-sm">
              Approve or reject user requests for the Temp Mail generator feature.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-64 h-10 pl-9 pr-4 rounded-xl border border-input bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-sm"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl border border-input bg-background/50 text-sm hover:bg-foreground/[0.02] transition-colors shadow-sm"
              >
                <ListFilterIcon className="size-4 text-muted-foreground" />
                <span className="capitalize">{statusFilter === 'all' ? 'All Statuses' : statusFilter}</span>
                <ChevronDown className="size-3.5 text-muted-foreground ml-1" />
              </button>
              
              <AnimatePresence>
              {isFilterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-50 top-full right-0 mt-2 w-44 bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col"
                  >
                    <div className="flex flex-col py-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-1.5">Filter by Status</span>
                      {[
                        { value: 'all', label: 'All Statuses' },
                        { value: 'pending', label: 'Pending Only' },
                        { value: 'approved', label: 'Approved Only' },
                        { value: 'rejected', label: 'Rejected Only' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setStatusFilter(opt.value as "all" | "pending" | "approved" | "rejected");
                            setPage(1);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors outline-none ${
                            statusFilter === opt.value 
                              ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                              : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                          }`}
                        >
                          <span className="font-medium">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Requests Table */}
        {loading ? (
          <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
            <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex h-[30vh] items-center justify-center text-sm text-muted-foreground">
            No access requests found.
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[700px] sm:min-w-0">
                {/* Header Grid */}
                <div className="grid grid-cols-[minmax(200px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_100px_160px] gap-6 px-4 py-3 border-b border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                  <span>User</span>
                  <span className="text-right">Daily Usage</span>
                  <span className="text-right">Requested At</span>
                  <span className="text-right">Status</span>
                  <span className="text-right">Action</span>
                </div>

                {/* Rows Grid */}
                <div className="divide-y divide-border/30">
                  {paginatedRequests.map((req) => (
                    <div
                      key={req.user_id}
                      className="grid grid-cols-[minmax(200px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_100px_160px] gap-6 px-4 py-3 items-center transition-colors hover:bg-foreground/[0.02]"
                    >
                      {/* User */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                          {req.user_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">{req.user_id}</p>
                      </div>

                      {/* Daily Usage */}
                      <div className="text-right flex flex-col items-end justify-center gap-1">
                        {req.status === 'approved' ? (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    (100 - req.daily_count) <= 20 ? 'bg-destructive' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.max(0, 100 - req.daily_count)}%` }}
                                />
                              </div>
                              <span className={`font-mono text-[10px] font-bold ${
                                (100 - req.daily_count) <= 20 ? 'text-destructive' : 'text-emerald-500'
                              }`}>
                                {req.daily_count} <span className="text-muted-foreground font-normal">/ 100</span>
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>

                      {/* Requested At */}
                      <div className="text-right text-xs text-muted-foreground flex items-center justify-end">
                        {formatDate(req.created_at)}
                      </div>

                      {/* Status */}
                      <div className="text-right flex items-center justify-end">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-bold ${
                          req.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                          req.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdateStatus(req.user_id, "approved")}
                          disabled={updating !== null || req.status === "approved"}
                          className="flex items-center justify-center h-8 w-8 sm:w-auto sm:px-3 sm:gap-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                          title="Approve Request"
                        >
                          {updating === `${req.user_id}-approved` ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          <span className="hidden sm:inline">Approve</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(req.user_id, "rejected")}
                          disabled={updating !== null || req.status === "rejected"}
                          className="flex items-center justify-center h-8 w-8 sm:w-auto sm:px-3 sm:gap-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                          title="Reject Request"
                        >
                          {updating === `${req.user_id}-rejected` ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                          <span className="hidden sm:inline">Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredRequests.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No results found for your search/filter criteria.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[10px] text-muted-foreground font-mono">
                {filteredRequests.length} request{filteredRequests.length !== 1 ? "s" : ""} total
              </p>
              {filteredRequests.length > ITEMS_PER_PAGE && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-[11px] font-mono text-muted-foreground w-12 text-center">
                    {page} / {Math.ceil(filteredRequests.length / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(Math.ceil(filteredRequests.length / ITEMS_PER_PAGE), p + 1))}
                    disabled={page >= Math.ceil(filteredRequests.length / ITEMS_PER_PAGE)}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="size-4 rotate-180" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
