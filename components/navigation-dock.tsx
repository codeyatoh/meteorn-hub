"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, BarChart2, Settings, LogOut, Loader2, Mail } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dock, DockIcon } from "@/components/ui/dock";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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
      toast.error("Failed to sign out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Dock direction="middle" className="bg-background/90 backdrop-blur-md border border-border/60 shadow-lg px-2">
        <DockIcon>
          <Link
            href="/dashboard"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors",
              pathname === "/dashboard" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Tooltip>
              <TooltipTrigger render={<div className="flex size-full items-center justify-center" />}>
                <Home className="size-4 sm:size-5" />
              </TooltipTrigger>
              <TooltipContent sideOffset={12}>
                <p>Dashboard</p>
              </TooltipContent>
            </Tooltip>
          </Link>
        </DockIcon>

        <DockIcon>
          <Link
            href="/dashboard/analytics"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors",
              pathname?.startsWith("/dashboard/analytics") ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Tooltip>
              <TooltipTrigger render={<div className="flex size-full items-center justify-center" />}>
                <BarChart2 className="size-4 sm:size-5" />
              </TooltipTrigger>
              <TooltipContent sideOffset={12}>
                <p>Analytics</p>
              </TooltipContent>
            </Tooltip>
          </Link>
        </DockIcon>

        <DockIcon>
          <Link
            href="/dashboard/temp-mail"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors",
              pathname?.startsWith("/dashboard/temp-mail") ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Tooltip>
              <TooltipTrigger render={<div className="flex size-full items-center justify-center" />}>
                <Mail className="size-4 sm:size-5" />
              </TooltipTrigger>
              <TooltipContent sideOffset={12}>
                <p>Temp Mail</p>
              </TooltipContent>
            </Tooltip>
          </Link>
        </DockIcon>

        <DockIcon>
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors",
              pathname?.startsWith("/dashboard/settings") ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Tooltip>
              <TooltipTrigger render={<div className="flex size-full items-center justify-center" />}>
                <Settings className="size-4 sm:size-5" />
              </TooltipTrigger>
              <TooltipContent sideOffset={12}>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </Link>
        </DockIcon>

        <Separator orientation="vertical" className="h-full py-2 mx-1" />
        
        <DockIcon>
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className={cn(
              "flex size-full items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              isLoggingOut && "opacity-50 cursor-not-allowed"
            )}
          >
            <Tooltip>
              <TooltipTrigger render={<div className="flex size-full items-center justify-center" />}>
                {isLoggingOut ? <Loader2 className="size-4 sm:size-5 animate-spin" /> : <LogOut className="size-4 sm:size-5" />}
              </TooltipTrigger>
              <TooltipContent sideOffset={12}>
                <p>Sign out</p>
              </TooltipContent>
            </Tooltip>
          </button>
        </DockIcon>
      </Dock>
    </div>
  );
}
