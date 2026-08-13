"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings, Save, Mail, Lock, User, DollarSign, Loader2, ChevronDown, Coffee, CheckIcon } from "lucide-react";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [nickname, setNickname] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [email, setEmail] = useState("");
  
  // Password fields (only sent if filled)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [donationWallet, setDonationWallet] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencies = [
    { value: "usd", label: "USD ($)" },
    { value: "php", label: "PHP (₱)" },
    { value: "eur", label: "EUR (€)" }
  ];

  const supabase = createClient();

  useEffect(() => {
    Promise.all([
      supabase.auth.getUser(),
      supabase.from('platform_settings').select('donation_wallet_address').eq('id', 1).single(),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]).then(([{ data: { user } }, { data: settings }]) => {
      if (user) {
        setNickname(user.user_metadata?.nickname || "User");
        setCurrency(user.user_metadata?.currency || "usd");
        setEmail(user.email || "");
      }
      if (settings && settings.donation_wallet_address) {
        setDonationWallet(settings.donation_wallet_address);
      }
    })
    .finally(() => setLoading(false));
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match.", { classNames: { icon: "text-destructive" } });
      return;
    }

    setSaving(true);
    
    try {
      const updates: { data: { nickname: string, currency: string }, email?: string, password?: string } = {
        data: {
          nickname: nickname,
          currency: currency
        }
      };

      // Only update email if it changed
      const { data: { user } } = await supabase.auth.getUser();
      if (user && email !== user.email) {
        updates.email = email;
      }

      // Only update password if provided
      if (newPassword) {
        updates.password = newPassword;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) {
        throw error;
      }

      toast.success("Settings updated successfully! If you changed your email, check your inbox for a confirmation link.", {
        classNames: { icon: "text-green-500" },
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update settings.", {
        classNames: { icon: "text-destructive" },
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
        <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
      </div>
    );
  }

  return (
    <div className="px-6 py-10 relative min-h-screen">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
            <Settings className="size-3 mr-2" />
            Preferences
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
            Account Settings
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Update your profile, currency, and security details.
          </p>
        </div>

          <form onSubmit={handleSave} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Card */}
              <div className="rounded-xl border border-border/60 bg-background/40 p-6 flex flex-col space-y-6">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                  Profile
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Nickname</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="size-4 text-muted-foreground" />
                      </div>
                      <input 
                        type="text"
                        required
                        className="w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Default Currency</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <DollarSign className="size-4 text-muted-foreground" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setCurrencyOpen(!currencyOpen)}
                        className={`w-full flex items-center justify-between rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm cursor-pointer transition-colors ${currencyOpen ? 'ring-1 ring-ring border-ring' : 'hover:bg-foreground/[0.02]'}`}
                      >
                        <span className={currency ? "text-foreground" : "text-muted-foreground"}>
                          {currencies.find(c => c.value === currency)?.label}
                        </span>
                        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${currencyOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {currencyOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setCurrencyOpen(false)}></div>
                          <div className="absolute z-50 w-full mt-1.5 rounded-md border border-input bg-background shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                            {currencies.map(c => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => { setCurrency(c.value); setCurrencyOpen(false); }}
                                className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors outline-none ${
                                  currency === c.value 
                                    ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                                    : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                                }`}
                              >
                                <span className="font-medium">{c.label}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="rounded-xl border border-border/60 bg-background/40 p-6 flex flex-col space-y-6">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                  Security
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="size-4 text-muted-foreground" />
                      </div>
                      <input 
                        type="email"
                        required
                        className="w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Changing your email will require verification.</p>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-sm font-medium text-foreground">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="size-4 text-muted-foreground" />
                      </div>
                      <input 
                        type="password"
                        placeholder="Leave blank to keep current"
                        className="w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  {newPassword && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Confirm Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="size-4 text-muted-foreground" />
                        </div>
                        <input 
                          type="password"
                          required
                          placeholder="Confirm your new password"
                          className="w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors hover:border-border"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto min-w-[150px]">
                {saving ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Save className="size-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>

          </form>

          {/* Buy Me a Coffee */}
          {donationWallet && (
            <div className="mt-6 flex items-center gap-3 p-4 rounded-lg border border-border/40">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Coffee className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground mb-1">Buy Me a Coffee</p>
                <p className="font-mono text-[11px] text-muted-foreground truncate select-all">{donationWallet}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">EVM — ETH, BNB, POL, AVAX &amp; more</p>
              </div>
              <Button 
                size="sm" 
                variant="secondary" 
                className={`relative flex-shrink-0 h-8 px-3 text-xs transition-all duration-200 overflow-hidden ${copied ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30 border border-green-500/30" : ""}`}
                onClick={() => {
                  navigator.clipboard.writeText(donationWallet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? (
                  <span className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                    <CheckIcon className="size-3" /> Copied
                  </span>
                ) : (
                  <span className="animate-in fade-in zoom-in duration-200">Copy</span>
                )}
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
