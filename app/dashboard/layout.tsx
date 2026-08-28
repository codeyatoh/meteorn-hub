import { ReactNode } from "react";
import { NavigationDock } from "@/components/navigation-dock";
import { GlobalChatbox } from "@/features/chat/components/global-chatbox";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background flex flex-col">
      <main className="flex-1 pb-24">
        {children}
      </main>

      <NavigationDock />
      <GlobalChatbox />
    </div>
  );
}
