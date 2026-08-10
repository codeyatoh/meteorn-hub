"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import { type FormEvent, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, Eye, EyeOff, User, Check, X } from "lucide-react";

export function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="w-full max-w-[360px]">
      {/* Mobile Branding Header */}
      <div className="absolute top-8 left-8 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 dark:text-muted-foreground lg:hidden">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-foreground" />
        <span>Meteorn Hub - </span>
        <a href="https://github.com/CodeYatoh" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-foreground transition-colors underline underline-offset-4">
          CodeYatoh
        </a>
      </div>

      <div className="font-mono text-[10px] text-zinc-500 dark:text-muted-foreground uppercase tracking-[0.3em]">
        {isLogin ? "Welcome back" : "Create an account"}
      </div>
      <h1 className="mt-3 font-sans text-3xl leading-tight font-medium tracking-tight text-zinc-900 dark:text-foreground">
        {isLogin ? "Sign in to Meteorn Hub" : "Join Meteorn Hub"}
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm">
        {isLogin 
          ? "Enter your email and password to sign in." 
          : "Enter your details below to create your account."}
      </p>

      <CredentialsForm isLogin={isLogin} setIsLogin={setIsLogin} />
      <OrSeparator />
      <OAuthButtons />
    </div>
  );
}

function OrSeparator() {
  return (
    <div className="my-6 flex items-center gap-3">
      <Separator className="flex-1 bg-border/60" />
      <span className="font-mono text-[10px] text-zinc-500 dark:text-muted-foreground uppercase tracking-[0.3em]">
        or
      </span>
      <Separator className="flex-1 bg-border/60" />
    </div>
  );
}

function CredentialsForm({ isLogin, setIsLogin }: { isLogin: boolean, setIsLogin: (v: boolean) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    if (!isLogin) {
      if (!nickname.trim() || password !== confirmPassword) return;
      if (!hasLowercase || !hasUppercase || !hasNumber || !hasSpecial) return;
    }
    
    setPending(true);
    
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        toast.success("Signed in successfully", {
          classNames: { icon: "text-green-500" },
        });
        
        const role = data.user?.user_metadata?.role;
        router.push(role === 'admin' ? "/admin" : "/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nickname,
            },
          },
        });
        if (error) throw error;
        
        toast.success("Account created successfully", {
          classNames: { icon: "text-green-500" },
        });

        const role = data.user?.user_metadata?.role;
        router.push(role === 'admin' ? "/admin" : "/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred during authentication.", {
        classNames: { icon: "text-destructive" },
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="mt-8 flex flex-col gap-4"
    >

      {!isLogin && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="nickname" className="text-zinc-600 dark:text-zinc-400 font-normal text-xs">Nickname</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
              <User className="h-[14px] w-[14px]" />
            </div>
            <Input
              id="nickname"
              type="text"
              required={!isLogin}
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="bg-transparent border-border/60 h-11 pl-9 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-zinc-600 dark:text-zinc-400 font-normal text-xs">Email</Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
            <Mail className="h-[14px] w-[14px]" />
          </div>
          <Input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-transparent border-border/60 h-11 pl-9 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className={!isLogin ? "grid grid-cols-2 gap-4" : "flex flex-col gap-2"}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-zinc-600 dark:text-zinc-400 font-normal text-xs">Password</Label>
            {isLogin && (
              <Link href="/reset-password" className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
              <Lock className="h-[14px] w-[14px]" />
            </div>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent border-border/60 h-11 pl-9 pr-10 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
            </button>
          </div>
        </div>

        {!isLogin && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword" className="text-zinc-600 dark:text-zinc-400 font-normal text-xs">Confirm Password</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                <Lock className="h-[14px] w-[14px]" />
              </div>
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required={!isLogin}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`bg-transparent border-border/60 h-11 pl-9 pr-10 focus-visible:ring-1 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100 ${confirmPassword && password !== confirmPassword ? "border-red-500/50 focus-visible:ring-red-500" : "focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600"}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {!isLogin && password.length > 0 && (
        <div className="mt-0 flex flex-col gap-1.5 p-3 rounded-lg border border-border/40 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-0.5">Password Strength</div>
          <div className="grid grid-cols-2 gap-2">
            <RuleItem fulfilled={hasLowercase} text="Lowercase" />
            <RuleItem fulfilled={hasUppercase} text="Uppercase" />
            <RuleItem fulfilled={hasNumber} text="Number" />
            <RuleItem fulfilled={hasSpecial} text="Special Char" />
          </div>
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full h-11 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors font-medium">
        {pending 
          ? (isLogin ? "Signing in..." : "Creating account...") 
          : (isLogin ? "Sign in" : "Create account")
        }
      </Button>

      <div className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-zinc-900 dark:text-foreground font-medium hover:underline underline-offset-4"
        >
          {isLogin ? "Register" : "Sign in"}
        </button>
      </div>
    </form>
  );
}

function OAuthButtons() {
  const supabase = createClient();
  const [pending, setPending] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setPending(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      console.error("Google login error:", err instanceof Error ? err.message : "Unknown error");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button 
        onClick={handleGoogleLogin} 
        disabled={pending}
        variant="outline" 
        size="lg" 
        type="button" 
        className="w-full h-11 bg-transparent border-border/60 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 transition-colors"
      >
        <GoogleIcon />
        {pending ? "Redirecting to Google..." : "Continue with Google"}
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] mr-2 text-zinc-500 dark:text-zinc-400">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.64 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95s2.63-5.95 5.85-5.95c1.84 0 3.07.78 3.77 1.45l2.57-2.5C16.71 3.8 14.59 2.9 12 2.9 6.97 2.9 2.9 6.97 2.9 12s4.07 9.1 9.1 9.1c5.26 0 8.74-3.69 8.74-8.89 0-.6-.06-1.05-.14-1.51Z"
      />
    </svg>
  );
}

function RuleItem({ fulfilled, text }: { fulfilled: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] transition-colors ${fulfilled ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
      {fulfilled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{text}</span>
    </div>
  );
}
