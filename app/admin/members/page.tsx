"use client";

import { useEffect, useState } from "react";
import { UsersIcon, Loader2, ShieldIcon, UserIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";

type AdminUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  account_count: number;
};

export default function MembersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(res => res.json()),
      new Promise(resolve => setTimeout(resolve, 3000))
    ])
      .then(([data]) => {
        if (Array.isArray(data)) setUsers(data);
        else toast.error("Failed to load users.", { classNames: { icon: "text-destructive" } });
      })
      .catch(() => toast.error("Network error.", { classNames: { icon: "text-destructive" } }))
      .finally(() => setLoading(false));
  }, []);

  const toggleRole = async (user: AdminUser) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    setTogglingId(user.id);

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
    );

    const res = await fetch(`/api/admin/users/${user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (!res.ok) {
      // Revert on failure
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: user.role } : u))
      );
      toast.error("Failed to update role. Please try again.", { classNames: { icon: "text-destructive" } });
    } else {
      toast.success("Role updated successfully.", { classNames: { icon: "text-green-500" } });
    }

    setTogglingId(null);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
              <UsersIcon className="size-3 mr-2" />
              Members
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Registered Users</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              All users who have signed up to Meteorn Hub.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-full border border-border/60 bg-background/50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {loading ? (
          <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
            <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-[30vh] items-center justify-center text-sm text-muted-foreground">
            No registered users found.
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
            {/* Header */}
            <div className="overflow-x-auto">
              <div className="min-w-[500px] sm:min-w-0">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 border-b border-border/40 text-[10px] font-mono text-muted-foreground uppercase tracking-[0.1em]">
                  <span>User</span>
                  <span className="text-right">Accounts</span>
                  <span className="text-right hidden sm:block">Joined</span>
                  <span className="text-right hidden md:block">Last Seen</span>
                  <span className="text-right">Role</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/30">
                  {(() => {
                const filteredUsers = users.filter(u => 
                  (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || 
                  (u.email || "").toLowerCase().includes(search.toLowerCase())
                );
                return filteredUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-foreground/[0.02] transition-colors"
                >
                  {/* User info */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {u.nickname ?? "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>

                  {/* Account count */}
                  <div className="text-right font-mono text-sm text-muted-foreground">
                    {u.account_count}
                  </div>

                  {/* Joined */}
                  <div className="text-right text-xs text-muted-foreground hidden sm:block">
                    {formatDate(u.created_at)}
                  </div>

                  {/* Last seen */}
                  <div className="text-right text-xs text-muted-foreground hidden md:block">
                    {formatDate(u.last_sign_in_at)}
                  </div>

                  {/* Role toggle */}
                  <div className="text-right">
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={togglingId === u.id}
                      title={u.role === "admin" ? "Demote to user" : "Promote to admin"}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-[11px] font-mono hover:border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {togglingId === u.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : u.role === "admin" ? (
                        <>
                          <ShieldIcon className="size-3 text-primary" />
                          <span className="text-primary">Admin</span>
                        </>
                      ) : (
                        <>
                          <UserIcon className="size-3 text-muted-foreground" />
                          <span className="text-muted-foreground">User</span>
                        </>
                      )}
                    </button>
                    </div>
                  </div>
                ));
                })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground">
                {users.filter(u => (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase())).length} user(s) found
              </div>

              {users.filter(u => (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase())).length > ITEMS_PER_PAGE && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <span className="text-[10px] font-mono text-muted-foreground min-w-[3rem] text-center">
                    {page} / {Math.ceil(users.filter(u => (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase())).length / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(users.filter(u => (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase())).length / ITEMS_PER_PAGE), p + 1))}
                    disabled={page === Math.ceil(users.filter(u => (u.nickname || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase())).length / ITEMS_PER_PAGE)}
                    className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
