"use client";

import { type FormEvent, useState, useEffect } from "react";
import { Loader2, Eye, EyeOff, Lock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/ui/animated-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";



function RuleItem({ fulfilled, text }: { fulfilled: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] transition-colors ${fulfilled ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
      {fulfilled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{text}</span>
    </div>
  );
}

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [pending, setPending] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isValid = hasLowercase && hasUppercase && hasNumber && hasSpecial && password === confirmPassword && password.length > 0;

  // We should only be here if we have a valid session from the OTP verify step
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      }
    };
    checkSession();
  }, [router, supabase]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || pending) return;
    
    setPending(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      if (error) throw error;
      
      toast.success("Password updated successfully", {
        classNames: { icon: "text-green-500" },
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.", {
        classNames: { icon: "text-destructive" },
      });
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-svh bg-background flex items-center justify-center px-4">
      <div className="w-full sm:max-w-md">
        <AnimatedCard
          title="Create new password"
          icon={<Lock size={18} strokeWidth={1.5} />}
          maxWidth="sm"
        >
          <div className="text-sm text-muted-foreground mb-6">
            Please enter your new password below.
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">New Password</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-[14px] w-[14px]" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-transparent pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-foreground text-sm font-medium">Confirm New Password</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-[14px] w-[14px]" />
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`bg-transparent pl-9 pr-10 ${confirmPassword && password !== confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
                </button>
              </div>
            </div>

            {password.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5 p-3 rounded-lg border bg-muted/50">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">Password Strength</div>
                <div className="grid grid-cols-2 gap-2">
                  <RuleItem fulfilled={hasLowercase} text="Lowercase" />
                  <RuleItem fulfilled={hasUppercase} text="Uppercase" />
                  <RuleItem fulfilled={hasNumber} text="Number" />
                  <RuleItem fulfilled={hasSpecial} text="Special Char" />
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              size="lg" 
              disabled={pending || !isValid} 
              className="mt-1 w-full"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </AnimatedCard>
      </div>
    </div>
  );
}
