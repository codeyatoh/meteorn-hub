"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { UsersIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon, RefreshCcwIcon, ListFilterIcon } from "lucide-react";
import { toast } from "sonner";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { PageContainer } from "@/components/ui/page-container";

type AdminUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  account_count: number;
  total_income: number;
  sold_gmto: number;
  fiat_received: number;
  is_archived: boolean;
};

export default function MembersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [gmtoPrice, setGmtoPrice] = useState(0);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(res => res.json()),
      new Promise(resolve => setTimeout(resolve, 1000))
    ])
      .then(([data]) => {
        if (Array.isArray(data)) {
          setUsers(data.filter(u => u.role !== 'admin'));
        } else {
          toast.error("Failed to load users.", { classNames: { icon: "text-destructive" } });
        }
      })
      .catch(() => toast.error("Network error.", { classNames: { icon: "text-destructive" } }))
      .finally(() => setLoading(false));

    // Fetch GMTO price in PHP
    fetch("/api/gmto-price?currency=php")
      .then(res => res.json())
      .then(data => {
        if (data["game-meteor-coin"] && data["game-meteor-coin"]["php"]) {
          setGmtoPrice(data["game-meteor-coin"]["php"]);
        }
      })
      .catch(err => console.warn("Failed to fetch GMTO price", err));
  }, []);

  const toggleArchive = async (user: AdminUser) => {
    const newArchivedState = !user.is_archived;
    setTogglingId(user.id);

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_archived: newArchivedState } : u))
    );

    const res = await fetch(`/api/admin/users/${user.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: newArchivedState }),
    });

    if (!res.ok) {
      // Revert on failure
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_archived: user.is_archived } : u))
      );
      toast.error("Failed to update status.", { classNames: { icon: "text-destructive" } });
    } else {
      toast.success(newArchivedState ? "User archived." : "User restored.", { classNames: { icon: "text-green-500" } });
    }

    setTogglingId(null);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <PageContainer>

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
              <UsersIcon className="size-3 mr-2" />
              Members
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Registered Users</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              All users who have signed up to Meteorn Hub.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
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
                        { value: 'all', label: 'All Users' },
                        { value: 'active', label: 'Active Only' },
                        { value: 'archived', label: 'Archived Only' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setStatusFilter(opt.value as "all"|"active"|"archived");
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
        ) : users.length === 0 ? (
          <div className="flex h-[30vh] items-center justify-center text-sm text-muted-foreground">
            No registered users found.
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
            {/* Header */}
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[minmax(150px,2fr)_minmax(100px,1.2fr)_minmax(100px,1.2fr)_80px_100px_130px_80px_50px] gap-6 px-4 py-3 border-b border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                  <span>User</span>
                  <span className="text-right">Income</span>
                  <span className="text-right">Sold (P2P)</span>
                  <span className="text-right hidden sm:block">Accounts</span>
                  <span className="text-right hidden lg:block">Joined</span>
                  <span className="text-right hidden md:block">Last Seen</span>
                  <span className="text-right">Status</span>
                  <span className="text-center">Action</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/30">
                  {(() => {
                const filteredUsers = users.filter(u => {
                  const matchesSearch = (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || 
                                        (u.email || "").toLowerCase().includes(search.toLowerCase());
                  const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? !u.is_archived : u.is_archived;
                  return matchesSearch && matchesStatus;
                });
                return filteredUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((u) => (
                <div
                  key={u.id}
                  className={`grid grid-cols-[minmax(150px,2fr)_minmax(100px,1.2fr)_minmax(100px,1.2fr)_80px_100px_130px_80px_50px] gap-6 px-4 py-3 items-center transition-colors ${u.is_archived ? "opacity-50 hover:opacity-100" : "hover:bg-foreground/[0.02]"}`}
                >
                  {/* User info */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                      {u.nickname ?? "—"}
                      {u.is_archived && <span className="inline-block px-1.5 py-0.5 rounded-sm bg-destructive/10 text-destructive text-[9px] font-mono tracking-widest uppercase">Archived</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>

                  {/* Income */}
                  <div className="text-right flex flex-col items-end justify-center">
                    <div className="flex items-center gap-1.5 font-mono text-sm text-primary">
                      <Image src="/gmto.png" alt="GMTO" width={14} height={14} className="object-contain opacity-80" />
                      {u.total_income > 0 ? u.total_income.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                    </div>
                    {u.total_income > 0 && gmtoPrice > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        ≈ ₱{(u.total_income * gmtoPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  {/* Sold (P2P) */}
                  <div className="text-right flex flex-col items-end justify-center">
                    <div className="flex items-center gap-1.5 font-mono text-sm text-emerald-500">
                      <Image src="/gmto.png" alt="GMTO" width={14} height={14} className="object-contain opacity-80" />
                      {u.sold_gmto > 0 ? u.sold_gmto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                    </div>
                    {u.fiat_received > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        ₱{u.fiat_received.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  {/* Account count */}
                  <div className="text-right font-mono text-sm text-muted-foreground hidden sm:block">
                    {u.account_count}
                  </div>

                  {/* Joined */}
                  <div className="text-right text-xs text-muted-foreground hidden lg:block">
                    {formatDate(u.created_at)}
                  </div>

                  {/* Last seen */}
                  <div className="text-right text-[11px] text-muted-foreground hidden md:block">
                    {formatDateTime(u.last_sign_in_at)}
                  </div>

                  {/* Online status */}
                  <div className="text-right flex items-center justify-end">
                    {(() => {
                      const isOnline = u.last_sign_in_at && (new Date().getTime() - new Date(u.last_sign_in_at).getTime()) < 60 * 60 * 1000;
                      return (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/50 border border-border/40">
                          <span className={`size-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Action */}
                  <div className="text-center flex items-center justify-center">
                    <button
                      onClick={() => toggleArchive(u)}
                      disabled={togglingId === u.id}
                      title={u.is_archived ? "Restore user" : "Archive user"}
                      className="inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {u.is_archived ? <RefreshCcwIcon className="size-3" /> : <TrashIcon className="size-3 text-destructive" />}
                    </button>
                  </div>
                </div>
                ));
                })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground">
                {users.filter(u => {
                  const matchesSearch = (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || 
                                        (u.email || "").toLowerCase().includes(search.toLowerCase());
                  const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? !u.is_archived : u.is_archived;
                  return matchesSearch && matchesStatus;
                }).length} user(s) found
              </div>

              {users.filter(u => {
                  const matchesSearch = (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || 
                                        (u.email || "").toLowerCase().includes(search.toLowerCase());
                  const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? !u.is_archived : u.is_archived;
                  return matchesSearch && matchesStatus;
              }).length > ITEMS_PER_PAGE && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <span className="text-[10px] font-mono text-muted-foreground min-w-[3rem] text-center">
                    {page} / {Math.ceil(users.filter(u => {
                  const matchesSearch = (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || 
                                        (u.email || "").toLowerCase().includes(search.toLowerCase());
                  const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? !u.is_archived : u.is_archived;
                  return matchesSearch && matchesStatus;
                }).length / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(users.filter(u => {
                  const matchesSearch = (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || 
                                        (u.email || "").toLowerCase().includes(search.toLowerCase());
                  const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? !u.is_archived : u.is_archived;
                  return matchesSearch && matchesStatus;
                }).length / ITEMS_PER_PAGE), p + 1))}
                    disabled={page === Math.ceil(users.filter(u => {
                  const matchesSearch = (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || 
                                        (u.email || "").toLowerCase().includes(search.toLowerCase());
                  const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? !u.is_archived : u.is_archived;
                  return matchesSearch && matchesStatus;
                }).length / ITEMS_PER_PAGE)}
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
