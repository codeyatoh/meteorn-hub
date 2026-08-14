"use client";

import { useEffect, useState } from "react";
import { GamepadIcon, Loader2, RotateCcwIcon, PencilIcon, CheckIcon, XIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";

type AdminAccount = {
  id: number;
  user_id: string;
  owner_name: string;
  name: string;
  tickets_done: number;
  total_tickets: number;
  avatar: string;
  referral_link: string | null;
  created_at: string;
  is_banned: boolean;
};

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const ITEMS_PER_PAGE = 8;

  // Inline quota edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/accounts").then(res => res.json()),
      new Promise(resolve => setTimeout(resolve, 1000))
    ])
      .then(([data]) => {
        if (Array.isArray(data)) setAccounts(data);
        else toast.error("Failed to load accounts.", { classNames: { icon: "text-destructive" } });
      })
      .catch(() => toast.error("Network error.", { classNames: { icon: "text-destructive" } }))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (account: AdminAccount) => {
    setEditingId(account.id);
    setEditValue(String(account.total_tickets));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveQuota = async (id: number) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 1 || val > 100) return;

    setSavingId(id);
    const res = await fetch(`/api/admin/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_tickets: val }),
    });

    if (res.ok) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, total_tickets: val } : a))
      );
      toast.success("Quota updated successfully.", { classNames: { icon: "text-green-500" } });
      setEditingId(null);
    } else {
      toast.error("Failed to update quota.", { classNames: { icon: "text-destructive" } });
    }
    setSavingId(null);
  };

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
              <GamepadIcon className="size-3 mr-2" />
              Accounts
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">All Game Accounts</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Platform-wide view of every game account. Edit quotas or manually reset tickets.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-full border border-border/60 bg-background/50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {loading ? (
          <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
            <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex h-[30vh] items-center justify-center text-sm text-muted-foreground">
            No game accounts found.
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 px-4 py-3 border-b border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              <span>Account</span>
              <span className="text-center hidden sm:block">Progress</span>
              <span className="text-center">Quota</span>
              <span className="text-right">Status</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/30 overflow-x-auto">
              <div className="min-w-[600px] sm:min-w-0">
              {(() => {
                const filteredAccounts = accounts.filter(acc => 
                  acc.name.toLowerCase().includes(search.toLowerCase()) || 
                  acc.owner_name.toLowerCase().includes(search.toLowerCase())
                );
                return filteredAccounts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((acc) => {
                const pct = acc.total_tickets > 0
                  ? Math.min(100, Math.round((acc.tickets_done / acc.total_tickets) * 100))
                  : 0;
                const isEditing = editingId === acc.id;

                return (
                  <div
                    key={acc.id}
                    className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-foreground/[0.02] transition-colors"
                  >
                    {/* Account info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        <Image
                          src={`/${acc.avatar}.png`}
                          alt={acc.avatar}
                          width={32}
                          height={32}
                          className="size-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{acc.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          owned by {acc.owner_name}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="hidden sm:flex items-center gap-2 w-28">
                      <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                        {pct}%
                      </span>
                    </div>

                    {/* Quota editor */}
                    <div className="flex items-center justify-center gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-16 rounded-md border border-input bg-background/50 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveQuota(acc.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <button
                            onClick={() => saveQuota(acc.id)}
                            disabled={savingId === acc.id}
                            className="text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-50"
                          >
                            {savingId === acc.id
                              ? <Loader2 className="size-3.5 animate-spin" />
                              : <CheckIcon className="size-3.5" />
                            }
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm text-foreground">
                            {acc.tickets_done}
                          </span>
                          <span className="text-muted-foreground text-xs">/</span>
                          <span className="font-mono text-sm text-muted-foreground">
                            {acc.total_tickets}
                          </span>
                          <button
                            onClick={() => startEdit(acc)}
                            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit quota"
                          >
                            <PencilIcon className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Status column */}
                    <div className="text-right flex items-center justify-end">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${acc.is_banned ? 'border-red-500/20 bg-red-500/5 text-red-500' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500'}`}>
                        <span className={`size-1.5 rounded-full ${acc.is_banned ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        <span className="text-[10px] font-mono uppercase tracking-widest">
                          {acc.is_banned ? 'Banned' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
              })()}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground">
                {accounts.filter(acc => acc.name.toLowerCase().includes(search.toLowerCase()) || acc.owner_name.toLowerCase().includes(search.toLowerCase())).length} account(s) found
              </div>
              
              {accounts.filter(acc => acc.name.toLowerCase().includes(search.toLowerCase()) || acc.owner_name.toLowerCase().includes(search.toLowerCase())).length > ITEMS_PER_PAGE && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <span className="text-[10px] font-mono text-muted-foreground min-w-[3rem] text-center">
                    {page} / {Math.ceil(accounts.filter(acc => acc.name.toLowerCase().includes(search.toLowerCase()) || acc.owner_name.toLowerCase().includes(search.toLowerCase())).length / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(accounts.filter(acc => acc.name.toLowerCase().includes(search.toLowerCase()) || acc.owner_name.toLowerCase().includes(search.toLowerCase())).length / ITEMS_PER_PAGE), p + 1))}
                    disabled={page === Math.ceil(accounts.filter(acc => acc.name.toLowerCase().includes(search.toLowerCase()) || acc.owner_name.toLowerCase().includes(search.toLowerCase())).length / ITEMS_PER_PAGE)}
                    className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRightIcon className="size-4" />
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
