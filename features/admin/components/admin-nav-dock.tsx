"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldAlertIcon, UsersIcon, GamepadIcon, SlidersIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dock, DockIcon } from "@/components/ui/dock";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: ShieldAlertIcon, exact: true },
  { href: "/admin/members", label: "Members", icon: UsersIcon, exact: false },
  { href: "/admin/accounts", label: "Accounts", icon: GamepadIcon, exact: false },
  { href: "/admin/settings", label: "Settings", icon: SlidersIcon, exact: false },
];

export function AdminNavDock() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname?.startsWith(href);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Dock
        direction="middle"
        className="bg-background/90 backdrop-blur-md border border-border/60 shadow-lg px-2"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <DockIcon key={href}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={href}
                    aria-label={label}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "size-10 rounded-full sm:size-12",
                      isActive(href, exact)
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    )}
                  >
                    <Icon className="size-4 sm:size-5" />
                  </Link>
                }
              />
              <TooltipContent sideOffset={12}>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          </DockIcon>
        ))}

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
