"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, PlusCircle, ListTodo, BarChart2, Settings, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dock, DockIcon } from "@/components/ui/dock";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

export function NavigationDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Dock direction="middle" className="bg-background/90 backdrop-blur-md border border-border/60 shadow-lg px-2">
        <DockIcon>
          <Link
            href="/dashboard"
            title="Dashboard"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors",
              pathname === "/dashboard" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Home className="size-4 sm:size-5" />
          </Link>
        </DockIcon>

        <DockIcon>
          <Link
            href="/dashboard/analytics"
            title="Analytics"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors",
              pathname?.startsWith("/dashboard/analytics") ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <BarChart2 className="size-4 sm:size-5" />
          </Link>
        </DockIcon>
        
        <DockIcon>
          <Link
            href="/dashboard/settings"
            title="Settings"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors",
              pathname?.startsWith("/dashboard/settings") ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Settings className="size-4 sm:size-5" />
          </Link>
        </DockIcon>

        <Separator orientation="vertical" className="h-full py-2 mx-1" />
        
        <DockIcon>
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            title="Sign out"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              isLoggingOut && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoggingOut ? <Loader2 className="size-4 sm:size-5 animate-spin" /> : <LogOut className="size-4 sm:size-5" />}
          </button>
        </DockIcon>
      </Dock>
    </div>
  );
}
