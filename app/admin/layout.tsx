import { ReactNode } from "react";
import { AdminNavDock } from "@/features/admin/components/admin-nav-dock";
import { GlobalChatbox } from "@/features/chat/components/global-chatbox";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background flex flex-col">
      <main className="flex-1 pb-28">{children}</main>
      <AdminNavDock />
      <GlobalChatbox />
    </div>
  );
}
