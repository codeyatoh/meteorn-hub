"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2 } from "lucide-react";
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
  const [pending, setPending] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setPending(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { nickname: nickname.trim() }
      });

      if (error) throw error;

      toast.success("Profile completed successfully!", {
        classNames: { icon: "text-green-500" },
      });

      router.push("/dashboard");
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
            Please choose a nickname to continue to Meteorn Hub.
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
                  <User className="h-[14px] w-[14px]" />
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
