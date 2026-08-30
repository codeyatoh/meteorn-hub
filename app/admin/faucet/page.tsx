"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Droplets, ShieldAlert, Loader2, PenTool, SearchIcon, ChevronDownIcon,
  ExternalLink, AlertTriangle, ChevronLeft, ChevronRight, Maximize2, SlidersHorizontal
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { PageContainer } from "@/components/ui/page-container";

// ─── Types ───────────────────────────────────────────────────────────────────
interface FaucetUser {
  user_id: string;
  nickname?: string;
  email?: string;
  total_donated: number;
  total_claimed: number;
  claims_today: number;
}

interface FaucetClaim {
  id: string;
  user_id: string;
  wallet_address: string;
  tx_hash: string;
  created_at: string;
  status?: 'processing' | 'success' | 'failed';
  error_message?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }: {
  label: string; value: string; sub?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{label}</div>
        {icon}
      </div>
      <div className="font-heading text-2xl text-foreground">{value}</div>
      {sub && <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PaginationControls({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40 px-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="text-[10px] font-mono text-muted-foreground">{currentPage} / {totalPages}</div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminFaucetPage() {
  const supabase = createClient();

  const [users, setUsers] = useState<FaucetUser[]>([]);
  const [claims, setClaims] = useState<FaucetClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Filters
  const [usersPage, setUsersPage] = useState(1);
  const [claimsPage, setClaimsPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [usersSearch, setUsersSearch] = useState("");
  const [claimsSearch, setClaimsSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "donators" | "claimers" | "at_risk">("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Manual Credit Form
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditTxHash, setCreditTxHash] = useState("");
  const [isCrediting, setIsCrediting] = useState(false);

  // Withdraw Form
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Adjust Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetUser, setAdjustTargetUser] = useState<FaucetUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: usersData } = await supabase.from("faucet_user_stats").select("*");
      if (usersData) setUsers(usersData as FaucetUser[]);

      const { data: claimsData } = await supabase
        .from("faucet_claims")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (claimsData) setClaims(claimsData as FaucetClaim[]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load faucet stats.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleManualCredit = async () => {
    if (!creditUserId || !creditAmount || !creditTxHash) {
      toast.error("All fields are required.");
      return;
    }
    setIsCrediting(true);
    try {
      const { error } = await supabase.from("faucet_donations").insert({
        user_id: creditUserId,
        tx_hash: creditTxHash.toLowerCase().trim(),
        amount: parseFloat(creditAmount),
      });
      if (error) throw error;
      toast.success("Successfully credited user!");
      setCreditUserId(""); setCreditAmount(""); setCreditTxHash("");
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to credit donation.");
    } finally {
      setIsCrediting(false);
    }
  };

  const handleAdjustSubmit = async () => {
    if (!adjustTargetUser || !adjustAmount) return;
    setIsAdjusting(true);
    try {
      const { error } = await supabase.from("faucet_donations").insert({
        user_id: adjustTargetUser.user_id,
        tx_hash: "admin_adjustment_" + Date.now(),
        amount: -Math.abs(parseFloat(adjustAmount)),
      });
      if (error) throw error;
      toast.success("Balance adjusted successfully!");
      setIsAdjustModalOpen(false);
      setAdjustAmount("");
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to adjust balance.");
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleWithdraw = () => {
    if (!withdrawAddress || !withdrawAmount) {
      toast.error("Destination address and amount are required.");
      return;
    }
    toast.error("Withdrawal execution is not yet wired to a live transaction. Contact the developer.");
  };

  const totalPoolDonated = users.reduce((acc, u) => acc + (Number(u.total_donated) || 0), 0);
  const totalDevCut = totalPoolDonated * 0.3;

  const filteredUsers = users.filter((u) => {
    const term = usersSearch.toLowerCase();
    const matchSearch =
      u.nickname?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.user_id.toLowerCase().includes(term);
    let matchFilter = true;
    if (statusFilter === "donators") matchFilter = u.total_donated > 0;
    else if (statusFilter === "claimers") matchFilter = u.total_claimed > 0;
    else if (statusFilter === "at_risk") {
      const maxClaimable = u.total_donated * 0.7;
      matchFilter = maxClaimable - u.total_claimed <= 0.05 && u.total_donated > 0;
    }
    return matchSearch && matchFilter;
  });

  const filteredClaims = claims.filter((c) => {
    const term = claimsSearch.toLowerCase();
    return (
      c.wallet_address?.toLowerCase().includes(term) ||
      c.tx_hash?.toLowerCase().includes(term) ||
      c.user_id?.toLowerCase().includes(term)
    );
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center">
        <div style={{ width: 180, height: 80 }}>
          <WanderingEyes className="h-full w-full [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
        </div>
      </div>
    );
  }

  return (
    <PageContainer innerClassName="space-y-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
              <span>•</span>
              <span className="text-primary font-bold">FAUCET ADMIN</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="mt-1 font-heading text-4xl tracking-tight text-foreground">Faucet Control Center</h1>
</div>
            <p className="mt-2 max-w-xl text-muted-foreground text-sm">
              Manage the Hot Wallet, adjust user balances, and monitor global outflows.
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="Total Global Donated"
            value={`${totalPoolDonated.toFixed(2)} POL`}
            sub="All time network deposits"
            icon={<Droplets className="size-4 text-primary opacity-60" />}
          />
          <StatCard
            label="Available Dev Cut (30%)"
            value={`${totalDevCut.toFixed(2)} POL`}
            sub="Ready for withdrawal to maintenance wallet"
            icon={<ShieldAlert className="size-4 text-primary opacity-60" />}
          />
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-background/40 border border-border/60">
            <TabsTrigger value="users">User Monitoring</TabsTrigger>
            <TabsTrigger value="claims">Global Claims Log</TabsTrigger>
            <TabsTrigger value="credit">Manual Credit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          {/* ── User Monitoring Tab ── */}
          <TabsContent value="users">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    value={usersSearch}
                    onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }}
                    className="w-full bg-background border border-input rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                    placeholder="Search by name, email, or ID..."
                  />
                </div>
                <div className="relative w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className={`w-full sm:w-40 flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${isFilterDropdownOpen ? 'ring-1 ring-primary border-primary' : 'hover:bg-foreground/[0.02]'}`}
                  >
                    <span className="capitalize">{statusFilter.replace('_', ' ')}</span>
                    <ChevronDownIcon className={`size-4 text-muted-foreground transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isFilterDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} />
                      <div className="absolute z-50 top-full right-0 mt-2 w-48 bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex flex-col py-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-1.5">Filter</span>
                          {([
                            { value: 'all', label: 'All Users' },
                            { value: 'donators', label: 'Donators Only' },
                            { value: 'claimers', label: 'Claimers Only' },
                            { value: 'at_risk', label: 'At Risk (Negative)' },
                          ] as { value: "all" | "donators" | "claimers" | "at_risk"; label: string }[]).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => { setStatusFilter(opt.value); setUsersPage(1); setIsFilterDropdownOpen(false); }}
                              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors outline-none ${statusFilter === opt.value ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'}`}
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

              {filteredUsers.length === 0 ? (
                <div className="flex h-[30vh] items-center justify-center text-sm text-muted-foreground">No matching users found.</div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden pb-4">
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="grid grid-cols-[minmax(180px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_80px_100px_80px] gap-4 px-4 py-3 border-b border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                        <span>User</span>
                        <span className="text-right">Donated</span>
                        <span className="text-right">Claimed</span>
                        <span className="text-right">Today</span>
                        <span className="text-right">Remaining</span>
                        <span className="text-center">Action</span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {filteredUsers.slice((usersPage - 1) * ITEMS_PER_PAGE, usersPage * ITEMS_PER_PAGE).map((u) => {
                          const remaining = Math.max(0, (u.total_donated * 0.7) - u.total_claimed);
                          const isAtRisk = remaining < 0.05;
                          return (
                            <div key={u.user_id} className="grid grid-cols-[minmax(180px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_80px_100px_80px] gap-4 px-4 py-3 items-center hover:bg-foreground/[0.02] transition-colors">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{u.nickname || "Unknown"}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{u.email || u.user_id}</p>
                              </div>
                              <div className="text-right font-mono text-sm">{Number(u.total_donated).toFixed(2)} POL</div>
                              <div className="text-right font-mono text-sm">{Number(u.total_claimed).toFixed(2)} POL</div>
                              <div className="text-right font-mono text-sm">{u.claims_today}</div>
                              <div className={`text-right font-mono text-sm ${isAtRisk ? "text-destructive font-bold" : "text-primary"}`}>
                                {remaining.toFixed(2)} POL
                              </div>
                              <div className="text-center flex justify-center">
                                <button
                                  type="button"
                                  title="Adjust Balance"
                                  onClick={() => { setAdjustTargetUser(u); setIsAdjustModalOpen(true); }}
                                  className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all"
                                >
                                  <SlidersHorizontal className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <PaginationControls currentPage={usersPage} totalPages={Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)} onPageChange={setUsersPage} />
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Global Claims Log Tab ── */}
          <TabsContent value="claims">
            <div className="space-y-4">
              <div className="relative w-full max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  value={claimsSearch}
                  onChange={(e) => { setClaimsSearch(e.target.value); setClaimsPage(1); }}
                  className="w-full bg-background border border-input rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                  placeholder="Search by wallet, txhash, or user ID..."
                />
              </div>

              {filteredClaims.length === 0 ? (
                <div className="flex h-[30vh] items-center justify-center text-sm text-muted-foreground">No claims found.</div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden pb-4">
                  <div className="overflow-x-auto">
                    <div className="min-w-[700px]">
                      <div className="grid grid-cols-[140px_minmax(140px,1.5fr)_minmax(160px,1.5fr)_minmax(160px,2fr)_90px] gap-4 px-4 py-3 border-b border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                        <span>Time</span>
                        <span>User ID</span>
                        <span>Address Funded</span>
                        <span>TxHash</span>
                        <span className="text-right">Status</span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {filteredClaims.slice((claimsPage - 1) * ITEMS_PER_PAGE, claimsPage * ITEMS_PER_PAGE).map((c) => {
                          const status = c.status ?? 'success';
                          return (
                            <div key={c.id} className="grid grid-cols-[140px_minmax(140px,1.5fr)_minmax(160px,1.5fr)_minmax(160px,2fr)_90px] gap-4 px-4 py-3 items-center hover:bg-foreground/[0.02] transition-colors">
                              <div className="text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </div>
                              <div className="font-mono text-[11px] truncate text-muted-foreground" title={c.user_id}>
                                {c.user_id?.slice(0, 12)}...
                              </div>
                              <div className="font-mono text-[11px] text-primary truncate" title={c.wallet_address}>
                                {c.wallet_address}
                              </div>
                              <div>
                                {c.tx_hash && c.tx_hash !== 'pending' ? (
                                  <a
                                    href={`https://polygonscan.com/tx/${c.tx_hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 group transition-colors"
                                    title={c.tx_hash}
                                  >
                                    <span className="truncate">{c.tx_hash?.slice(0, 20)}...{c.tx_hash?.slice(-12)}</span>
                                    <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                ) : (
                                  <span className="font-mono text-[10px] text-muted-foreground/50">—</span>
                                )}
                              </div>
                              {/* Status Badge */}
                              <div className="flex justify-end">
                                {status === 'processing' && (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                    <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    Processing
                                  </span>
                                )}
                                {status === 'success' && (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                    <span className="size-1.5 rounded-full bg-emerald-400" />
                                    Success
                                  </span>
                                )}
                                {status === 'failed' && (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20" title={c.error_message}>
                                    <span className="size-1.5 rounded-full bg-red-400" />
                                    Failed
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <PaginationControls currentPage={claimsPage} totalPages={Math.ceil(filteredClaims.length / ITEMS_PER_PAGE)} onPageChange={setClaimsPage} />
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Manual Credit Tab ── */}
          <TabsContent value="credit">
            <div className="max-w-2xl space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-widest mb-3">
                  <PenTool className="size-3" />
                  Manual Override
                </div>
                <h2 className="font-heading text-2xl text-foreground">Manual Credit Override</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Bypass automated chain verification and instantly credit a user&apos;s donation balance.
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-500">Use with caution</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This action directly modifies a user&apos;s donation record without blockchain verification. Only use for verified off-chain transfers or admin corrections. All overrides are permanently logged.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Target User</p>
                  <p className="text-[11px] text-muted-foreground">Enter the Supabase Auth UUID of the user you want to credit.</p>
                </div>
                <div className="h-px bg-border/40" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">User ID (UUID)</label>
                    <Input className="bg-background/60 font-mono text-sm" value={creditUserId} onChange={(e) => setCreditUserId(e.target.value)} placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Amount (POL)</label>
                      <Input className="bg-background/60" type="number" step="0.01" min="0" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="e.g. 5.0" />
                    </div>
                    <div className="space-y-2">
                      <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">TxHash Proof</label>
                      <Input className="bg-background/60 font-mono text-xs" value={creditTxHash} onChange={(e) => setCreditTxHash(e.target.value)} placeholder="0x..." />
                    </div>
                  </div>
                </div>
                <div className="h-px bg-border/40" />
                <Button
                  className="w-full font-mono uppercase tracking-wider text-xs"
                  onClick={handleManualCredit}
                  disabled={isCrediting || !creditUserId || !creditAmount || !creditTxHash}
                >
                  {isCrediting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Execute Override"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Withdraw Tab ── */}
          <TabsContent value="withdraw">
            <div className="max-w-2xl space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-mono uppercase tracking-widest mb-3">
                  <ShieldAlert className="size-3" />
                  Hot Wallet Access
                </div>
                <h2 className="font-heading text-2xl text-foreground">Withdraw Dev Cut</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Extract your 30% maintenance and server costs directly from the Hot Wallet.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Available Dev Cut</p>
                  <p className="font-heading text-2xl text-foreground">{totalDevCut.toFixed(4)} <span className="text-lg text-muted-foreground">POL</span></p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">30% of {totalPoolDonated.toFixed(4)} POL total donated</p>
                </div>
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5 text-primary" />
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This action connects directly to the Hot Wallet via Ethers.js and executes a <strong className="text-foreground">live mainnet transaction</strong>. The transaction is irreversible. Proceed with caution.
                </p>
              </div>

              <div className="rounded-xl border border-destructive/20 bg-background/40 p-6 space-y-5">
                <div className="space-y-2">
                  <label className="font-mono text-[10px] text-destructive uppercase tracking-[0.25em]">Destination Polygon Address</label>
                  <Input className="bg-background/60 font-mono text-sm" placeholder="0x..." value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] text-destructive uppercase tracking-[0.25em]">Amount (POL)</label>
                  <div className="relative">
                    <Input
                      className="bg-background/60 pr-20"
                      type="number"
                      step="0.0001"
                      min="0"
                      max={totalDevCut}
                      placeholder={`Max: ${totalDevCut.toFixed(4)}`}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(totalDevCut.toFixed(4))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Maximize2 className="size-2.5" />
                      MAX
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Available: <span className="text-foreground font-mono">{totalDevCut.toFixed(4)} POL</span>
                  </p>
                </div>
                <div className="h-px bg-border/40" />
                <Button
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono uppercase tracking-wider text-xs"
                  onClick={handleWithdraw}
                  disabled={!withdrawAddress || !withdrawAmount}
                >
                  Execute Withdrawal
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Adjust Modal */}
        <AnimatedModal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} title="Adjust Balance" icon={<SlidersHorizontal size={18} strokeWidth={1.5} />}>
          <div className="space-y-6 w-full">
            <p className="text-sm text-muted-foreground mt-1">Deduct from {adjustTargetUser?.nickname || adjustTargetUser?.user_id}</p>
            <div className="space-y-4">
              <div className="p-3 rounded bg-foreground/5 space-y-1">
                <p className="text-xs text-muted-foreground font-mono">Current Donated: {Number(adjustTargetUser?.total_donated).toFixed(2)} POL</p>
                <p className="text-xs text-muted-foreground font-mono">Total Claimed: {Number(adjustTargetUser?.total_claimed).toFixed(2)} POL</p>
              </div>
              <div className="space-y-2">
                <label className="font-mono text-[10px] text-destructive uppercase tracking-[0.25em]">Penalty Amount (POL)</label>
                <Input type="number" placeholder="e.g. 5.0" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">This amount will be deducted from their total donations, stripping them of their tier and claimable balance.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setIsAdjustModalOpen(false)}>Cancel</Button>
                <Button variant="destructive" className="flex-1 font-mono uppercase tracking-wider text-xs" onClick={handleAdjustSubmit} disabled={isAdjusting || !adjustAmount}>
                  {isAdjusting ? "Executing..." : "Apply Penalty"}
                </Button>
              </div>
            </div>
          </div>
        </AnimatedModal>

    </PageContainer>
  );
}
