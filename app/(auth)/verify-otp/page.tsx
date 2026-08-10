"use client";

import { useEffect, useState, Suspense } from "react";
import { ChevronLeftIcon, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/ui/animated-modal";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

const RESEND_SECONDS = 45;

function VerifyOtpContent() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const onVerify = async () => {
    if (code.length !== 8 || pending || !email) return;
    
    setPending(true);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });
      
      if (error) throw error;
      
      router.push("/update-password");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid code. Please try again.", {
        classNames: { icon: "text-destructive" },
      });
      setPending(false);
    }
  };

  const onResend = async () => {
    if (secondsLeft > 0 || !email) return;
    setSecondsLeft(RESEND_SECONDS);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success("Code resent successfully.", {
        classNames: { icon: "text-green-500" },
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend code.", {
        classNames: { icon: "text-destructive" },
      });
      setSecondsLeft(0);
    }
  };

  return (
    <div className="w-full sm:max-w-md">
      <AnimatedCard
        title="Enter your code"
        icon={<ShieldCheck size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <div className="text-sm text-muted-foreground mb-6">
          We sent an 8-digit code to{" "}
          <span className="text-foreground">{email || "your email"}</span>
        </div>

        <div className="flex flex-col gap-6">
          
          <div className="flex justify-center">
            <InputOTP
              maxLength={8}
              value={code}
              onChange={(value) => setCode(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex justify-center text-xs">
            {secondsLeft > 0 ? (
              <span className="text-muted-foreground">
                Resend in {formatTime(secondsLeft)}
              </span>
            ) : (
              <button
                type="button"
                onClick={onResend}
                className="text-foreground underline-offset-4 transition-colors hover:underline"
              >
                Resend code
              </button>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={code.length !== 8 || pending}
            onClick={onVerify}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </div>
        
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            <ChevronLeftIcon className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </AnimatedCard>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <div className="min-h-svh bg-background flex items-center justify-center px-4">
      <Suspense fallback={<div className="w-full max-w-sm h-64 animate-pulse bg-muted rounded-2xl" />}>
        <VerifyOtpContent />
      </Suspense>
    </div>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}


