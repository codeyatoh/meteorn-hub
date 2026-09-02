"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  GlobeIcon,
  Loader2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ShieldBan,
} from "lucide-react";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { PageContainer } from "@/components/ui/page-container";

type Domain = {
  id: number;
  domain: string;
  is_active: boolean;
  is_banned: boolean;
  available_at: string | null;
  created_at: string;
};

export default function TempMailDomainsPage() {
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [banningId, setBanningId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;

  const [newDomain, setNewDomain] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain) return;
    setIsAdding(true);
    try {
      const payload: Record<string, string> = { domain: newDomain.trim() };
      if (scheduleTime) {
        payload.available_at = new Date(scheduleTime).toISOString();
      }
      const res = await fetch("/api/admin/temp-mail-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add domain.");
      const data = await res.json();
      setDomains((prev) => [data, ...prev]);
      setNewDomain("");
      setScheduleTime("");
      toast.success("Domain added successfully!", { classNames: { icon: "text-green-500" } });
    } catch (err: unknown) {
      toast.error((err as Error).message, { classNames: { icon: "text-destructive" } });
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/temp-mail-domains").then((r) => r.json()),
      new Promise((res) => setTimeout(res, 800)),
    ])
      .then(([data]) => {
        if (Array.isArray(data)) setDomains(data);
        else toast.error("Failed to load domains.", { classNames: { icon: "text-destructive" } });
      })
      .catch(() => toast.error("Network error.", { classNames: { icon: "text-destructive" } }))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (d: Domain) => {
    setTogglingId(d.id);
    const newActive = !d.is_active;
    // Optimistic
    setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: newActive } : x)));
    try {
      const res = await fetch(`/api/admin/temp-mail-domains/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(newActive ? "Domain active for Temp Mail." : "Domain hidden from users.", { classNames: { icon: "text-green-500" } });
    } catch {
      // Revert
      setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: d.is_active } : x)));
      toast.error("Failed to update domain.", { classNames: { icon: "text-destructive" } });
    } finally {
      setTogglingId(null);
    }
  };

  const handleBanToggle = async (d: Domain) => {
    setBanningId(d.id);
    const newBanned = !d.is_banned;
    // Optimistic
    setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_banned: newBanned } : x)));
    try {
      const res = await fetch(`/api/admin/temp-mail-domains/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_banned: newBanned }),
      });
      if (!res.ok) throw new Error();
      toast.success(newBanned ? "Domain marked as banned." : "Domain ban lifted.", { classNames: { icon: "text-amber-500" } });
    } catch {
      // Revert
      setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_banned: d.is_banned } : x)));
      toast.error("Failed to update ban status.", { classNames: { icon: "text-destructive" } });
    } finally {
      setBanningId(null);
    }
  };

  const handleDelete = async (d: Domain) => {
    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/admin/temp-mail-domains/${d.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDomains((prev) => prev.filter((x) => x.id !== d.id));
      toast.success(`Domain "${d.domain}" deleted.`, { classNames: { icon: "text-green-500" } });
    } catch {
      toast.error("Failed to delete domain.", { classNames: { icon: "text-destructive" } });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex h-screen w-full items-center justify-center">
        <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
      </div>
    );
  }

  return (
    <PageContainer innerClassName="max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
            <GlobeIcon className="size-3 mr-2" />
            Temp Mail
          </div>
          <div className="flex items-center gap-4">
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Domain Management</h1>
          </div>
          <p className="mt-2 text-muted-foreground text-sm">
            Manage your custom domains and schedule when they become available to users.
          </p>
        </div>

        {/* Add Domain Form */}
        <form onSubmit={handleAddDomain} className="mb-8 rounded-xl border border-border/60 bg-background/40 p-5 space-y-4 shadow-sm">
          <h2 className="font-heading text-lg text-foreground">Add New Domain</h2>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Domain</label>
              <input
                type="text"
                placeholder="e.g. yourdomain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-border/60 bg-background/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
              />
            </div>
            
            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Launch Schedule (Optional)</label>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full h-10 rounded-md border border-border/60 bg-background/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isAdding || !newDomain}
            className="h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {isAdding ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Add Domain
          </button>
        </form>

        {/* Domain List */}
        <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden shadow-sm">
          {domains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
              <GlobeIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No domains found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {domains
                .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                .map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-4 px-5 py-3.5 transition-colors ${
                    d.is_active ? "hover:bg-foreground/[0.02]" : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-foreground">@{d.domain}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-muted-foreground">
                        Added{" "}
                        {new Date(d.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                      {d.available_at && new Date(d.available_at) > new Date() && (
                        <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 rounded uppercase tracking-wider font-mono">
                          Launches: {new Date(d.available_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Active badge */}
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      d.is_active
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {d.is_active ? "Active" : "Inactive"}
                    </span>
                    
                    {/* Banned badge */}
                    {d.is_banned && (
                      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        Banned
                      </span>
                    )}

                    {/* Toggle Active */}
                    <button
                      onClick={() => handleToggle(d)}
                      disabled={togglingId === d.id}
                      title={d.is_active ? "Deactivate" : "Activate"}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
                    >
                      {togglingId === d.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : d.is_active ? (
                        <ToggleRight className="size-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="size-4" />
                      )}
                    </button>

                    {/* Toggle Ban */}
                    <button
                      onClick={() => handleBanToggle(d)}
                      disabled={banningId === d.id}
                      title={d.is_banned ? "Unban" : "Ban"}
                      className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
                        d.is_banned ? "text-amber-500 hover:text-amber-400 hover:bg-amber-500/10" : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                      }`}
                    >
                      {banningId === d.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldBan className="size-4" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      title="Delete domain"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === d.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between gap-3">
            <p className="text-[10px] text-muted-foreground font-mono">
              {domains.filter((d) => d.is_active).length} active · {domains.length} total
            </p>
            {domains.length > PAGE_SIZE && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                >
                  ‹
                </button>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {page + 1} / {Math.ceil(domains.length / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(domains.length / PAGE_SIZE) - 1, p + 1))}
                  disabled={page >= Math.ceil(domains.length / PAGE_SIZE) - 1}
                  className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
    </PageContainer>
  );
}
