"use client";

import { type FormEvent, useState } from "react";
import { ChevronLeftIcon, Loader2, KeyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/ui/animated-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";



export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");

  const [pending, setPending] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || pending) return;
    
    setPending(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      
      toast.success("Reset code sent! Check your email.", {
        classNames: { icon: "text-green-500" },
      });
      // On success, redirect to verify-otp with the email as a param
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link.", {
        classNames: { icon: "text-destructive" },
      });
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-svh bg-background flex items-center justify-center px-4">
      <div className="w-full sm:max-w-md">
        <AnimatedCard
          title="Reset your password"
          icon={<KeyIcon size={18} strokeWidth={1.5} />}
          maxWidth="sm"
        >
          <div className="text-sm text-muted-foreground mb-4">
            Enter your email and we&apos;ll send you an 8-digit code to reset it.
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-email" className="text-foreground text-sm font-medium">Email</Label>
              <Input
                id="reset-email"
                type="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent"
              />
            </div>

            <Button 
              type="submit" 
              size="lg" 
              disabled={pending} 
              className="mt-1 w-full"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                "Send reset code"
              )}
            </Button>
          </form>
          
          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              <ChevronLeftIcon className="size-3.5" />
              Back to sign in
            </Link>
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
