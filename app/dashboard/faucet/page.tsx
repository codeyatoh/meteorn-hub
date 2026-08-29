"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Droplets, CopyIcon, CheckIcon, Activity, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { getTierLimits, TIER_TABLE } from "@/lib/utils/tiers";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { PieChart, Pie, Cell, Label } from "recharts";

interface FaucetClaim {
  id: string;
  user_id: string;
  wallet_address: string;
  tx_hash?: string;
  created_at: string;
}

// ── Recharts Donut Chart ─────────────────────────────────────────────────────
const donutChartConfig = {
  claimable: {
    label: "Claimable (70%)",
    color: "#6366f1", // primary
  },
  devcut: {
    label: "Dev Cut (30%)",
    color: "#64748b", // slate-500
  },
  unused: {
    label: "Unclaimed",
    color: "#312e81", // dim primary
  },
} satisfies ChartConfig;

function DonutChart({ claimable, devCut, total }: { claimable: number; devCut: number; total: number }) {
  if (total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 w-[140px] h-[140px]">
        <div className="size-16 rounded-full border-4 border-border/20 flex items-center justify-center">
          <Droplets className="size-5 text-muted-foreground/40" />
        </div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">No donations yet</p>
      </div>
    );
  }

  const claimed = total - claimable - devCut < 0 ? 0 : total - claimable - devCut;
  const data = [
    { name: "claimable", value: parseFloat(claimable.toFixed(4)) },
    { name: "devcut",    value: parseFloat(devCut.toFixed(4)) },
    { name: "unused",    value: parseFloat(claimed.toFixed(4)) },
  ].filter((d) => d.value > 0);

  return (
    <ChartContainer config={donutChartConfig} className="h-[140px] w-[140px]">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              formatter={(value) => `${Number(value).toFixed(4)} POL`}
            />
          }
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={44}
          outerRadius={58}
          paddingAngle={3}
          cornerRadius={4}
          strokeWidth={0}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={`var(--color-${entry.name})`} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-lg font-bold font-heading"
                    >
                      {total.toFixed(1)}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 16}
                      className="fill-muted-foreground text-[9px] font-mono uppercase tracking-wider"
                    >
                      POL
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" className="hidden" />} />
      </PieChart>
    </ChartContainer>
  );
}

export default function FaucetPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [currency, setCurrency] = useState("usd");
  const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", php: "₱", eur: "€" };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user?.user_metadata?.currency) {
        setCurrency(data.user.user_metadata.currency);
      }
    });
  }, [supabase.auth]);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ total_donated: number; total_claimed: number; claims_today: number } | null>(null);
  const [claimHistory, setClaimHistory] = useState<FaucetClaim[]>([]);
  const [addressInput, setAddressInput] = useState("");
  const [txHashInput, setTxHashInput] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hotWalletAddress, setHotWalletAddress] = useState("Loading...");
  const [isTiersModalOpen, setIsTiersModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Live POL price
  const [polPrices, setPolPrices] = useState<{ usd: number; php: number; eur: number }>({ usd: 0.45, php: 25, eur: 0.41 });

  // Claim history pagination
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPerPage, setHistoryPerPage] = useState(5);

  // Validation State
  const [addressValidation, setAddressValidation] = useState<{ status: 'idle' | 'valid' | 'invalid' | 'used' | 'checking'; message: string }>({ status: 'idle', message: '' });

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: statsRes2, error: statsErr } = await supabase
        .from("faucet_user_stats")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const statsResData = statsRes2;
      const statsResError = statsErr;

      const [historyRes, walletRes, priceRes] = await Promise.all([
        supabase.from("faucet_claims").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
        fetch('/api/faucet/info'),
        fetch('/api/pol-price'),
      ]);

      if (statsResError && statsResError.code !== "PGRST116") throw statsResError;
      setStats(statsResData || { total_donated: 0, total_claimed: 0, claims_today: 0 });

      if (historyRes.data) setClaimHistory(historyRes.data);

      const info = await walletRes.json();
      setHotWalletAddress(info.address);

      const prices = await priceRes.json();
      if (prices && !prices.error) setPolPrices(prices);
    } catch (error) {
      console.error("Failed to load stats:", error);
      toast.error("Failed to load faucet stats.");
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Debounced Address Validation
  useEffect(() => {
    const validateAddress = async () => {
      if (!addressInput) { setAddressValidation({ status: 'idle', message: '' }); return; }
      if (!ethers.isAddress(addressInput)) { setAddressValidation({ status: 'invalid', message: 'Invalid Polygon address format.' }); return; }
      setAddressValidation({ status: 'checking', message: 'Checking address...' });
      try {
        const res = await fetch(`/api/faucet/check-address?address=${addressInput}`);
        const data = await res.json();
        if (data.used) {
          setAddressValidation({ status: 'used', message: 'Address already funded.' });
        } else {
          setAddressValidation({ status: 'valid', message: 'Valid and eligible!' });
        }
      } catch {
        setAddressValidation({ status: 'idle', message: 'Could not verify address.' });
      }
    };
    const timeoutId = setTimeout(validateAddress, 500);
    return () => clearTimeout(timeoutId);
  }, [addressInput]);

  const handleClaim = async () => {
    if (!user) return;
    if (addressValidation.status !== 'valid') { toast.error("Please enter a valid, unused Polygon address."); return; }
    setIsClaiming(true);
    try {
      const res = await fetch("/api/faucet/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: [addressInput], userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim funds.");
      toast.success(data.message);
      setAddressInput("");
      fetchData();
    } catch (error: unknown) {
      toast.error((error as Error).message || "An error occurred");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleVerifyDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !txHashInput) return;
    setIsVerifying(true);
    try {
      const res = await fetch("/api/faucet/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: txHashInput, userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");
      toast.success(data.message);
      setTxHashInput("");
      fetchData();
    } catch (error: unknown) {
      toast.error((error as Error).message || "An error occurred");
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success("Wallet address copied!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const totalDonated = stats?.total_donated || 0;
  const totalClaimed = stats?.total_claimed || 0;
  const claimsToday = stats?.claims_today || 0;

  const claimableBalance = Math.max(0, (totalDonated * 0.7) - totalClaimed);
  const devCutPortion = totalDonated * 0.3;
  const { faucetLimit: maxDaily } = getTierLimits(totalDonated);
  const claimsLeftToday = Math.max(0, maxDaily - claimsToday);

  // Price
  const polPrice = polPrices[currency as keyof typeof polPrices] || polPrices.usd;
  const currencySymbol = CURRENCY_SYMBOLS[currency] || "$";
  const toFiat = (pol: number) => `${currencySymbol}${(pol * polPrice).toFixed(2)}`;

  const fillPercentage = maxDaily > 0 ? Math.max(0, ((maxDaily - claimsToday) / maxDaily) * 100) : 0;

  // Paginated history
  const totalHistoryPages = Math.ceil(claimHistory.length / historyPerPage);
  const pagedHistory = claimHistory.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage);

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
    <div className="px-4 sm:px-6 py-10 relative min-h-screen">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
            <Droplets className="size-3 mr-2" />
            POL FAUCET
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Community Faucet</h1>
          <p className="mt-2 text-muted-foreground text-sm max-w-2xl">
            Fund your wallets instantly using the decentralized community pool.
            Contribute to the pool to unlock higher claims and exclusive Temp Mail limits.
          </p>
          <button onClick={() => setIsTiersModalOpen(true)} className="mt-4 text-xs font-medium text-primary hover:underline flex items-center gap-1">
            <Activity className="size-3" /> View Donation Tiers & Limits
          </button>
        </div>

        {/* ── Main Stats Card ── */}
        <div className="rounded-2xl border border-border/40 bg-background/20 p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none -z-10" />

          <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8 border-b border-border/40 pb-6">
            {/* Left: Text stats */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Lifetime Donated</div>
                <div className="text-3xl font-heading text-foreground">
                  {totalDonated.toFixed(2)} <span className="text-xl text-muted-foreground">POL</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">≈ {toFiat(totalDonated)}</div>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Claimable Balance</div>
                <div className="text-xl font-heading text-primary">
                  {claimableBalance.toFixed(2)} <span className="text-sm text-primary/70">POL</span>
                </div>
                <div className="text-xs text-primary/70 mt-0.5">≈ {toFiat(claimableBalance)}</div>
              </div>
            </div>

            {/* Center: Donut Chart */}
            <div className="flex flex-col items-center gap-3">
              <DonutChart claimable={claimableBalance} devCut={devCutPortion} total={totalDonated} />
              <div className="flex flex-col gap-1.5 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-primary inline-block" />
                  <span className="text-muted-foreground">Claimable (70%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-foreground/30 inline-block" />
                  <span className="text-muted-foreground">Dev Cut (30%)</span>
                </div>
              </div>
            </div>

            {/* Right: Daily limit tracker */}
            <div className="flex flex-col items-start md:items-end gap-1.5 p-4 rounded-xl border border-border/40 bg-background/40">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center">
                <Activity className="size-3 mr-1 opacity-50" />
                Daily Limit Tracker
              </div>
              <div className="flex flex-col items-start md:items-end gap-1 mt-1">
                <div className="w-32 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${fillPercentage <= 20 ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${fillPercentage}%` }}
                  />
                </div>
                <div className={`font-mono text-xs font-bold ${fillPercentage <= 20 ? 'text-destructive' : 'text-primary'}`}>
                  {claimsLeftToday} / {maxDaily} left
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            {/* Auto-Claim Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="size-4 text-primary" />
                <h2 className="text-lg font-heading text-foreground">Auto-Claim POL</h2>
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                Enter your Polygon address to instantly receive 0.05 POL for gas fees. No manual approval required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Droplets className="size-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    className={`h-10 w-full rounded-md border bg-background/40 pl-9 pr-4 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/50 ${
                      addressValidation.status === 'valid' ? 'border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary' :
                      addressValidation.status === 'invalid' || addressValidation.status === 'used' ? 'border-destructive/50 focus:border-destructive focus:ring-1 focus:ring-destructive' : 'border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/50'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {addressValidation.status === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {addressValidation.status === 'valid' && <Activity className="h-4 w-4 text-primary" />}
                  </div>
                </div>

                <div className="sm:w-[160px]">
                  <Button
                    onClick={handleClaim}
                    disabled={isClaiming || addressValidation.status !== 'valid' || claimsLeftToday <= 0 || claimableBalance < 0.05}
                    className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  >
                    {isClaiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {claimableBalance < 0.05 ? "Insufficient Balance" : claimsLeftToday <= 0 ? "Daily Limit Reached" : "Claim 0.05 POL"}
                  </Button>
                </div>
              </div>
              {addressValidation.message && (
                <p className={`text-[10px] font-mono tracking-widest uppercase ${
                  addressValidation.status === 'valid' ? 'text-primary' :
                  addressValidation.status === 'invalid' || addressValidation.status === 'used' ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {addressValidation.message}
                </p>
              )}
            </div>

            {/* Fund the Pool Section */}
            <div className="space-y-4 pt-6 border-t border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="size-4 text-primary" />
                <h2 className="text-lg font-heading text-foreground">Fund the Pool</h2>
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                Send POL directly to the Faucet Hot Wallet. Wait for blockchain confirmation, then submit your transaction hash to upgrade your Faucet & Temp Mail tier.
              </p>

              <div className="rounded-lg border border-border/40 bg-background/40 p-4">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest block mb-2">
                  Hot Wallet Address (Polygon)
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-sm text-primary bg-primary/10 px-3 py-2 rounded-md border border-primary/20 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {hotWalletAddress}
                  </code>
                  <button
                    className="p-2 bg-background hover:bg-foreground/5 border border-border/40 rounded-md transition-colors relative"
                    onClick={() => copyToClipboard(hotWalletAddress)}
                  >
                    <span className="sr-only">Copy address</span>
                    {isCopied ? (
                      <CheckIcon className="size-4 text-emerald-500 animate-in zoom-in spin-in-12 duration-300" />
                    ) : (
                      <CopyIcon className="size-4 text-muted-foreground hover:text-foreground animate-in zoom-in duration-300" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-amber-500/90 leading-tight">
                  <span className="font-bold">⚠️ Security Notice:</span> You must donate from a personal crypto wallet (MetaMask, TrustWallet, etc). Do NOT send funds directly from an exchange (Binance, GCrypto) or your donation cannot be verified due to our anti-fraud systems.
                </p>
              </div>

              <form onSubmit={handleVerifyDonation} className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <ArrowRight className="size-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Transaction Hash (0x...)"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    className="h-10 w-full rounded-md border border-border/60 bg-background/40 pl-9 pr-4 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="sm:w-[160px]">
                  <Button
                    type="submit"
                    disabled={isVerifying || !txHashInput}
                    className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  >
                    {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify TxID
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ── Claim History ── */}
        {claimHistory.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg text-foreground">Claim History</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Your past POL claims from the faucet pool.</p>
              </div>
              
              <div className="flex items-center gap-1.5 p-1 rounded-md border border-border/40 bg-background/40">
                <span className="px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:inline-block">View</span>
                {[5, 10, 25].map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setHistoryPerPage(opt); setHistoryPage(1); }}
                    className={`h-6 px-2.5 rounded text-[11px] font-medium transition-colors ${historyPerPage === opt ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-foreground/10 hover:text-foreground'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden pb-4">
              <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                  {/* Header */}
                  <div className="grid grid-cols-[120px_minmax(160px,1.5fr)_minmax(140px,2fr)] gap-4 px-4 py-3 border-b border-border/40 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                    <span>Time</span>
                    <span>Address Funded</span>
                    <span>TxHash</span>
                  </div>

                  <div className="divide-y divide-border/30">
                    {pagedHistory.map((c) => (
                      <div key={c.id} className="grid grid-cols-[120px_minmax(160px,1.5fr)_minmax(140px,2fr)] gap-4 px-4 py-3 items-center hover:bg-foreground/[0.02] transition-colors">
                        <div className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div className="font-mono text-[11px] text-primary truncate" title={c.wallet_address}>
                          {c.wallet_address}
                        </div>
                        <div>
                          {c.tx_hash ? (
                            <a
                              href={`https://polygonscan.com/tx/${c.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 group transition-colors"
                              title={c.tx_hash}
                            >
                              <span className="truncate">{c.tx_hash.slice(0, 24)}...{c.tx_hash.slice(-24)}</span>
                              <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50 font-mono">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pagination */}
              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40 px-4">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {historyPage} / {totalHistoryPages}
                  </div>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                    disabled={historyPage === totalHistoryPages}
                    className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Tiers Modal ── */}
      <AnimatedModal isOpen={isTiersModalOpen} onClose={() => setIsTiersModalOpen(false)} title="Donation Tiers & Limits" icon={<Droplets size={18} strokeWidth={1.5} />} maxWidth="md">
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3 pr-4 font-medium">Lifetime Donated</th>
                  <th className="py-3 px-4 font-medium">Faucet Claims</th>
                  <th className="py-3 px-4 font-medium">Temp Mail Quota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-muted-foreground">
                {TIER_TABLE.map((tier, i) => {
                  const isCurrentTier = totalDonated >= tier.min && (i === TIER_TABLE.length - 1 || totalDonated < TIER_TABLE[i + 1].min);
                  return (
                    <tr key={tier.min} className={`hover:bg-foreground/5 transition-colors ${isCurrentTier ? 'bg-primary/5' : ''}`}>
                      <td className={`py-3 pr-4 font-medium whitespace-nowrap ${isCurrentTier ? 'text-primary' : i === 0 ? 'text-foreground' : 'text-foreground/70'}`}>
                        {tier.min}+ POL {isCurrentTier && <span className="text-[9px] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">YOUR TIER</span>}
                      </td>
                      <td className="py-3 px-4">{tier.faucetLimit} / day</td>
                      <td className="py-3 px-4">{tier.tempMailLimit.toLocaleString()} / day</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-6 font-mono uppercase tracking-widest text-center">
            Donations are cumulative. Upgrade your tier anytime.
          </p>
        </div>
      </AnimatedModal>
    </div>
  );
}
