"use client";

import { CalendarIcon, CheckIcon, CircleIcon, PlusIcon, WalletIcon, MinusIcon, ChevronDownIcon, LinkIcon, SearchIcon, PencilIcon, TrashIcon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";

import { GmtoChartConverter } from "@/features/dashboard/components/gmto-chart-converter";
import { ReactNode, useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// Admin provided avatar choices
const AVATAR_MAP: Record<string, ReactNode> = {
  Avatar1: <Image src="/Avatar1.png" alt="Avatar1" width={40} height={40} className="size-full object-cover" />,
  Avatar2: <Image src="/Avatar2.png" alt="Avatar2" width={40} height={40} className="size-full object-cover" />,
  Avatar3: <Image src="/Avatar3.png" alt="Avatar3" width={40} height={40} className="size-full object-cover" />,
  Avatar4: <Image src="/Avatar4.png" alt="Avatar4" width={40} height={40} className="size-full object-cover" />,
  Avatar5: <Image src="/Avatar5.png" alt="Avatar5" width={40} height={40} className="size-full object-cover" />,
  Avatar6: <Image src="/Avatar6.png" alt="Avatar6" width={40} height={40} className="size-full object-cover" />,
};
const AVATAR_OPTIONS = Object.keys(AVATAR_MAP);

// Types
type Account = { id: number; name: string; ticketsDone: number; totalTickets: number; avatar: string; referralLink: string | null; walletAddress: string | null; email: string | null };
type IncomeLog = { id: string; time: string; title: string; gmto: number; color: string };

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", php: "₱", eur: "€" };

export default function UserDashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [incomeLogs, setIncomeLogs] = useState<IncomeLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  
  // Pagination State
  const [accountsPage, setAccountsPage] = useState(1);
  const [incomePage, setIncomePage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  
  const [searchQuery, setSearchQuery] = useState("");
  const filteredAccounts = accounts.filter(acc => acc.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  // Add Account State
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountReferralLink, setNewAccountReferralLink] = useState("");
  const [newAccountWalletAddress, setNewAccountWalletAddress] = useState("");
  const [newAccountAvatar, setNewAccountAvatar] = useState("Avatar1");

  // Edit Account State
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountEmail, setEditAccountEmail] = useState("");
  const [editAccountReferralLink, setEditAccountReferralLink] = useState("");
  const [editAccountWalletAddress, setEditAccountWalletAddress] = useState("");
  const [editAccountAvatar, setEditAccountAvatar] = useState("Avatar1");

  // View Wallet State
  const [isViewWalletModalOpen, setIsViewWalletModalOpen] = useState(false);
  const [viewWalletAddress, setViewWalletAddress] = useState("");
  const [isWalletCopied, setIsWalletCopied] = useState(false);

  // Edit Log State
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [editLogGmto, setEditLogGmto] = useState("");

  // Delete Modal State
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);
  
  const [isDeleteLogModalOpen, setIsDeleteLogModalOpen] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [gmtoEarned, setGmtoEarned] = useState("");
  
  const [currency, setCurrency] = useState("usd");
  const [gmtoPrice, setGmtoPrice] = useState(0.30); // Default fallback price
  
  const [nickname, setNickname] = useState("User");
  const [userId, setUserId] = useState<string | null>(null);
  
  const supabase = createClient();

  // Fetch initial dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);
      if (user.user_metadata?.nickname) {
        setNickname(user.user_metadata.nickname);
      }
      if (user.user_metadata?.currency) {
        setCurrency(user.user_metadata.currency);
      }
      
      const { data: accountsData } = await supabase
        .from('user_accounts')
        .select('*')
        .order('id', { ascending: true });
        
      if (accountsData) {
        setAccounts(accountsData.map(acc => ({
          id: acc.id,
          name: acc.name,
          ticketsDone: acc.tickets_done,
          totalTickets: acc.total_tickets,
          avatar: acc.avatar,
          referralLink: acc.referral_link,
          walletAddress: acc.wallet_address,
          email: acc.email
        })));
        if (accountsData.length > 0) setSelectedAccountId(accountsData[0].id);
      }
      
      // Fetch today's income logs
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const { data: logsData } = await supabase
        .from('income_logs')
        .select('*')
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false });
        
      if (logsData) {
        setIncomeLogs(logsData.map(log => ({
          id: log.id.toString(),
          time: new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          title: log.account_name,
          gmto: parseFloat(log.gmto_amount),
          color: log.color
        })));
      }
    };
    
    Promise.all([
      fetchDashboardData(),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]).finally(() => setLoading(false));

    // Re-fetch data when the window regains focus (e.g. switching back from another tab)
    window.addEventListener("focus", fetchDashboardData);
    return () => window.removeEventListener("focus", fetchDashboardData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch GMTO price via server-side proxy (avoids CORS)
  useEffect(() => {
    fetch(`/api/gmto-price?currency=${currency}`)
      .then(res => res.json())
      .then(data => {
        if (data["game-meteor-coin"] && data["game-meteor-coin"][currency]) {
          setGmtoPrice(data["game-meteor-coin"][currency]);
        }
      })
      .catch(err => console.warn("Failed to fetch GMTO price", err));
  }, [currency]);

  // Compute dynamic stats
  const totalTicketsLogged = accounts.reduce((sum, acc) => sum + acc.ticketsDone, 0);
  const totalMaxTickets = accounts.reduce((sum, acc) => sum + acc.totalTickets, 0);
  
  const totalGross = incomeLogs.reduce((sum, log) => sum + (log.gmto * gmtoPrice), 0);
  const totalNet = incomeLogs.reduce((sum, log) => sum + ((log.gmto * gmtoPrice) * 0.995), 0);

  const updateTicket = async (id: number, delta: number) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;
    
    const newCount = Math.max(0, Math.min(account.totalTickets, account.ticketsDone + delta));
    const actualDelta = newCount - account.ticketsDone;
    if (actualDelta === 0) return;
    
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, ticketsDone: newCount } : acc))
    );
    
    await supabase
      .from('user_accounts')
      .update({ tickets_done: newCount })
      .eq('id', id);

    if (userId) {
      await supabase
        .from('ticket_logs')
        .insert({
          user_id: userId,
          account_id: id,
          account_name: account.name,
          increment: actualDelta
        });
    }
  };

  const handleLogIncome = async () => {
    const gmto = parseFloat(gmtoEarned);
    if (isNaN(gmto) || gmto <= 0 || !userId) return;
    
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    const newLog = {
      user_id: userId,
      account_id: account.id,
      account_name: account.name,
      gmto_amount: gmto,
      color: "bg-emerald-500/80" 
    };

    const { data, error } = await supabase
      .from('income_logs')
      .insert(newLog)
      .select()
      .single();

    if (!error && data) {
      const formattedLog = {
        id: data.id.toString(),
        time: new Date(data.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        title: data.account_name,
        gmto: parseFloat(data.gmto_amount),
        color: data.color
      };
      setIncomeLogs(prev => [formattedLog, ...prev]);
    }

    setIsModalOpen(false);
    setGmtoEarned("");
  };

  const openDeleteAccountModal = (id: number) => {
    setDeleteAccountId(id);
    setIsDeleteAccountModalOpen(true);
  };

  const confirmDeleteAccount = async () => {
    if (deleteAccountId === null) return;
    
    // Optimistic UI update
    setAccounts(prev => prev.filter(acc => acc.id !== deleteAccountId));
    
    const { error } = await supabase
      .from('user_accounts')
      .delete()
      .eq('id', deleteAccountId);
      
    if (error) console.error("Error deleting account:", error);
    setIsDeleteAccountModalOpen(false);
    setDeleteAccountId(null);
  };

  const openEditAccountModal = (acc: Account) => {
    setEditAccountId(acc.id);
    setEditAccountName(acc.name);
    setEditAccountEmail(acc.email || "");
    setEditAccountReferralLink(acc.referralLink || "");
    setEditAccountWalletAddress(acc.walletAddress || "");
    setEditAccountAvatar(acc.avatar || "Avatar1");
    setIsEditAccountModalOpen(true);
  };

  const openViewWalletModal = (walletAddress: string) => {
    setViewWalletAddress(walletAddress);
    setIsViewWalletModalOpen(true);
  };

  const handleUpdateAccount = async () => {
    if (!editAccountId || !editAccountName.trim()) return;

    const { error } = await supabase
      .from('user_accounts')
      .update({
        name: editAccountName.trim(),
        avatar: editAccountAvatar,
        email: editAccountEmail.trim() || null,
        referral_link: editAccountReferralLink.trim() || null,
        wallet_address: editAccountWalletAddress.trim() || null
      })
      .eq('id', editAccountId);

    if (!error) {
      setAccounts(prev => prev.map(acc => acc.id === editAccountId ? {
        ...acc,
        name: editAccountName.trim(),
        avatar: editAccountAvatar,
        email: editAccountEmail.trim() || null,
        referralLink: editAccountReferralLink.trim() || null,
        walletAddress: editAccountWalletAddress.trim() || null
      } : acc));
    }
    
    setIsEditAccountModalOpen(false);
  };

  const openDeleteLogModal = (id: string) => {
    setDeleteLogId(id);
    setIsDeleteLogModalOpen(true);
  };

  const confirmDeleteLog = async () => {
    if (!deleteLogId) return;
    
    setIncomeLogs(prev => prev.filter(log => log.id !== deleteLogId));
    
    const { error } = await supabase
      .from('income_logs')
      .delete()
      .eq('id', deleteLogId);
      
    if (error) console.error("Error deleting log:", error);
    setIsDeleteLogModalOpen(false);
    setDeleteLogId(null);
  };

  const openEditLogModal = (log: IncomeLog) => {
    setEditLogId(log.id);
    setEditLogGmto(log.gmto.toString());
    setIsEditLogModalOpen(true);
  };

  const handleUpdateLog = async () => {
    if (!editLogId) return;
    const gmto = parseFloat(editLogGmto);
    if (isNaN(gmto) || gmto <= 0) return;

    const { error } = await supabase
      .from('income_logs')
      .update({ gmto_amount: gmto })
      .eq('id', editLogId);

    if (!error) {
      setIncomeLogs(prev => prev.map(log => log.id === editLogId ? { ...log, gmto } : log));
    }

    setIsEditLogModalOpen(false);
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim() || !userId) return;
    
    const newAccountData = {
      user_id: userId,
      name: newAccountName.trim(),
      tickets_done: 0,
      total_tickets: 10,
      avatar: newAccountAvatar,
      email: newAccountEmail.trim() || null,
      referral_link: newAccountReferralLink.trim() || null,
      wallet_address: newAccountWalletAddress.trim() || null
    };

    const { data, error } = await supabase
      .from('user_accounts')
      .insert(newAccountData)
      .select()
      .single();

    if (!error && data) {
      setAccounts(prev => [...prev, {
        id: data.id,
        name: data.name,
        ticketsDone: data.tickets_done,
        totalTickets: data.total_tickets,
        avatar: data.avatar,
        email: data.email,
        referralLink: data.referral_link,
        walletAddress: data.wallet_address
      }]);
      if (selectedAccountId === null) setSelectedAccountId(data.id);
    }
    
    setNewAccountName("");
    setNewAccountEmail("");
    setNewAccountReferralLink("");
    setNewAccountWalletAddress("");
    setNewAccountAvatar("Avatar1");
    setIsAddAccountModalOpen(false);
  };

  const currencySymbol = CURRENCY_SYMBOLS[currency] || "$";
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getModeText = () => {
    const day = new Date().getDay(); // 0 is Sunday, 3 is Wednesday
    if (day === 0 || day === 3) return "SAFE MODE";
    return "CHALLENGE MODE";
  };
  
  const getModeColor = () => {
    const day = new Date().getDay();
    if (day === 0 || day === 3) return "text-emerald-500 font-bold";
    return "text-orange-500 font-bold";
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
        <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
      </div>
    );
  }

  return (
    <div className="px-6 py-10 relative min-h-screen">
      <div className="mx-auto max-w-7xl">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2">
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
              <span>—</span>
              <span className={getModeColor()}>{getModeText()}</span>
            </div>
            <h1 className="mt-1 font-heading text-4xl tracking-tight text-foreground">
              {getGreeting()}, {nickname}.
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground text-sm">
              You have {accounts.filter(acc => acc.ticketsDone < acc.totalTickets).length} accounts pending for quota today. Keep up the grind!
            </p>
          </div>
          
          <div className="flex flex-col items-start sm:items-end space-y-1.5 relative">
            <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Currency</label>
            <button 
              type="button"
              onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
              className="w-28 flex items-center justify-between rounded-md border border-input bg-background/50 px-3 py-1.5 text-xs font-medium ring-offset-background hover:bg-background/80 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <span>{currency.toUpperCase()} ({currencySymbol})</span>
              <ChevronDownIcon className="size-3 text-muted-foreground" />
            </button>
            {isCurrencyDropdownOpen && (
              <div className="absolute top-[100%] right-0 z-50 mt-1 w-28 rounded-md border border-border bg-card text-card-foreground shadow-md outline-none">
                <div className="flex flex-col py-1">
                  {Object.keys(CURRENCY_SYMBOLS).map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={async () => { 
                        setCurrency(key); 
                        setIsCurrencyDropdownOpen(false); 
                        await supabase.auth.updateUser({ data: { currency: key } });
                      }}
                      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs font-medium outline-none hover:bg-foreground/5 transition-colors ${currency === key ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {currency === key && <CheckIcon className="size-3 text-foreground" />}
                      </span>
                      {key.toUpperCase()} ({CURRENCY_SYMBOLS[key]})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fact Cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FactCard 
            label="Tickets Logged" 
            value={`${totalTicketsLogged} / ${totalMaxTickets}`} 
            sub={`across ${accounts.length} accounts today`} 
            icon={<Image src="/repair-ticket.png" alt="ticket" width={24} height={24} className="object-contain" />}
          />
          <FactCard 
            label="Gross Income" 
            value={`${currencySymbol}${totalGross.toFixed(2)}`} 
            sub={`$GMTO Price: ${currencySymbol}${gmtoPrice.toFixed(6)}`} 
            icon={<Image src="/gmto.png" alt="gmto" width={24} height={24} className="object-contain" />}
          />
          <FactCard 
            label="Net Income" 
            value={`${currencySymbol}${totalNet.toFixed(2)}`} 
            sub="- 0.5% default fee" 
            icon={<WalletIcon className="size-4 opacity-50" />}
          />
        </div>

        {/* Quota and Income Grid */}
        <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
          
          {/* Active Accounts & Quota */}
          <DashboardCard 
            title="Active Accounts Quota" 
            trailing={
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <SearchIcon className="size-3 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setAccountsPage(1);
                    }}
                    className="w-24 sm:w-32 rounded-md border border-input bg-background/50 pl-6 pr-2 py-1.5 text-[10px] sm:text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                  />
                </div>
                <Button onClick={() => setIsAddAccountModalOpen(true)} variant="ghost" size="sm" className="h-8 px-2 sm:px-3">
                  <PlusIcon className="size-3.5 sm:size-4 sm:mr-1" />
                  <span className="hidden sm:inline text-xs">Add</span>
                </Button>
              </div>
            }
          >
            <ul className="mt-1 flex flex-col min-h-[220px]">
              {filteredAccounts.slice((accountsPage - 1) * ITEMS_PER_PAGE, accountsPage * ITEMS_PER_PAGE).map((account) => {
                const isDone = account.ticketsDone === account.totalTickets;
                return (
                  <li
                    key={account.id}
                    className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isDone
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                          : "border-foreground/30 text-transparent"
                      }`}
                    >
                      {isDone ? (
                        <CheckIcon className="size-3" />
                      ) : (
                        <CircleIcon className="size-3" />
                      )}
                    </div>
                    
                    {/* Account Avatar */}
                    <div className="flex items-center justify-center size-9 bg-accent rounded-full text-accent-foreground ml-1 overflow-hidden shrink-0">
                      {AVATAR_MAP[account.avatar || "Avatar1"]}
                    </div>

                    <span
                      className={`flex-1 truncate text-sm transition-all flex items-center gap-2 ${isDone ? "text-emerald-500" : "text-foreground"}`}
                    >
                      {account.name}
                      {account.referralLink && (
                        <a href={account.referralLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center" title="Open Referral Link">
                          <LinkIcon className="size-3" />
                        </a>
                      )}
                      {account.walletAddress && (
                        <button onClick={() => openViewWalletModal(account.walletAddress!)} className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center" title="View Wallet Address">
                          <WalletIcon className="size-3" />
                        </button>
                      )}
                      {account.email && (
                        <button onClick={() => { navigator.clipboard.writeText(account.email!); alert("Email copied to clipboard!"); }} className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center active:scale-95" title="Copy Email">
                          <MailIcon className="size-3" />
                        </button>
                      )}
                    </span>
                    
                    {/* Action Buttons */}
                    <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 mr-2 transition-opacity shrink-0">
                      <button onClick={() => openEditAccountModal(account)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Edit Account">
                        <PencilIcon className="size-3.5" />
                      </button>
                      <button onClick={() => openDeleteAccountModal(account.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors" title="Delete Account">
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>

                    {/* Interactive Ticket Logger */}
                    <div className="flex items-center justify-end gap-1 font-mono text-[10px] uppercase tracking-[0.2em]">
                      <button 
                        onClick={() => updateTicket(account.id, -1)}
                        disabled={account.ticketsDone === 0}
                        className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <MinusIcon className="size-3" />
                      </button>
                      
                      <span className={`w-10 text-center ${isDone ? "text-emerald-500" : "text-muted-foreground/70"}`}>
                        {account.ticketsDone}/{account.totalTickets}
                      </span>
                      
                      <button 
                        onClick={() => updateTicket(account.id, 1)}
                        disabled={isDone}
                        className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <PlusIcon className="size-3" />
                      </button>

                      <Image src="/repair-ticket.png" alt="tix" width={24} height={24} className={`object-contain ml-1 transition-opacity ${isDone ? "opacity-50 grayscale" : "opacity-100"}`} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <PaginationControls 
              currentPage={accountsPage} 
              totalPages={Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE)} 
              onPageChange={setAccountsPage} 
            />
          </DashboardCard>

          {/* Today's Income Log */}
          <DashboardCard 
            title="Today's Income" 
            trailing={
              <Button onClick={() => setIsModalOpen(true)} variant="ghost" size="sm" className="h-8">
                <WalletIcon className="size-4 mr-1" />
                Log
              </Button>
            }
          >
            <ul className="mt-2 flex flex-col gap-2 min-h-[220px] pr-1">
              {incomeLogs.slice((incomePage - 1) * ITEMS_PER_PAGE, incomePage * ITEMS_PER_PAGE).map((log) => {
                const logGross = log.gmto * gmtoPrice;
                const logFee = logGross * 0.005;
                const logNet = logGross - logFee;

                return (
                  <li
                    key={log.id}
                    className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div className="flex w-12 flex-col items-center font-mono text-[11px]">
                      <span className="text-foreground">{log.time}</span>
                    </div>
                    <span className={`size-1.5 rounded-full ${log.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{log.title}</div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-muted-foreground text-xs">
                        <Image src="/gmto.png" alt="GMTO" width={20} height={20} className="object-contain" />
                        <span className="font-medium text-foreground/80">{log.gmto} GMTO</span>
                        <span className="opacity-50">•</span>
                        <span>Gross: {currencySymbol}{logGross.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                      <button onClick={() => openEditLogModal(log)} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit Log">
                        <PencilIcon className="size-3.5" />
                      </button>
                      <button onClick={() => openDeleteLogModal(log.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors" title="Delete Log">
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>

                    <div className="text-right ml-2 shrink-0">
                      <div className="text-sm font-medium text-emerald-500/90">+{currencySymbol}{logNet.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">- {currencySymbol}{logFee.toFixed(2)} fee</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <PaginationControls 
              currentPage={incomePage} 
              totalPages={Math.ceil(incomeLogs.length / ITEMS_PER_PAGE)} 
              onPageChange={setIncomePage} 
            />
          </DashboardCard>

        </div>

        {/* Weekly Calendar & Chart Section */}
        <div className="mt-8 flex flex-col gap-3">

          <GmtoChartConverter currency={currency} />
        </div>
      </div>
      
      {/* Log Income Modal Overlay */}
      <AnimatedModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Income"
        icon={<WalletIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Enter your generated income for the day.
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5 relative">
            <label className="text-sm font-medium text-foreground">Account</label>
            <button 
              type="button"
              onClick={() => setIsComboboxOpen(!isComboboxOpen)}
              className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <span className="truncate">{accounts.find(a => a.id === selectedAccountId)?.name || "Select account"}</span>
              <ChevronDownIcon className="size-4 opacity-50" />
            </button>
            {isComboboxOpen && (
              <div className="absolute top-[100%] left-0 z-[60] mt-1 w-full rounded-md border border-border bg-card text-card-foreground shadow-md outline-none">
                <div className="flex flex-col py-1">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => { setSelectedAccountId(acc.id); setIsComboboxOpen(false); }}
                      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-foreground/5 transition-colors ${selectedAccountId === acc.id ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {selectedAccountId === acc.id && <CheckIcon className="size-3 text-foreground" />}
                      </span>
                      {acc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Amount</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Image src="/gmto.png" alt="GMTO" width={24} height={24} className="object-contain" />
              </div>
              <input 
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. 50"
                value={gmtoEarned}
                onChange={(e) => setGmtoEarned(e.target.value)}
              />
            </div>
            <div className="text-[10px] text-muted-foreground flex justify-between mt-1 px-1">
              <span>Rate: {currencySymbol}{gmtoPrice.toFixed(6)} / GMTO</span>
              <span>Fee: 0.5%</span>
            </div>
          </div>

          <Button 
            onClick={handleLogIncome}
            className="w-full mt-2"
            disabled={!gmtoEarned || isNaN(parseFloat(gmtoEarned)) || parseFloat(gmtoEarned) <= 0}
          >
            Confirm
          </Button>
        </div>
      </AnimatedModal>

      {/* Add Account Modal Overlay */}
      <AnimatedModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        title="Add Account"
        icon={<PlusIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Configure a new account to log quotas.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Avatar Style</label>
            <div className="flex items-center gap-3">
              {AVATAR_OPTIONS.map((avatarKey) => {
                const isSelected = newAccountAvatar === avatarKey;
                return (
                  <button
                    key={avatarKey}
                    type="button"
                    onClick={() => setNewAccountAvatar(avatarKey)}
                    className={`flex items-center justify-center size-10 rounded-full transition-all overflow-hidden p-0 ${
                      isSelected 
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                        : "opacity-50 hover:opacity-100 hover:ring-1 hover:ring-border hover:ring-offset-1 hover:ring-offset-background"
                    }`}
                    title={avatarKey}
                  >
                    {AVATAR_MAP[avatarKey]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Account Name</label>
            <input 
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. Scholar 3"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                <MailIcon className="size-4 text-muted-foreground" />
              </div>
              <textarea 
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-y"
                placeholder="account@example.com"
                value={newAccountEmail}
                onChange={(e) => setNewAccountEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Referral Link (Optional)</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                <LinkIcon className="size-4 text-muted-foreground" />
              </div>
              <textarea 
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-y"
                placeholder="https://..."
                value={newAccountReferralLink}
                onChange={(e) => setNewAccountReferralLink(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Wallet Address (Optional)</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                <WalletIcon className="size-4 text-muted-foreground" />
              </div>
              <textarea 
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-y"
                placeholder="0x..."
                value={newAccountWalletAddress}
                onChange={(e) => setNewAccountWalletAddress(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleAddAccount}
            className="w-full mt-2"
            disabled={!newAccountName.trim()}
          >
            Create Account
          </Button>
        </div>
      </AnimatedModal>

      {/* Edit Account Modal */}
      <AnimatedModal
        isOpen={isEditAccountModalOpen}
        onClose={() => setIsEditAccountModalOpen(false)}
        title="Edit Account"
        icon={<PencilIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Avatar Style</label>
            <div className="flex items-center gap-3">
              {AVATAR_OPTIONS.map((avatarKey) => {
                const isSelected = editAccountAvatar === avatarKey;
                return (
                  <button
                    key={avatarKey}
                    type="button"
                    onClick={() => setEditAccountAvatar(avatarKey)}
                    className={`flex items-center justify-center size-10 rounded-full transition-all overflow-hidden p-0 ${
                      isSelected 
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                        : "opacity-50 hover:opacity-100 hover:ring-1 hover:ring-border hover:ring-offset-1 hover:ring-offset-background"
                    }`}
                    title={avatarKey}
                  >
                    {AVATAR_MAP[avatarKey]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Account Name</label>
            <input 
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={editAccountName}
              onChange={(e) => setEditAccountName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                <MailIcon className="size-4 text-muted-foreground" />
              </div>
              <textarea 
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-y"
                value={editAccountEmail}
                onChange={(e) => setEditAccountEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Referral Link (Optional)</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                <LinkIcon className="size-4 text-muted-foreground" />
              </div>
              <textarea 
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-y"
                value={editAccountReferralLink}
                onChange={(e) => setEditAccountReferralLink(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Wallet Address (Optional)</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                <WalletIcon className="size-4 text-muted-foreground" />
              </div>
              <textarea 
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-y"
                value={editAccountWalletAddress}
                onChange={(e) => setEditAccountWalletAddress(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleUpdateAccount}
            className="w-full mt-2"
            disabled={!editAccountName.trim()}
          >
            Save Changes
          </Button>
        </div>
      </AnimatedModal>

      {/* Edit Log Modal */}
      <AnimatedModal
        isOpen={isEditLogModalOpen}
        onClose={() => setIsEditLogModalOpen(false)}
        title="Edit Log"
        icon={<PencilIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">GMTO Amount</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Image src="/gmto.png" alt="GMTO" width={24} height={24} className="object-contain" />
              </div>
              <input 
                type="number"
                className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={editLogGmto}
                onChange={(e) => setEditLogGmto(e.target.value)}
                step="0.01"
              />
            </div>
          </div>

          <Button 
            onClick={handleUpdateLog}
            className="w-full mt-2"
            disabled={!editLogGmto || isNaN(parseFloat(editLogGmto)) || parseFloat(editLogGmto) <= 0}
          >
            Save Changes
          </Button>
        </div>
      </AnimatedModal>

      {/* Delete Account Modal */}
      <AnimatedModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
        title="Delete Account"
        icon={<TrashIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this account? This action cannot be undone.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setIsDeleteAccountModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteAccount}>Delete Account</Button>
          </div>
        </div>
      </AnimatedModal>

      {/* Delete Log Modal */}
      <AnimatedModal
        isOpen={isDeleteLogModalOpen}
        onClose={() => setIsDeleteLogModalOpen(false)}
        title="Delete Log"
        icon={<TrashIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this income log? This action cannot be undone.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setIsDeleteLogModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteLog}>Delete Log</Button>
          </div>
        </div>
      </AnimatedModal>

      {/* View Wallet Modal */}
      <AnimatedModal
        isOpen={isViewWalletModalOpen}
        onClose={() => setIsViewWalletModalOpen(false)}
        title="Wallet Address"
        icon={<WalletIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <div className="space-y-4 mt-2 flex flex-col items-center">
          <div className="size-48 bg-white p-2 rounded-md border flex items-center justify-center">
            {viewWalletAddress ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${viewWalletAddress}`} alt="QR Code" className="size-full object-contain" />
              </>
            ) : (
              <span className="text-muted-foreground text-sm">No wallet address</span>
            )}
          </div>
          <div className="w-full relative">
            <input 
              type="text" 
              readOnly 
              value={viewWalletAddress} 
              className="w-full rounded-md border border-input bg-background pl-3 pr-24 py-2 text-sm text-muted-foreground focus:outline-none truncate"
            />
            <Button 
              size="sm" 
              variant="secondary" 
              className={`absolute right-1 top-1 bottom-1 h-auto text-xs transition-all duration-200 ${isWalletCopied ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30" : ""}`}
              onClick={() => {
                navigator.clipboard.writeText(viewWalletAddress);
                setIsWalletCopied(true);
                setTimeout(() => setIsWalletCopied(false), 2000);
              }}
            >
              {isWalletCopied ? (
                <span className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                  <CheckIcon className="size-3" /> Copied
                </span>
              ) : (
                <span className="animate-in fade-in zoom-in duration-200">Copy</span>
              )}
            </Button>
          </div>
        </div>
      </AnimatedModal>

    </div>
  );
}

function DashboardCard({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {title}
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
      <button 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1}
        className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        Prev
      </button>
      <div className="text-[10px] font-mono text-muted-foreground">
        {currentPage} / {totalPages}
      </div>
      <button 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages}
        className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        Next
      </button>
    </div>
  );
}

function FactCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {label}
        </div>
        {icon || <CalendarIcon className="size-3.5 opacity-40" />}
      </div>
      <div className="mt-2 font-heading text-2xl text-foreground">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{sub}</div>
    </div>
  );
}
