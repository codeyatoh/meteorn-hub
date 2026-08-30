import React from "react";
import { redirect } from "next/navigation";
import { UsersIcon, GamepadIcon } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminIncomeChart } from "@/features/admin/components/admin-income-chart";
import { AutoRefresh } from "@/components/auto-refresh";
import { RealtimeSync } from "@/components/realtime-sync";
import { AdminCurrencySelector } from "@/features/admin/components/admin-currency-selector";
import { MaintenanceCard } from "@/features/admin/components/maintenance-card";
import { PageContainer } from "@/components/ui/page-container";

export default async function AdminOverviewPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Server-side admin check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") redirect("/dashboard");

  const searchParams = await props.searchParams;
  const currency = (searchParams?.currency as string) || user.user_metadata?.currency || "usd";
  const currencySymbol = { usd: "$", php: "₱", eur: "€" }[currency as string] || "$";

  const admin = createAdminClient();

  // Fetch all stats in parallel
  const [
    { data: { users } },
    { count: totalAccounts },
    { data: incomeData },
    { data: accountsData },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("user_accounts").select("*", { count: "exact", head: true }),
    admin.from("income_logs").select("gmto_amount, created_at").order("created_at", { ascending: true }),
    admin.from("user_accounts").select("tickets_done"),
  ]);

  const totalUsers = users.length;
  const totalGMTO = (incomeData ?? []).reduce(
    (sum, l) => sum + parseFloat(String(l.gmto_amount)),
    0
  );
  const ticketsToday = (accountsData ?? []).reduce(
    (sum, a) => sum + (a.tickets_done as number),
    0
  );

  // Fetch live GMTO price
  let gmtoPrice = 0; // fallback
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=game-meteor-coin&vs_currencies=${currency}`, {
      headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '' },
      next: { revalidate: 10 }
    });
    if (res.ok) {
      const data = await res.json();
      if (data["game-meteor-coin"] && data["game-meteor-coin"][currency]) {
        gmtoPrice = data["game-meteor-coin"][currency];
      }
    }
  } catch (e) {
    console.warn("Failed to fetch GMTO price in admin", e);
  }

  // Build income trend for last 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const grouped: Record<string, number> = {};
  (incomeData ?? []).forEach((l) => {
    const d = new Date(l.created_at);
    if (d < cutoff) return;
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    grouped[key] = (grouped[key] ?? 0) + parseFloat(String(l.gmto_amount));
  });
  const chartData = Object.entries(grouped).map(([date, amount]) => ({ date, amount }));

  const totalGMTODisplay = totalGMTO.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <PageContainer innerClassName="space-y-10">
      <AutoRefresh />
      <RealtimeSync />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
              <span>—</span>
              <span className="text-primary font-bold">ADMIN PORTAL</span>
            </div>
            <h1 className="mt-1 font-heading text-4xl tracking-tight text-foreground">
              {getGreeting()}, {user.user_metadata?.nickname || "Admin"}.
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground text-sm">
              Real-time platform stats from the database.
            </p>
          </div>
          <AdminCurrencySelector currentCurrency={currency} />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Registered Users"
            value={totalUsers.toLocaleString()}
            icon={<UsersIcon className="size-4 opacity-40" />}
          />
          <StatCard
            label="Total Game Accounts"
            value={(totalAccounts ?? 0).toLocaleString()}
            icon={<GamepadIcon className="size-4 opacity-40" />}
          />
          <StatCard
            label="Total GMTO Logged"
            value={totalGMTODisplay}
            sub={`~${currencySymbol}${(totalGMTO * gmtoPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })} (Live: ${currencySymbol}${gmtoPrice.toFixed(4)})`}
            icon={<Image src="/gmto.png" alt="GMTO" width={24} height={24} className="opacity-80 rounded-full grayscale mix-blend-screen" />}
          />
          <StatCard
            label="Tickets Done Today"
            value={ticketsToday.toLocaleString()}
            sub="Resets at 12 AM PHT"
            icon={<Image src="/repair-ticket.png" alt="Ticket" width={24} height={24} className="opacity-80 grayscale mix-blend-screen" />}
          />
        </div>

        {/* Income Trend Chart */}
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] mb-1">
            Income Trend
          </div>
          <h2 className="font-heading text-2xl text-foreground mb-6">
            GMTO Logged · Last 30 Days
          </h2>
          <div className="rounded-xl border border-border/60 bg-background/40 p-6">
            <AdminIncomeChart data={chartData} gmtoPrice={gmtoPrice} currencySymbol={currencySymbol} />
          </div>
        </div>

        {/* Database Maintenance */}
        <MaintenanceCard />

    </PageContainer>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {label}
        </div>
        {icon}
      </div>
      <div className="font-heading text-2xl text-foreground">{value}</div>
      {sub && <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
