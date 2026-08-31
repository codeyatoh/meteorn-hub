"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2, WalletIcon, DollarSign, ChevronDown } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";



export default function OnboardingPage() {
  const [nickname, setNickname] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [lbankAddress, setLbankAddress] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [donationWallet, setDonationWallet] = useState("");
  const [pending, setPending] = useState(false);
  
  const currencies = [
    { value: "usd", label: "USD ($)" },
    { value: "php", label: "PHP (₱)" },
    { value: "eur", label: "EUR (€)" }
  ];
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: settings } = await supabase.from('platform_settings').select('donation_wallet_address').eq('id', 1).single();
      if (settings?.donation_wallet_address) {
        setDonationWallet(settings.donation_wallet_address);
      }
    };
    fetchSettings();
  }, [supabase]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setPending(true);

    if (walletAddress) {
      if (donationWallet && walletAddress.toLowerCase() === donationWallet.toLowerCase()) {
        toast.error("Cannot use Faucet Hot Wallet as personal address.", { classNames: { icon: "text-destructive" } });
        setPending(false);
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await fetch(`/api/faucet/check-address?address=${walletAddress}&userId=${user.id}&mode=settings&_t=${Date.now()}`);
          const data = await res.json();
          if (data.used) {
            toast.error(data.message || "Invalid wallet address.", { classNames: { icon: "text-destructive" } });
            setPending(false);
            return;
          }
        }
      } catch {
        toast.error("Could not verify wallet address security.", { classNames: { icon: "text-destructive" } });
        setPending(false);
        return;
      }
    }

    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          nickname: nickname.trim(),
          currency: currency,
          wallet_address: walletAddress.toLowerCase().trim(),
          lbank_address: lbankAddress
        }
      });

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role;

      toast.success("Profile completed successfully!", {
        classNames: { icon: "text-green-500" },
      });

      router.push(role === 'admin' ? "/admin" : "/dashboard");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.", {
        classNames: { icon: "text-destructive" },
      });
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-svh bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle className="mt-4 font-heading text-2xl tracking-tight text-foreground">
            Complete your profile
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Please setup your profile and preferences to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-6">

            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname" className="text-foreground text-sm font-medium">
                Nickname
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <User className="size-4" />
                </div>
                <Input
                  id="nickname"
                  type="text"
                  required
                  placeholder="What should we call you?"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-transparent pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-foreground text-sm font-medium">Personal Wallet Address</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <WalletIcon className="size-4 text-muted-foreground" />
                </div>
                <Input 
                  type="text"
                  className="bg-transparent pl-9"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground bg-primary/5 p-2 rounded border border-primary/10">
                Make sure this is your personal EVM/Polygon wallet address (e.g., MetaMask, Trust Wallet). <strong>Do NOT use an exchange address.</strong> This is required to verify your $POL donations for the Faucet.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-foreground text-sm font-medium">LBank Wallet Address</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <WalletIcon className="size-4 text-muted-foreground" />
                </div>
                <Input 
                  type="text"
                  className="bg-transparent pl-9"
                  placeholder="0x..."
                  value={lbankAddress}
                  onChange={(e) => setLbankAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 relative">
              <Label className="text-foreground text-sm font-medium">Default Currency</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <DollarSign className="size-4 text-muted-foreground" />
                </div>
                <button 
                  type="button"
                  onClick={() => setCurrencyOpen(!currencyOpen)}
                  className={`w-full flex items-center justify-between rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm cursor-pointer transition-colors ${currencyOpen ? 'ring-1 ring-ring border-ring' : 'hover:bg-foreground/[0.02]'}`}
                >
                  <span className={currency ? "text-foreground" : "text-muted-foreground"}>
                    {currencies.find(c => c.value === currency)?.label}
                  </span>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${currencyOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {currencyOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setCurrencyOpen(false)}></div>
                    <div className="absolute z-50 top-full left-0 w-full mt-1.5 rounded-md border border-input bg-background shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                      {currencies.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => { setCurrency(c.value); setCurrencyOpen(false); }}
                          className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors outline-none ${
                            currency === c.value 
                              ? 'bg-primary/10 text-primary' 
                              : 'text-foreground hover:bg-foreground/[0.05]'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={pending || !nickname.trim()} 
              size="lg" 
              className="mt-1 w-full"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue to Dashboard"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
