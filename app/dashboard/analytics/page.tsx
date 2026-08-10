"use client";

import { useEffect, useState, ReactNode, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart2, Calendar as CalendarIcon } from "lucide-react";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import Image from "next/image";
import { AnalyticsIncomeChart } from "@/features/dashboard/components/analytics-income-chart";


type TicketLog = {
  id: number;
  account_name: string;
  increment: number;
  created_at: string;
};

type IncomeLog = {
  id: string;
  account_name: string;
  gmto_amount: number;
  created_at: string;
};

type FilterType = 'today' | 'weekly' | 'monthly' | 'all';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('today');
  
  const [ticketLogs, setTicketLogs] = useState<TicketLog[]>([]);
  const [incomeLogs, setIncomeLogs] = useState<IncomeLog[]>([]);
  const [todayTicketsCount, setTodayTicketsCount] = useState(0);
  const [todayAccountsCount, setTodayAccountsCount] = useState(0);
  const [todayActiveAccounts, setTodayActiveAccounts] = useState<string[]>([]);
  
  const [ticketPage, setTicketPage] = useState(1);
  const [incomePage, setIncomePage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  
  const [currency, setCurrency] = useState("usd");
  const [gmtoPrice, setGmtoPrice] = useState(0.30);
  
  const supabase = createClient();

  useEffect(() => {
    
    async function fetchData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      if (user.user_metadata?.currency) {
        setCurrency(user.user_metadata.currency);
      }

      // Fetch GMTO Price via server-side proxy (avoids CORS)
      const userCurrency = user.user_metadata?.currency || "usd";
      fetch(`/api/gmto-price?currency=${userCurrency}`)
        .then(res => res.json())
        .then(data => {
          if (data["game-meteor-coin"] && data["game-meteor-coin"][userCurrency]) {
            setGmtoPrice(data["game-meteor-coin"][userCurrency]);
          }
        })
        .catch(err => console.warn("Failed to fetch GMTO price", err));

      // Calculate date ranges based on filter
      let startDate = new Date();
      if (filter === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (filter === 'weekly') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
      } else if (filter === 'monthly') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(0); // Beginning of time for 'all'
      }

      const isoDate = startDate.toISOString();

      // Fetch current tickets for 'today' total
      const { data: accounts } = await supabase
        .from('user_accounts')
        .select('name, tickets_done');
      if (accounts) {
        setTodayTicketsCount(accounts.reduce((sum: number, acc: { name: string, tickets_done: number }) => sum + acc.tickets_done, 0));
        const activeNames = accounts.filter((acc: { name: string, tickets_done: number }) => acc.tickets_done > 0).map((acc: { name: string, tickets_done: number }) => acc.name);
        setTodayAccountsCount(activeNames.length);
        setTodayActiveAccounts(activeNames);
      }

      // Fetch Ticket Logs
      const { data: tLogs } = await supabase
        .from('ticket_logs')
        .select('*')
        .gte('created_at', isoDate)
        .order('created_at', { ascending: false });

      if (tLogs) {
        setTicketLogs(tLogs);
      }

      // Fetch Income Logs
      const { data: iLogs } = await supabase
        .from('income_logs')
        .select('*')
        .gte('created_at', isoDate)
        .order('created_at', { ascending: false });

      if (iLogs) {
        setIncomeLogs(iLogs.map((l: { id: string, account_name: string, gmto_amount: string | number, created_at: string }) => ({
          ...l,
          gmto_amount: typeof l.gmto_amount === 'string' ? parseFloat(l.gmto_amount) : l.gmto_amount
        })));
      }
      
    }
    Promise.all([
      fetchData(),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]).finally(() => setLoading(false));
  }, [supabase, filter]);

  const currencySymbol = currency === "php" ? "₱" : currency === "eur" ? "€" : "$";

  // Calculate Aggregates
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // We only sum logs that are OLDER than today for the total, because today's tickets are perfectly captured by todayTicketsCount
  const oldLogs = ticketLogs.filter(log => new Date(log.created_at) < startOfToday);
  const oldTicketsCount = oldLogs.reduce((sum, log) => sum + log.increment, 0);
  const totalTickets = todayTicketsCount + oldTicketsCount;

  const activeAccountsCount = filter === 'today' 
    ? todayAccountsCount 
    : new Set([...todayActiveAccounts, ...oldLogs.map(log => log.account_name)]).size;

  const totalGMTO = incomeLogs.reduce((sum, log) => sum + log.gmto_amount, 0);
  const grossFiat = totalGMTO * gmtoPrice;
  const netFiat = grossFiat * 0.995;

  const chartData = useMemo(() => {
    const sortedLogs = [...incomeLogs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const grouped = sortedLogs.reduce((acc, log) => {
      const date = new Date(log.created_at);
      const key = filter === 'today' 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      if (!acc[key]) acc[key] = 0;
      acc[key] += log.gmto_amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([time, amount]) => ({
      time,
      amount,
      fiat: amount * gmtoPrice * 0.995
    }));
  }, [incomeLogs, filter, gmtoPrice]);

  const paginatedTickets = ticketLogs.slice((ticketPage - 1) * ITEMS_PER_PAGE, ticketPage * ITEMS_PER_PAGE);
  const totalTicketPages = Math.max(1, Math.ceil(ticketLogs.length / ITEMS_PER_PAGE));

  const paginatedIncome = incomeLogs.slice((incomePage - 1) * ITEMS_PER_PAGE, incomePage * ITEMS_PER_PAGE);
  const totalIncomePages = Math.max(1, Math.ceil(incomeLogs.length / ITEMS_PER_PAGE));

  return (
    <div className="px-6 py-10 relative min-h-screen">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
              <BarChart2 className="size-3 mr-2" />
              Analytics
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
              History & Reports
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Track your tickets and income over time.
            </p>
          </div>
          
          <div className="flex bg-background/50 border border-border/40 rounded-md p-1 self-start sm:self-auto">
            {(['today', 'weekly', 'monthly', 'all'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setTicketPage(1);
                  setIncomePage(1);
                }}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition-colors ${
                  filter === f 
                    ? "bg-foreground text-background" 
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
            <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard 
                label={`Tickets (${filter})`}
                value={`${totalTickets} Tix`}
                sub={`Across ${activeAccountsCount} accounts`}
                icon={<Image src="/repair-ticket.png" alt="ticket" width={24} height={24} className="opacity-70" />}
              />
              <StatCard 
                label={`Gross Income (${filter})`}
                value={`${currencySymbol}${grossFiat.toFixed(2)}`}
                sub={`${totalGMTO.toFixed(2)} GMTO logged`}
                icon={<Image src="/gmto.png" alt="gmto" width={24} height={24} className="opacity-70" />}
              />
              <StatCard 
                label={`Net Income (${filter})`}
                value={`${currencySymbol}${netFiat.toFixed(2)}`}
                sub={`- 0.5% default fee`}
                icon={<CalendarIcon className="size-4 opacity-40" />}
              />
            </div>

            {chartData.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-background/40 p-6 h-[340px]">
                <AnalyticsIncomeChart
                  data={chartData}
                  currencySymbol={currencySymbol}
                  filter={filter}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border/60 bg-background/40 p-4 flex flex-col h-[400px]">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] mb-4">
                  Ticket Logs
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {ticketLogs.length === 0 ? (
                    <div className="text-sm text-muted-foreground flex h-full items-center justify-center">No ticket activity found.</div>
                  ) : (
                    paginatedTickets.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-2 rounded-md hover:bg-foreground/[0.02]">
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.account_name}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                        <div className={`flex items-center space-x-1.5 font-mono text-sm ${log.increment > 0 ? "text-emerald-500" : "text-destructive"}`}>
                          <span>{log.increment > 0 ? "+" : ""}{log.increment}</span>
                          <Image src="/repair-ticket.png" alt="Tix" width={18} height={18} className="opacity-90" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {totalTicketPages > 1 && (
                  <div className="flex justify-between items-center mt-4 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                    <button 
                      disabled={ticketPage === 1} 
                      onClick={() => setTicketPage(p => Math.max(1, p - 1))}
                      className="hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                    >
                      &larr; Prev
                    </button>
                    <span>Page {ticketPage} of {totalTicketPages}</span>
                    <button 
                      disabled={ticketPage === totalTicketPages} 
                      onClick={() => setTicketPage(p => Math.min(totalTicketPages, p + 1))}
                      className="hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                    >
                      Next &rarr;
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-4 flex flex-col h-[400px]">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] mb-4">
                  Income Logs
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {incomeLogs.length === 0 ? (
                    <div className="text-sm text-muted-foreground flex h-full items-center justify-center">No income logs found.</div>
                  ) : (
                    paginatedIncome.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-2 rounded-md hover:bg-foreground/[0.02]">
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.account_name}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end space-x-1.5 text-sm font-medium text-emerald-500">
                            <span>+{log.gmto_amount}</span>
                            <Image src="/gmto.png" alt="GMTO" width={18} height={18} className="opacity-90" />
                          </div>
                          <div className="text-[10px] text-muted-foreground">≈ {currencySymbol}{(log.gmto_amount * gmtoPrice * 0.995).toFixed(2)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {totalIncomePages > 1 && (
                  <div className="flex justify-between items-center mt-4 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                    <button 
                      disabled={incomePage === 1} 
                      onClick={() => setIncomePage(p => Math.max(1, p - 1))}
                      className="hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                    >
                      &larr; Prev
                    </button>
                    <span>Page {incomePage} of {totalIncomePages}</span>
                    <button 
                      disabled={incomePage === totalIncomePages} 
                      onClick={() => setIncomePage(p => Math.min(totalIncomePages, p + 1))}
                      className="hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                    >
                      Next &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {label}
        </div>
        {icon}
      </div>
      <div className="mt-2 font-heading text-2xl text-foreground">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{sub}</div>
    </div>
  );
}
