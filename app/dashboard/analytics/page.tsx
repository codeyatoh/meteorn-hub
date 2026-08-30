"use client";

import { useEffect, useState, ReactNode, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart2 } from "lucide-react";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { GuideModal } from "@/components/ui/guide-modal";
import Image from "next/image";
import { AnalyticsIncomeChart } from "@/features/dashboard/components/analytics-income-chart";
import { PageContainer } from "@/components/ui/page-container";


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
  is_sold: boolean;
  fiat_received: number;
  fiat_currency: string;
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
  const [cashoutPage, setCashoutPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  
  const [currency, setCurrency] = useState("usd");
  const [gmtoPrice, setGmtoPrice] = useState(0);
  const [allGmtoPrices, setAllGmtoPrices] = useState<Record<string, number>>({});
  
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
      
      const cachedPrices = localStorage.getItem('gmto_all_prices');
      if (cachedPrices) {
        setTimeout(() => {
          try {
            const parsed = JSON.parse(cachedPrices);
            setAllGmtoPrices(parsed);
            if (parsed[userCurrency]) {
              setGmtoPrice(parsed[userCurrency]);
            }
          } catch {}
        }, 0);
      }

      fetch(`/api/gmto-price`)
        .then(res => res.json())
        .then(data => {
          if (data["game-meteor-coin"]) {
            const prices = data["game-meteor-coin"];
            setAllGmtoPrices(prices);
            localStorage.setItem('gmto_all_prices', JSON.stringify(prices));
            if (prices[userCurrency]) {
              setGmtoPrice(prices[userCurrency]);
            }
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
        setIncomeLogs(iLogs.map(l => ({
          ...l,
          gmto_amount: typeof l.gmto_amount === 'string' ? parseFloat(l.gmto_amount) : l.gmto_amount,
          fiat_received: typeof l.fiat_received === 'string' ? parseFloat(l.fiat_received) : l.fiat_received,
          fiat_currency: l.fiat_currency || 'php'
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

  const getConvertedFiat = useCallback((amount: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency || !allGmtoPrices[fromCurrency] || !allGmtoPrices[toCurrency]) return amount;
    const exchangeRate = allGmtoPrices[toCurrency] / allGmtoPrices[fromCurrency];
    return amount * exchangeRate;
  }, [allGmtoPrices]);

  const totalGMTOEarned = incomeLogs.reduce((sum, log) => sum + log.gmto_amount, 0);
  const totalGMTOSold = incomeLogs.filter(l => l.is_sold).reduce((sum, log) => sum + log.gmto_amount, 0);
  const totalUnsoldGMTO = Math.max(0, totalGMTOEarned - totalGMTOSold);

  const totalFiatRealized = incomeLogs.filter(l => l.is_sold).reduce((sum, log) => sum + getConvertedFiat(log.fiat_received, log.fiat_currency, currency), 0);
  const grossFiat = (totalUnsoldGMTO * gmtoPrice) + totalFiatRealized;

  const chartData = useMemo(() => {
    // Only use sold logs (cashouts) for the chart
    const soldLogs = incomeLogs.filter(log => log.is_sold);
    const grouped = soldLogs.reduce((acc, log) => {
      const date = new Date(log.created_at);
      const key = filter === 'today' 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      if (!acc[key]) acc[key] = { gmto: 0, fiat: 0 };
      acc[key].gmto += log.gmto_amount;
      acc[key].fiat += getConvertedFiat(log.fiat_received, log.fiat_currency, currency);
      
      return acc;
    }, {} as Record<string, { gmto: number; fiat: number }>);

    return Object.entries(grouped).map(([time, data]) => ({
      time,
      amount: data.gmto,
      fiat: data.fiat
    }));
  }, [incomeLogs, filter, currency, getConvertedFiat]);

  const paginatedTickets = ticketLogs.slice((ticketPage - 1) * ITEMS_PER_PAGE, ticketPage * ITEMS_PER_PAGE);
  const totalTicketPages = Math.max(1, Math.ceil(ticketLogs.length / ITEMS_PER_PAGE));

  const paginatedIncome = incomeLogs.slice((incomePage - 1) * ITEMS_PER_PAGE, incomePage * ITEMS_PER_PAGE);
  const totalIncomePages = Math.max(1, Math.ceil(incomeLogs.length / ITEMS_PER_PAGE));

  const cashouts = incomeLogs.filter(l => l.is_sold);
  const paginatedCashouts = cashouts.slice((cashoutPage - 1) * ITEMS_PER_PAGE, cashoutPage * ITEMS_PER_PAGE);
  const totalCashoutPages = Math.max(1, Math.ceil(cashouts.length / ITEMS_PER_PAGE));

  return (
    <PageContainer>
                <div className="mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
              <BarChart2 className="size-3 mr-2" />
              Analytics
            </div>
          <div className="flex items-center justify-between gap-4 mt-3 sm:mt-0">
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
              History & Reports
            </h1>
            <div className="shrink-0">
              <GuideModal title="Understanding Analytics">
                <p>The Analytics dashboard helps you track your Meteorn Hub activity and earnings over time.</p>
                <ul className="list-disc pl-4 space-y-2 mt-2">
                  <li><strong>Tickets:</strong> View your daily, weekly, or monthly ticket usage across all your registered game accounts.</li>
                  <li><strong>Income & Cashouts:</strong> Track the GMTO you earn and cash out, converted to your preferred local fiat currency in real-time.</li>
                  <li><strong>Time Filters:</strong> Use the filters to drill down into specific timeframes to spot trends.</li>
                </ul>
              </GuideModal>
            </div>
          </div>
          <p className="mt-2 text-muted-foreground text-sm">
            Track your tickets and income over time.
          </p>
        </div>

        {loading ? (
          <div className="fixed inset-0 z-[100] bg-background flex h-screen w-full items-center justify-center">
            <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard 
                label={`Tickets (${filter})`}
                value={`${totalTickets} Tix`}
                sub={`Across ${activeAccountsCount} accounts`}
                icon={<Image src="/repair-ticket.png" alt="ticket" width={24} height={24} className="opacity-70" />}
              />
              <StatCard 
                label={`Total Income (${filter})`}
                value={
                  gmtoPrice === 0 || allGmtoPrices[currency] === undefined 
                    ? <span className="animate-pulse opacity-50">...</span> 
                    : `${currencySymbol}${grossFiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
                sub={`${totalGMTOEarned.toFixed(2)} GMTO earned (${totalGMTOSold > 0 ? `${totalGMTOSold.toFixed(2)} sold` : '0 sold'})`}
                icon={<Image src="/gmto.png" alt="gmto" width={24} height={24} className="opacity-70" />}
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-6 h-[340px]">
              <AnalyticsIncomeChart
                data={chartData}
                currencySymbol={currencySymbol}
                filter={filter}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                {ticketLogs.length > 0 && (
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
                          <div className="text-[10px] text-muted-foreground">≈ {currencySymbol}{(log.gmto_amount * gmtoPrice).toFixed(2)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {incomeLogs.length > 0 && (
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

              <div className="rounded-xl border border-border/60 bg-background/40 p-4 flex flex-col h-[400px]">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] mb-4">
                  Cashout Logs
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {cashouts.length === 0 ? (
                    <div className="text-sm text-muted-foreground flex h-full items-center justify-center">No cashouts found.</div>
                  ) : (
                    paginatedCashouts.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-2 rounded-md hover:bg-foreground/[0.02]">
                        <div>
                          <p className="text-sm font-medium text-foreground">{currencySymbol}{log.fiat_received}</p>
                          <p className="text-[10px] text-muted-foreground">{log.account_name}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end space-x-1.5 text-sm font-medium text-destructive">
                            <span>-{log.gmto_amount}</span>
                            <Image src="/gmto.png" alt="GMTO" width={18} height={18} className="opacity-90" />
                          </div>
                          <div className="text-[10px] text-muted-foreground">Sold @ {currencySymbol}{(log.fiat_received / log.gmto_amount).toFixed(6)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {cashouts.length > 0 && (
                  <div className="flex justify-between items-center mt-4 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                    <button 
                      disabled={cashoutPage === 1} 
                      onClick={() => setCashoutPage(p => Math.max(1, p - 1))}
                      className="hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                    >
                      &larr; Prev
                    </button>
                    <span>Page {cashoutPage} of {totalCashoutPages}</span>
                    <button 
                      disabled={cashoutPage === totalCashoutPages} 
                      onClick={() => setCashoutPage(p => Math.min(totalCashoutPages, p + 1))}
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
    </PageContainer>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: ReactNode; sub: string; icon?: ReactNode }) {
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
