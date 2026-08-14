"use client";

import { CalendarIcon, CheckIcon, CircleIcon, PlusIcon, WalletIcon, MinusIcon, ChevronDownIcon, LinkIcon, SearchIcon, PencilIcon, TrashIcon, MailIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
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
type IncomeLog = { id: string; time: string; title: string; gmto: number; color: string; is_sold: boolean; fiat_received: number };

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", php: "₱", eur: "€" };

export default function UserDashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [incomeLogs, setIncomeLogs] = useState<IncomeLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  
  // Pagination State
  const [accountsPage, setAccountsPage] = useState(1);
  const [incomePage, setIncomePage] = useState(1);
  const ACCOUNTS_PER_PAGE = 8;
  const INCOME_PER_PAGE = 5;
  
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
  
  const [cashoutAccountIds, setCashoutAccountIds] = useState<string[]>([]);
  const [cashoutFiat, setCashoutFiat] = useState("");
  const [isCashoutDropdownOpen, setIsCashoutDropdownOpen] = useState(false);
  

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
          color: log.color,
          is_sold: log.is_sold,
          fiat_received: parseFloat(log.fiat_received)
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
      toast.success("Tickets updated!");
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
        color: data.color,
        is_sold: data.is_sold,
        fiat_received: parseFloat(data.fiat_received)
      };
      setIncomeLogs(prev => [formattedLog, ...prev]);
      toast.success("Income logged successfully!");
    } else {
      toast.error("Failed to log income.");
    }

    setIsModalOpen(false);
    setGmtoEarned("");
  };

  const handleCashout = async () => {
    if (cashoutAccountIds.length === 0) return;
    const targetLogs = incomeLogs.filter(log => cashoutAccountIds.includes(log.id));
    if (targetLogs.length === 0) return;
    
    const totalGmto = targetLogs.reduce((sum, log) => sum + log.gmto, 0);
    const fiat = parseFloat(cashoutFiat);
    if (totalGmto <= 0 || isNaN(fiat) || fiat <= 0 || !userId) return;

    let success = true;

    // We loop through and update sequentially for exact proportional calculation
    for (const targetLog of targetLogs) {
      const proportionalFiat = fiat * (targetLog.gmto / totalGmto);
      const { error } = await supabase
        .from('income_logs')
        .update({
          is_sold: true,
          fiat_received: proportionalFiat
        })
        .eq('id', targetLog.id);

      if (error) {
        success = false;
        console.error("Failed to update log", targetLog.id, error);
      } else {
        setIncomeLogs(prev => prev.map(log => log.id === targetLog.id ? { ...log, is_sold: true, fiat_received: proportionalFiat } : log));
      }
    }

    if (success) {
      try {
        const audio = new Audio('/cash.mp3');
        audio.play().catch(e => console.warn("Audio play failed:", e));
      } catch (e) {
        console.warn("Audio playback not supported.", e);
      }
      
      toast.success("Cashout logged successfully!");
      setIsCashoutModalOpen(false);
      setCashoutAccountIds([]);
      setCashoutFiat("");
    } else {
      toast.error("Some cashouts failed to log.");
    }
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
      
    if (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account.");
    } else {
      toast.success("Account deleted successfully.");
    }
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
      toast.success("Account updated successfully.");
    } else {
      toast.error("Failed to update account.");
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
      
    if (error) {
      console.error("Error deleting log:", error);
      toast.error("Failed to delete log.");
    } else {
      toast.success("Income log deleted successfully.");
    }
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
      toast.success("Income log updated successfully.");
    } else {
      toast.error("Failed to update income log.");
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
      toast.success("Account added successfully.");
    } else {
      toast.error("Failed to add account.");
    }
    
    setNewAccountName("");
    setNewAccountEmail("");
    setNewAccountReferralLink("");
    setNewAccountWalletAddress("");
    setNewAccountAvatar("Avatar1");
    setIsAddAccountModalOpen(false);
  };

  const currencySymbol = CURRENCY_SYMBOLS[currency] || "$";
  

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
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
              Welcome back, <span className="text-primary">{nickname}</span>
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Here&apos;s an overview of your game accounts today.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Currency Selector */}
          </div>
        </div>
            <p className="mt-2 max-w-xl text-muted-foreground text-sm">
              You have {accounts.filter(acc => acc.ticketsDone < acc.totalTickets).length} accounts pending for quota today. Keep up the grind!
            </p>
          </div>
          
          <div className="flex flex-col items-start sm:items-end space-y-1.5 relative">
            <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Currency</label>
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                className={`w-28 flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${isCurrencyDropdownOpen ? 'ring-1 ring-ring border-ring' : 'hover:bg-foreground/[0.02]'}`}
              >
                <span className={currency ? "text-foreground" : "text-muted-foreground"}>
                  {currency.toUpperCase()} ({currencySymbol})
                </span>
                <ChevronDownIcon className={`size-3 text-muted-foreground transition-transform ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCurrencyDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCurrencyDropdownOpen(false)} />
                  <div className="absolute z-50 top-full right-0 mt-1.5 w-28 bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    {Object.keys(CURRENCY_SYMBOLS).map(key => (
                      <button
                        key={key}
                        type="button"
                        onClick={async () => { 
                          setCurrency(key); 
                          setIsCurrencyDropdownOpen(false); 
                          const { error } = await supabase.auth.updateUser({ data: { currency: key } });
                          if (error) {
                            toast.error("Failed to update currency.");
                          } else {
                            toast.success("Currency updated successfully.");
                          }
                        }}
                        className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors outline-none ${
                          currency === key 
                            ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                            : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                        }`}
                      >
                        <span className="font-medium">{key.toUpperCase()}</span>
                        <span className="opacity-80">{CURRENCY_SYMBOLS[key]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fact Cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FactCard 
            label="Tickets Logged" 
            value={`${totalTicketsLogged} / ${totalMaxTickets}`} 
            sub={`across ${accounts.length} accounts today`} 
            icon={<Image src="/repair-ticket.png" alt="ticket" width={24} height={24} className="object-contain" />}
          />
          <FactCard 
            label="Today's Est. Income" 
            value={`${currencySymbol}${totalGross.toFixed(2)}`} 
            sub={`$GMTO Price: ${currencySymbol}${gmtoPrice.toFixed(6)}`} 
            icon={<Image src="/gmto.png" alt="gmto" width={24} height={24} className="opacity-70" />}
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
              {filteredAccounts.slice((accountsPage - 1) * ACCOUNTS_PER_PAGE, accountsPage * ACCOUNTS_PER_PAGE).map((account) => {
                const isDone = account.ticketsDone === account.totalTickets;
                return (
                  <li
                    key={account.id}
                    className="group flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div
                      className={`flex size-4 sm:size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isDone
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                          : "border-foreground/30 text-transparent"
                      }`}
                    >
                      {isDone ? (
                        <CheckIcon className="size-2.5 sm:size-3" />
                      ) : (
                        <CircleIcon className="size-2.5 sm:size-3" />
                      )}
                    </div>
                    
                    {/* Account Avatar */}
                    <div className="flex items-center justify-center size-7 sm:size-9 bg-accent rounded-full text-accent-foreground ml-0.5 sm:ml-1 overflow-hidden shrink-0">
                      {AVATAR_MAP[account.avatar || "Avatar1"]}
                    </div>

                    <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2">
                      <span
                        className={`block truncate flex-1 min-w-0 text-xs sm:text-sm transition-all ${isDone ? "text-emerald-500" : "text-foreground"}`}
                      >
                        {account.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {account.referralLink && (
                          <>
                            <button onClick={() => { navigator.clipboard.writeText(account.referralLink!); toast.success("Referral link copied!"); }} className="p-1 text-muted-foreground hover:text-primary transition-colors inline-flex items-center active:scale-95" title="Copy Referral Link">
                              <CopyIcon className="size-3.5" />
                            </button>
                            <a href={account.referralLink} className="p-1 text-muted-foreground hover:text-primary transition-colors inline-flex items-center" title="Open Referral Link">
                              <LinkIcon className="size-3.5" />
                            </a>
                          </>
                        )}
                        {account.walletAddress && (
                          <button onClick={() => openViewWalletModal(account.walletAddress!)} className="p-1 text-muted-foreground hover:text-primary transition-colors inline-flex items-center" title="View Wallet Address">
                            <WalletIcon className="size-3.5" />
                          </button>
                        )}
                        {account.email && (
                          <button onClick={() => { navigator.clipboard.writeText(account.email!); toast.success("Email copied to clipboard!"); }} className="p-1 text-muted-foreground hover:text-primary transition-colors inline-flex items-center active:scale-95" title="Copy Email">
                            <MailIcon className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end gap-2">
                      {/* Action Buttons */}
                      <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0 ml-7 sm:ml-0">
                        <button onClick={() => openEditAccountModal(account)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Edit Account">
                          <PencilIcon className="size-3.5" />
                        </button>
                        <button onClick={() => openDeleteAccountModal(account.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors" title="Delete Account">
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>

                      {/* Interactive Ticket Logger */}
                      <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] shrink-0">
                        <button 
                          onClick={() => updateTicket(account.id, -1)}
                          disabled={account.ticketsDone === 0}
                          className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <MinusIcon className="size-3" />
                        </button>
                        
                        <span className={`w-9 text-center ${isDone ? "text-emerald-500" : "text-muted-foreground/70"}`}>
                          {account.ticketsDone}/{account.totalTickets}
                        </span>
                        
                        <button 
                          onClick={() => updateTicket(account.id, 1)}
                          disabled={isDone}
                          className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <PlusIcon className="size-3" />
                        </button>

                        <Image src="/repair-ticket.png" alt="tix" width={20} height={20} className={`object-contain ml-0.5 sm:ml-1 transition-opacity ${isDone ? "opacity-50 grayscale" : "opacity-100"} sm:w-6 sm:h-6`} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <PaginationControls 
              currentPage={accountsPage} 
              totalPages={Math.ceil(filteredAccounts.length / ACCOUNTS_PER_PAGE)}
              onPageChange={setAccountsPage} 
            />
          </DashboardCard>

          <DashboardCard 
            title="Today's Income" 
            trailing={
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsCashoutModalOpen(true)} variant="outline" size="sm" className="h-8">
                  <Image src="/gmto.png" alt="GMTO" width={14} height={14} className="mr-1.5 opacity-80" />
                  Sell
                </Button>
                <Button onClick={() => setIsModalOpen(true)} variant="ghost" size="sm" className="h-8">
                  <WalletIcon className="size-4 mr-1" />
                  Log
                </Button>
              </div>
            }
          >
            <ul className="mt-2 flex flex-col gap-2 min-h-[220px] pr-1">
              {incomeLogs.slice((incomePage - 1) * INCOME_PER_PAGE, incomePage * INCOME_PER_PAGE).map((log) => {
                const logGross = log.gmto * gmtoPrice;

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
                    {!log.is_sold ? (
                      <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                        <button onClick={() => openEditLogModal(log)} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit Log">
                          <PencilIcon className="size-3.5" />
                        </button>
                        <button onClick={() => openDeleteLogModal(log.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors" title="Delete Log">
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="shrink-0 flex items-center">
                        <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full tracking-wider border border-emerald-500/20">
                          Sold
                        </span>
                      </div>
                    )}

                    <div className="text-right ml-2 shrink-0">
                      <div className="text-sm font-medium text-emerald-500/90">
                        +{currencySymbol}{log.is_sold ? log.fiat_received.toFixed(2) : logGross.toFixed(2)}
                      </div>
                      {log.is_sold && (
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Sold Price
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <PaginationControls 
              currentPage={incomePage} 
              totalPages={Math.ceil(incomeLogs.length / INCOME_PER_PAGE)} 
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
            <div className="relative">
              <div 
                onClick={() => setIsComboboxOpen(!isComboboxOpen)}
                className={`w-full rounded-md border border-input bg-background pl-3 pr-10 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${isComboboxOpen ? 'ring-1 ring-ring border-ring' : 'hover:bg-foreground/[0.02]'}`}
              >
                <span className={selectedAccountId ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {accounts.find(a => a.id === selectedAccountId)?.name || "Select account"}
                </span>
                <ChevronDownIcon className={`absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-transform ${isComboboxOpen ? 'rotate-180' : ''}`} />
              </div>

              {isComboboxOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsComboboxOpen(false)} />
                  <div className="absolute z-50 top-full mt-1.5 w-full bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col max-h-[200px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {accounts.map(acc => (
                      <div
                        key={acc.id}
                        onClick={() => { setSelectedAccountId(acc.id); setIsComboboxOpen(false); }}
                        className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                          selectedAccountId === acc.id 
                            ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                            : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                        }`}
                      >
                        <span className="font-medium">{acc.name}</span>
                      </div>
                    ))}
                    {accounts.length === 0 && (
                      <div className="px-4 py-6 text-sm text-center text-muted-foreground">
                        No accounts found.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
            <input 
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="account@example.com"
              value={newAccountEmail}
              onChange={(e) => setNewAccountEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Referral Link (Optional)</label>
            <input 
              type="url"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="https://..."
              value={newAccountReferralLink}
              onChange={(e) => setNewAccountReferralLink(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Wallet Address (Optional)</label>
            <input 
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="0x..."
              value={newAccountWalletAddress}
              onChange={(e) => setNewAccountWalletAddress(e.target.value)}
            />
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
            <input 
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={editAccountEmail}
              onChange={(e) => setEditAccountEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Referral Link (Optional)</label>
            <input 
              type="url"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={editAccountReferralLink}
              onChange={(e) => setEditAccountReferralLink(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Wallet Address (Optional)</label>
            <input 
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={editAccountWalletAddress}
              onChange={(e) => setEditAccountWalletAddress(e.target.value)}
            />
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

      {/* Cashout Modal Overlay */}
      <AnimatedModal
        isOpen={isCashoutModalOpen}
        onClose={() => setIsCashoutModalOpen(false)}
        title="Sell Account Income"
        icon={<Image src="/gmto.png" alt="GMTO" width={18} height={18} />}
        maxWidth="sm"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Record a cashout or P2P sale of a specific account&apos;s logged income.
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Select Unsold Income</label>
            <div className="relative">
              <div 
                onClick={() => setIsCashoutDropdownOpen(!isCashoutDropdownOpen)}
                className={`w-full rounded-md border border-input bg-background pl-3 pr-10 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${isCashoutDropdownOpen ? 'ring-1 ring-ring border-ring' : 'hover:bg-foreground/[0.02]'}`}
              >
                <span className={cashoutAccountIds.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {cashoutAccountIds.length > 0 
                    ? `${cashoutAccountIds.length} account${cashoutAccountIds.length > 1 ? 's' : ''} selected (${incomeLogs.filter(l => cashoutAccountIds.includes(l.id)).reduce((sum, log) => sum + log.gmto, 0)} GMTO)` 
                    : "Choose income logs"}
                </span>
                <ChevronDownIcon className={`absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-transform ${isCashoutDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isCashoutDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCashoutDropdownOpen(false)} />
                  <div className="absolute z-50 top-full mt-1.5 w-full bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col max-h-[200px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {incomeLogs.filter(log => !log.is_sold).map(log => (
                      <div
                        key={log.id}
                        onClick={() => {
                          setCashoutAccountIds(prev => 
                            prev.includes(log.id) 
                              ? prev.filter(id => id !== log.id)
                              : [...prev, log.id]
                          );
                        }}
                        className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                          cashoutAccountIds.includes(log.id) 
                            ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                            : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                        }`}
                      >
                        <span className="font-medium">{log.title}</span>
                        <div className="flex items-center gap-1.5 opacity-80">
                          <span className="text-xs">{log.gmto}</span>
                          <Image src="/gmto.png" alt="GMTO" width={12} height={12} />
                        </div>
                      </div>
                    ))}
                    {incomeLogs.filter(log => !log.is_sold).length === 0 && (
                      <div className="px-4 py-6 text-sm text-center text-muted-foreground flex flex-col items-center gap-2">
                        <WalletIcon className="size-5 opacity-50" />
                        No unsold income available today.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">GMTO to Sell (Auto-filled)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2"><Image src="/gmto.png" alt="GMTO" width={16} height={16} /></span>
              <input 
                type="number"
                value={cashoutAccountIds.length > 0 ? incomeLogs.filter(l => cashoutAccountIds.includes(l.id)).reduce((sum, log) => sum + log.gmto, 0) : ""}
                readOnly
                placeholder="Select income logs first"
                className="w-full rounded-md border border-input bg-foreground/[0.02] pl-9 pr-3 py-2 text-sm text-muted-foreground cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Total {currency.toUpperCase()} Received</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
              <input 
                type="number"
                value={cashoutFiat}
                onChange={(e) => setCashoutFiat(e.target.value)}
                placeholder="e.g. 1200"
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          {cashoutAccountIds.length > 0 && parseFloat(cashoutFiat) > 0 && (
            <div className="p-3 bg-primary/10 rounded-md border border-primary/20">
              <p className="text-xs text-primary font-medium text-center">
                Realized Price: {currencySymbol}{(parseFloat(cashoutFiat) / (incomeLogs.filter(l => cashoutAccountIds.includes(l.id)).reduce((sum, log) => sum + log.gmto, 0) || 1)).toFixed(6)} / GMTO
              </p>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsCashoutModalOpen(false)}>Cancel</Button>
          <Button onClick={handleCashout} disabled={cashoutAccountIds.length === 0 || !cashoutFiat || isNaN(parseFloat(cashoutFiat))}>
            <Image src="/gmto.png" alt="GMTO" width={14} height={14} className="mr-1.5 opacity-80" />
            Record Sale
          </Button>
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
                toast.success("Wallet address copied to clipboard!");
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
