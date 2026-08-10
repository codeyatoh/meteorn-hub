"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Home, Settings, BarChart2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dock, DockIcon } from "@/components/ui/dock";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function NavigationDock() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Dock direction="middle" className="bg-background/90 backdrop-blur-md border border-border/60 shadow-lg px-2">
        <DockIcon>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/dashboard"
                  aria-label="Home"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-10 rounded-full sm:size-12",
                    pathname === "/dashboard" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  <Home className="size-4 sm:size-5" />
                </Link>
              }
            />
            <TooltipContent sideOffset={12}>
              <p>Home</p>
            </TooltipContent>
          </Tooltip>
        </DockIcon>
        
        <DockIcon>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/dashboard/analytics"
                  aria-label="Analytics"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-10 rounded-full sm:size-12",
                    pathname?.startsWith("/dashboard/analytics") ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  <BarChart2 className="size-4 sm:size-5" />
                </Link>
              }
            />
            <TooltipContent sideOffset={12}>
              <p>Analytics</p>
            </TooltipContent>
          </Tooltip>
        </DockIcon>
        
        <DockIcon>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/dashboard/settings"
                  aria-label="Settings"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-10 rounded-full sm:size-12",
                    pathname?.startsWith("/dashboard/settings") ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  <Settings className="size-4 sm:size-5" />
                </Link>
              }
            />
            <TooltipContent sideOffset={12}>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </DockIcon>

        <Separator orientation="vertical" className="h-full py-2 mx-1" />
        
        <DockIcon>
          <Tooltip>
            <TooltipTrigger
              render={
                <form action="/auth/signout" method="post" className="m-0 p-0 flex">
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "size-10 rounded-full sm:size-12 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    )}
                  >
                    <LogOut className="size-4 sm:size-5" />
                  </button>
                </form>
              }
            />
            <TooltipContent sideOffset={12}>
              <p>Sign out</p>
            </TooltipContent>
          </Tooltip>
        </DockIcon>
      </Dock>
    </div>
  );
}
