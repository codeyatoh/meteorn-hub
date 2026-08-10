import { ReactNode } from "react";
import { AdminNavDock } from "@/features/admin/components/admin-nav-dock";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background flex flex-col">
      <main className="flex-1 pb-28">{children}</main>
      <AdminNavDock />
    </div>
  );
}
