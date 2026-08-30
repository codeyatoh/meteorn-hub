"use client";

import { useEffect, useState } from "react";
import { GamepadIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, ListFilterIcon, CheckIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { PageContainer } from "@/components/ui/page-container";

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
  total_earned: number;
};

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const ITEMS_PER_PAGE = 8;

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

  return (
    <PageContainer>

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
              <GamepadIcon className="size-3 mr-2" />
              Accounts
            </div>
            <div className="flex items-center gap-4">
              <h1 className="font-heading text-3xl sm:text-4xl text-foreground">All Game Accounts</h1>
</div>
            <p className="mt-2 text-muted-foreground text-sm">
              Platform-wide view of every game account. Edit quotas or manually reset tickets.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
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

            {/* Filter Dropdown */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="flex h-9 px-3 items-center justify-center gap-2 rounded-full border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all outline-none"
              >
                <ListFilterIcon className="size-4" />
                <span className="hidden sm:inline text-xs font-medium">Filter</span>
              </button>
              
              {isFilterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} />
                  <div className="absolute z-50 top-full right-0 mt-2 w-40 bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex flex-col py-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-1.5">Status</span>
                      {[
                        { value: 'all', label: 'All Accounts' },
                        { value: 'active', label: 'Active Only' },
                        { value: 'banned', label: 'Banned Only' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setFilterStatus(opt.value as 'all' | 'active' | 'banned');
                            setPage(1);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-foreground/5 transition-colors ${
                            filterStatus === opt.value ? 'text-foreground font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          {opt.label}
                          {filterStatus === opt.value && <CheckIcon className="size-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="fixed inset-0 z-[100] bg-background flex h-screen w-full items-center justify-center">
            <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex h-[30vh] items-center justify-center text-sm text-muted-foreground">
            No game accounts found.
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-6 px-4 py-3 border-b border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              <span>Account</span>
              <span className="text-right hidden sm:block">Progress</span>
              <span className="text-center">Quota</span>
              <span className="text-right">Earned</span>
              <span className="text-right">Status</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/30 overflow-x-auto">
              <div className="min-w-[800px]">
              {(() => {
                const filteredAccounts = accounts.filter(acc => {
                  const matchesSearch = acc.name.toLowerCase().includes(search.toLowerCase()) || 
                                        acc.owner_name.toLowerCase().includes(search.toLowerCase());
                  
                  if (!matchesSearch) return false;
                  
                  if (filterStatus === 'active') return !acc.is_banned;
                  if (filterStatus === 'banned') return acc.is_banned;
                  return true;
                });
                return filteredAccounts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((acc) => {
                const pct = acc.total_tickets > 0
                  ? Math.min(100, Math.round((acc.tickets_done / acc.total_tickets) * 100))
                  : 0;

                return (
                  <div
                    key={acc.id}
                    className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-6 px-4 py-3 items-center hover:bg-foreground/[0.02] transition-colors"
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
                    <div className="hidden sm:flex items-center gap-2 w-28 justify-end">
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

                    {/* Quota */}
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-mono text-sm text-foreground">
                        {acc.tickets_done}
                      </span>
                      <span className="text-muted-foreground text-xs">/</span>
                      <span className="font-mono text-sm text-muted-foreground">
                        {acc.total_tickets}
                      </span>
                    </div>

                    {/* Earned */}
                    <div className="text-right flex items-center justify-end gap-1.5 font-mono text-sm text-primary">
                      <Image src="/gmto.png" alt="GMTO" width={14} height={14} className="object-contain opacity-80" />
                      {acc.total_earned > 0 ? acc.total_earned.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
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
    </PageContainer>
  );
}
