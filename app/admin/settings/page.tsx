"use client";

import { useEffect, useState } from "react";
import { SlidersIcon, Loader2, SaveIcon, TicketIcon, ClockIcon, Mail, Lock, CoffeeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { PageContainer } from "@/components/ui/page-container";

type PlatformSettings = {
  id: number;
  daily_ticket_limit: number;
  donation_wallet_address: string;
  updated_at: string;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ticketLimit, setTicketLimit] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const supabase = createClient();

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then(res => res.json()),
      new Promise(resolve => setTimeout(resolve, 1000))
    ])
      .then(([data]) => {
        if (data) {
          setSettings(data);
          setTicketLimit(String(data.daily_ticket_limit));
          setWalletAddress(data.donation_wallet_address || "");
        }
      })
      .catch(() => toast.error("Failed to load settings.", { classNames: { icon: "text-destructive" } }))
      .finally(() => setLoading(false));

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setEmail(user.email);
        setOriginalEmail(user.email);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const limit = parseInt(ticketLimit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      toast.error("Ticket limit must be between 1 and 100.", { classNames: { icon: "text-destructive" } });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match.", { classNames: { icon: "text-destructive" } });
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_ticket_limit: limit, donation_wallet_address: walletAddress.trim() }),
    });

    if (res.ok) {
      setSettings((prev) =>
        prev ? { ...prev, daily_ticket_limit: limit, donation_wallet_address: walletAddress.trim(), updated_at: new Date().toISOString() } : prev
      );
      
      // Update Auth if needed
      try {
        const authUpdates: { email?: string; password?: string } = {};
        if (email !== originalEmail && email.trim()) {
          authUpdates.email = email.trim();
        }
        if (newPassword) {
          authUpdates.password = newPassword;
        }

        if (Object.keys(authUpdates).length > 0) {
          const { error: authErr } = await supabase.auth.updateUser(authUpdates);
          if (authErr) throw authErr;
          
          if (authUpdates.email) setOriginalEmail(authUpdates.email);
          setNewPassword("");
          setConfirmPassword("");
        }

        toast.success("Profile preferences saved! Check your email for confirmation if you changed it.", {
          classNames: { icon: "text-green-500" },
        });
      } catch (err: unknown) {
        toast.error((err as Error).message || "Failed to update auth credentials.", {
          classNames: { icon: "text-destructive" },
        });
      }

    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to save settings.", {
        classNames: { icon: "text-destructive" },
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex h-screen w-full items-center justify-center">
        <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
      </div>
    );
  }

  return (
    <PageContainer>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
            <SlidersIcon className="size-3 mr-2" />
            Platform
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Platform Settings</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Configure platform-wide defaults that apply to all users.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ticket Quota */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-6 space-y-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              Ticket Quota
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <TicketIcon className="size-4 text-muted-foreground" />
                Default Daily Ticket Limit
              </label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={ticketLimit}
                onChange={(e) => setTicketLimit(e.target.value)}
                className="w-32 rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border font-mono"
              />
              <p className="text-[11px] text-muted-foreground max-w-xl leading-relaxed">
                The default <code className="text-xs font-mono bg-foreground/5 px-1.5 py-0.5 rounded text-foreground">total_tickets</code> assigned to each new game account. Existing accounts are unaffected — use the Accounts page to adjust individual quotas.
              </p>
            </div>
          </div>

          {/* Donation / Support */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-6 space-y-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              Donation Settings
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <CoffeeIcon className="size-4 text-muted-foreground" />
                Buy Me a Coffee Wallet
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full max-w-sm rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border font-mono"
              />
              <p className="text-[11px] text-muted-foreground max-w-xl leading-relaxed">
                If provided, this wallet address will be displayed to users in their Settings page under a &quot;Buy Me a Coffee&quot; section. Leave blank to hide the section completely.
              </p>
            </div>
          </div>

          {/* Admin Account */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-6 space-y-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              Admin Account
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full max-w-sm rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border"
              />
              <p className="text-[11px] text-muted-foreground">
                Your email is used to log in. Changing it requires email verification.
              </p>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-6 space-y-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              Security
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="size-4 text-muted-foreground" />
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="size-4 text-muted-foreground opacity-50" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border"
                />
              </div>
            </div>
          </div>
          </div>

          {/* Cron Info (read-only) */}
          <div className="rounded-xl border border-border/40 bg-foreground/[0.02] p-5 flex items-start gap-4">
            <ClockIcon className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Daily Ticket Reset</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tickets are automatically reset to 0 for all accounts every day at{" "}
                <span className="font-mono text-foreground">12:00 AM PHT</span> (
                <span className="font-mono text-foreground">16:00 UTC</span>) via a database cron job.
                This runs independently of these settings.
              </p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground/60">
                schedule: <span className="text-foreground/70">0 16 * * *</span>
              </p>
            </div>
          </div>

          {settings?.updated_at && (
            <p className="text-[11px] text-muted-foreground text-right">
              Last updated: {new Date(settings.updated_at).toLocaleString()}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="min-w-[160px]">
              {saving ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <SaveIcon className="size-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
    </PageContainer>
  );
}
