"use client";

import { useState } from "react";
import { Trash2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type CleanupStats = {
  deletedEmails: number;
  deletedSessions: number;
  clearedBannedEmails: number;
};

type CleanupResult = {
  success: boolean;
  stats: CleanupStats;
  ranAt: string;
};

export function MaintenanceCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCleanup = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/maintenance", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Cleanup failed.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] mb-1">
            System Maintenance
          </div>
          <h2 className="font-heading text-xl text-foreground">Database Cleanup</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Removes old temporary emails (&gt;3 days), expired sessions, and clears the email address of banned accounts. Run this every few days.
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex-shrink-0">
          <Trash2 className="size-4 text-red-400" />
        </div>
      </div>

      {/* What will be cleaned */}
      <ul className="space-y-1.5">
        {[
          "Delete yatmail messages older than 3 days",
          "Delete expired temp mail sessions",
          "Clear email field from banned accounts (keeps income logs intact)",
        ].map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary/60 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle className="size-4" />
            Cleanup completed at {new Date(result.ranAt).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
            })}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Emails Deleted", value: result.stats.deletedEmails },
              { label: "Sessions Cleared", value: result.stats.deletedSessions },
              { label: "Banned Emails Wiped", value: result.stats.clearedBannedEmails },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-heading text-foreground">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="size-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Button */}
      <button
        onClick={runCleanup}
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Running cleanup…
          </>
        ) : (
          <>
            <Trash2 className="size-4" />
            Run Cleanup Now
          </>
        )}
      </button>
    </div>
  );
}
