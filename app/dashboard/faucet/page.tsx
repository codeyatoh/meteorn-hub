"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Droplets, CopyIcon, CheckIcon, Activity, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { GuideModal } from "@/components/ui/guide-modal";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { getTierLimits, TIER_TABLE } from "@/lib/utils/tiers";
import { NumberTicker } from "@/components/ui/number-ticker";

interface FaucetClaim {
  id: string;
  user_id: string;
  wallet_address: string;
  tx_hash?: string;
  created_at: string;
  status?: 'processing' | 'success' | 'failed';
  error_message?: string;
}


function LiquidFlaskChart({ claimable, total }: { claimable: number; total: number }) {
  if (total <= 0) {
    return (
      <div className="rounded-xl border border-border/20 bg-background/40 p-5 flex flex-col items-center justify-center gap-2 w-[180px] h-[220px]">
        <div className="size-16 rounded-full border-4 border-border/20 flex items-center justify-center">
          <Droplets className="size-5 text-muted-foreground/40" />
        </div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider text-center mt-2">No donations yet</p>
      </div>
    );
  }

  const claimedAndCut = total - claimable < 0 ? 0 : total - claimable;
  // Calculate percentage of remaining claimable funds in the pool
  const levelPct = Math.max(0, Math.min(100, (claimable / total) * 100));

  // Liquid starts at y=113 (bottom of inner spherical bulb) and goes up to y=25 (top neck inside)
  // Total vertical range is 88 units.
  const y_liquid = 113 - (levelPct / 100) * 88;

  const wavePath = (y: number, waveHeight = 3) => {
    return `M -100,${y} 
            Q -87.5,${y - waveHeight} -75,${y} 
            T -50,${y} 
            T -25,${y} 
            T 0,${y} 
            T 25,${y} 
            T 50,${y} 
            T 75,${y} 
            T 100,${y} 
            T 125,${y} 
            T 150,${y} 
            T 175,${y} 
            T 200,${y} 
            L 200,130 L -100,130 Z`;
  };

  return (
    <div className="rounded-xl border border-border/40 bg-background/20 p-3.5 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center gap-3 w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wave-swim-fast {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100px); }
        }
        @keyframes wave-swim-slow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50px); }
        }
        @keyframes bubble-float {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-75px) scale(0.4);
            opacity: 0;
          }
        }
        .animate-wave-fast {
          animation: wave-swim-fast 3s linear infinite;
        }
        .animate-wave-slow {
          animation: wave-swim-slow 5s linear infinite;
        }
        .animate-bubble-1 {
          animation: bubble-float 4s ease-in-out infinite;
        }
        .animate-bubble-2 {
          animation: bubble-float 5s ease-in-out infinite 1.5s;
        }
        .animate-bubble-3 {
          animation: bubble-float 3.5s ease-in-out infinite 0.7s;
        }
        .animate-bubble-4 {
          animation: bubble-float 6s ease-in-out infinite 2.2s;
        }
      `}} />
      <div className="text-center w-full space-y-1">
        <div>
          <h3 className="font-heading text-sm text-foreground">Pool Distribution</h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Live Funds Tracker</p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-normal">
          Live monitor of available faucet pool funds.
        </p>
      </div>
      
      {/* Potion Bottle Container */}
      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 100 130" className="w-32 h-44 relative drop-shadow-[0_10px_25px_rgba(16,185,129,0.2)] overflow-visible">
          <defs>
            {/* The Clip Path for Potion Liquid */}
            <clipPath id="potion-inner-clip">
              <path d="M 43,15 L 43,36 C 31,36 17,51 17,80 A 33,33 0 1 0 83,80 C 83,51 69,36 57,36 L 57,15 Z" />
            </clipPath>

            {/* Liquid Gradients */}
            {/* Claimable (Vibrant Emerald Green) */}
            <linearGradient id="claimable-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>

          {/* Wooden Cork Stopper at the neck */}
          <path d="M 43,8 L 57,8 L 55,16 L 45,16 Z" fill="#854d0e" stroke="#451a03" strokeWidth="2" />

          {/* Liquid content within the mask */}
          <g clipPath="url(#potion-inner-clip)">
            {/* Background of the flask (Empty space) */}
            <rect x="0" y="0" width="100" height="130" fill="rgba(255, 255, 255, 0.02)" />

            {/* Claimable Layer (Emerald Green Liquid) */}
            {levelPct > 0 && (
              <>
                {/* Back wave for 3D effect */}
                <g className="animate-wave-slow opacity-60">
                  <path d={wavePath(y_liquid, 4)} fill="url(#claimable-grad)" />
                </g>
                {/* Front wave */}
                <g className="animate-wave-fast">
                  <path d={wavePath(y_liquid, 3)} fill="url(#claimable-grad)" />
                </g>
              </>
            )}

            {/* Bubble animations */}
            {levelPct > 10 && (
              <>
                <circle cx="38" cy="105" r="2.2" fill="rgba(255,255,255,0.4)" className="animate-bubble-1" />
                <circle cx="62" cy="100" r="1.5" fill="rgba(255,255,255,0.3)" className="animate-bubble-2" />
                <circle cx="48" cy="110" r="2.0" fill="rgba(255,255,255,0.5)" className="animate-bubble-3" />
                <circle cx="54" cy="104" r="1.2" fill="rgba(255,255,255,0.2)" className="animate-bubble-4" />
              </>
            )}
          </g>

          {/* Glass Highlights & Glare (adds 3D glass look) */}
          <path d="M 24,95 A 25,25 0 0 1 20,70" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 45,20 L 45,30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" />
          
          {/* Flask Outline glass border */}
          <path 
            d="M 42,15 L 42,36 C 30,36 15,51 15,80 A 35,35 0 1 0 85,80 C 85,51 70,36 58,36 L 58,15" 
            fill="none" 
            stroke="white" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="opacity-95"
          />

          {/* Top Lip of the flask */}
          <ellipse cx="50" cy="15" rx="8" ry="2.5" fill="none" stroke="white" strokeWidth="3" className="opacity-95" />

          {/* Total Label overlaid inside SVG for perfect responsiveness */}
          <g className="pointer-events-none select-none">
            <text 
              x="50" 
              y="82" 
              textAnchor="middle" 
              dominantBaseline="middle"
              fill="white"
              className="font-heading font-black"
              style={{ fontSize: '18px', filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))' }}
            >
              {claimable.toFixed(1)}
            </text>
            <text 
              x="50" 
              y="97" 
              textAnchor="middle" 
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.9)"
              className="font-mono font-extrabold tracking-wider"
              style={{ fontSize: '7px', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}
            >
              POL LEFT
            </text>
          </g>
        </svg>
      </div>

      <div className="flex flex-col gap-2 text-[10px] font-mono w-full px-2 mt-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-emerald-400 inline-block flex-shrink-0" />
          <span className="text-muted-foreground text-left leading-none flex-1">Claimable (Live)</span>
          <span className="font-medium text-foreground">{claimable.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-emerald-950/50 border border-emerald-800/30 inline-block flex-shrink-0" />
          <span className="text-muted-foreground text-left leading-none flex-1">Claimed (Drained)</span>
          <span className="font-medium text-foreground">{claimedAndCut.toFixed(4)}</span>
        </div>
      </div>
    </div>
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
  const historyPerPage = 3;

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
      <div className="mx-auto max-w-5xl space-y-6">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
            <Droplets className="size-3 mr-2" />
            POL FAUCET
          </div>
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Community Faucet</h1>
            <GuideModal title="How the Faucet Works">
              <p>The Faucet is a decentralized community pool that allows users to instantly fund their wallets with POL.</p>
              <ul className="list-disc pl-4 space-y-2 mt-2">
                <li><strong>Claiming:</strong> Each wallet address can receive 0.05 POL. Your daily claim count depends on your Tier.</li>
                <li><strong>Tiers & Limits:</strong> Contributing to the Hot Wallet pool upgrades your Tier, increasing how many addresses you can fund per day.</li>
                <li><strong>Claimable Balance:</strong> You can claim back up to 70% of your total lifetime donations to the pool.</li>
              </ul>
              <p className="mt-2 text-primary font-medium">💡 Tip: Make sure to verify your donation by submitting the transaction hash below.</p>
            </GuideModal>
          </div>
          <p className="mt-2 text-muted-foreground text-sm max-w-2xl">
            Fund your wallets instantly using the decentralized community pool.
            Contribute to the pool to unlock higher claims and exclusive Temp Mail limits.
          </p>
          <button onClick={() => setIsTiersModalOpen(true)} className="mt-4 text-xs font-medium text-primary hover:underline flex items-center gap-1">
            <Activity className="size-3" /> View Donation Tiers & Limits
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Main Stats Column ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* ── Main Stats Card ── */}
            <div className="rounded-2xl border border-border/40 bg-background/20 p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none -z-10" />

          <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8 border-b border-border/40 pb-6">
            {/* Left: Text stats */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Lifetime Donated</div>
                <div className="text-3xl font-heading text-foreground flex items-baseline gap-1.5">
                  <NumberTicker value={totalDonated} decimalPlaces={2} /> <span className="text-xl text-muted-foreground font-sans">POL</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">≈ {toFiat(totalDonated)}</div>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Claimable Balance</div>
                <div className="text-xl font-heading text-primary flex items-baseline gap-1.5">
                  <NumberTicker value={claimableBalance} decimalPlaces={2} /> <span className="text-sm text-primary/70 font-sans">POL</span>
                </div>
                <div className="text-xs text-primary/70 mt-0.5">≈ {toFiat(claimableBalance)}</div>
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
                <div className={`font-mono text-xs font-bold ${fillPercentage <= 20 ? 'text-destructive' : 'text-primary'} flex items-center gap-1`}>
                  <NumberTicker value={claimsLeftToday} />
                  <span>/</span>
                  <NumberTicker value={maxDaily} />
                  <span>left</span>
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
          </div>
          
          {/* ── Right Column: Donut Chart & Claim History ── */}
          <div className="lg:col-span-4 space-y-6">
            <LiquidFlaskChart claimable={claimableBalance} total={totalDonated} />

        {/* ── Claim History ── */}
        {claimHistory.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg text-foreground">Claim History</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Your past POL claims from the faucet pool.</p>
              </div>
              
              <div className="flex items-center gap-1.5 p-1 rounded-md border border-border/40 bg-background/40">
                <span className="px-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:inline-block">Recent</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden pb-1">
              <div className="divide-y divide-border/30">
                {pagedHistory.map((c) => {
                  const status = c.status ?? 'success';
                  return (
                    <div key={c.id} className="flex flex-col gap-2 p-2.5 hover:bg-foreground/[0.02] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div>
                          {status === 'processing' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              <span className="size-1 rounded-full bg-amber-400 animate-pulse" />
                              PROCESSING
                            </span>
                          )}
                          {status === 'success' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              <span className="size-1 rounded-full bg-emerald-400" />
                              SUCCESS
                            </span>
                          )}
                          {status === 'failed' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium bg-red-500/15 text-red-400 border border-red-500/20" title={c.error_message}>
                              <span className="size-1 rounded-full bg-red-400" />
                              FAILED
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1 bg-background/30 rounded-md p-2 border border-border/20">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">To</span>
                          <span className="font-mono text-[10px] text-primary truncate" title={c.wallet_address}>
                            {c.wallet_address}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Tx</span>
                          <div className="min-w-0">
                            {c.tx_hash && c.tx_hash !== 'pending' ? (
                              <a
                                href={`https://polygonscan.com/tx/${c.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] text-muted-foreground hover:text-primary flex items-center justify-end gap-1 group transition-colors truncate"
                                title={c.tx_hash}
                              >
                                <span className="truncate">{c.tx_hash.slice(0, 10)}...{c.tx_hash.slice(-8)}</span>
                                <ExternalLink className="size-2.5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50 font-mono">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 px-3 pb-3">
                <button
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {totalHistoryPages === 0 ? 0 : historyPage} / {totalHistoryPages}
                </div>
                <button
                  onClick={() => setHistoryPage(p => Math.min(Math.max(1, totalHistoryPages), p + 1))}
                  disabled={historyPage >= totalHistoryPages}
                  className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
          </div> {/* end right column */}
        </div> {/* end grid */}

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
