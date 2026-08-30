"use client";

import { CopyIcon, LinkIcon, PencilIcon, TrashIcon, CheckIcon, CircleIcon, MinusIcon, PlusIcon, ChevronDownIcon, WalletIcon, MailIcon, WrenchIcon, SearchIcon, ListFilterIcon, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { GuideModal } from "@/components/ui/guide-modal";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";

import { GmtoChartConverter } from "@/features/dashboard/components/gmto-chart-converter";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { ReactNode, useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { PageContainer } from "@/components/ui/page-container";

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
type Account = { id: number; name: string; ticketsDone: number; totalTickets: number; avatar: string; referralLink: string | null; email: string | null; isBanned: boolean; totalAccumulatedTickets: number; repairTicketsUsed: number; };
type IncomeLog = { id: string; time: string; title: string; gmto: number; color: string; is_sold: boolean; fiat_received: number; fiat_currency: string };

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", php: "₱", eur: "€" };

const handleReferralClick = (e: React.MouseEvent, url: string) => {
  e.preventDefault();
  if (typeof window !== "undefined") {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          const scheme = parsed.protocol.replace(":", "");
          const intentUrl = `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=${scheme};S.browser_fallback_url=${encodeURIComponent(url)};end;`;
          window.location.href = intentUrl;
          return;
        }
      } catch {
        // Fallback to default routing on error
      }
    }
    // For iOS and Desktop, standard navigation is best for Universal Links
    window.location.href = url;
  }
};

export default function UserDashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [incomeLogs, setIncomeLogs] = useState<IncomeLog[]>([]);
  const [allUnsoldLogs, setAllUnsoldLogs] = useState<IncomeLog[]>([]);
  const [allSoldLogs, setAllSoldLogs] = useState<{ gmto_amount: string; fiat_received: string; fiat_currency: string }[]>([]);
  const [totalP2PSoldGmto, setTotalP2PSoldGmto] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isIncomeFilterDropdownOpen, setIsIncomeFilterDropdownOpen] = useState(false);
  const [incomeLogFilter, setIncomeLogFilter] = useState<"all" | "sold" | "unsold">("all");
  
  // Pagination State
  const [accountsPage, setAccountsPage] = useState(1);
  const [incomePage, setIncomePage] = useState(1);
  const ACCOUNTS_PER_PAGE = 6;
  const INCOME_PER_PAGE = 4;
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [accountStatusFilter, setAccountStatusFilter] = useState<"all" | "active" | "banned">("active");
  const [accountQuotaFilter, setAccountQuotaFilter] = useState<"all" | "finished" | "incomplete">("all");

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = 
      accountStatusFilter === "all" ? true :
      accountStatusFilter === "active" ? !acc.isBanned :
      acc.isBanned;
    
    const isDone = acc.ticketsDone >= acc.totalTickets;
    const matchesQuota = 
      accountQuotaFilter === "all" ? true :
      accountQuotaFilter === "finished" ? isDone :
      !isDone;

    return matchesSearch && matchesStatus && matchesQuota;
  });
  
  // Add Account State
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountReferralLink, setNewAccountReferralLink] = useState("");
  const [newAccountAvatar, setNewAccountAvatar] = useState("Avatar1");

  // Edit Account State
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountEmail, setEditAccountEmail] = useState("");
  const [editAccountReferralLink, setEditAccountReferralLink] = useState("");
  const [editAccountAvatar, setEditAccountAvatar] = useState("Avatar1");
  const [editAccountIsBanned, setEditAccountIsBanned] = useState(false);

  // Global Wallet State
  const [globalWalletAddress, setGlobalWalletAddress] = useState(""); // Now used for LBank
  const [isViewWalletModalOpen, setIsViewWalletModalOpen] = useState(false);
  const [isWalletCopied, setIsWalletCopied] = useState(false);

  // Edit Log State
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [editLogGmto, setEditLogGmto] = useState("");
  const [editLogFiat, setEditLogFiat] = useState("");
  const [editLogIsSold, setEditLogIsSold] = useState(false);

  // Delete Modal State
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);
  
  const [isDeleteLogModalOpen, setIsDeleteLogModalOpen] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

  // Repair Ticket Modal State
  const [isRepairTicketModalOpen, setIsRepairTicketModalOpen] = useState(false);
  const [repairTicketAccountId, setRepairTicketAccountId] = useState<number | null>(null);
  const [repairTicketAmount, setRepairTicketAmount] = useState(1);

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [gmtoEarned, setGmtoEarned] = useState("");
  
  const [cashoutAccountIds, setCashoutAccountIds] = useState<string[]>([]);
  const [cashoutFiat, setCashoutFiat] = useState("");
  

  const [currency, setCurrency] = useState("usd");
  const [gmtoPrice, setGmtoPrice] = useState(0); 
  const [allGmtoPrices, setAllGmtoPrices] = useState<Record<string, number>>({});
  
  const [nickname, setNickname] = useState("User");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Loading states for async actions
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoggingIncome, setIsLoggingIncome] = useState(false);
  const [isUpdatingLog, setIsUpdatingLog] = useState(false);
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [isUsingRepairTicket, setIsUsingRepairTicket] = useState(false);
  const [updatingTicketsIds, setUpdatingTicketsIds] = useState<Set<number>>(new Set());
  
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
      if (user.user_metadata?.lbank_address) {
        setGlobalWalletAddress(user.user_metadata.lbank_address);
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
          email: acc.email,
          isBanned: acc.is_banned ?? false,
          totalAccumulatedTickets: acc.total_accumulated_tickets ?? 0,
          repairTicketsUsed: acc.repair_tickets_used ?? 0
        })));
        if (accountsData.length > 0) setSelectedAccountId(accountsData[0].id);
      }
      
      // Fetch all income logs
      const { data: logsData } = await supabase
        .from('income_logs')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (logsData) {
        setIncomeLogs(logsData.map(log => ({
          id: log.id.toString(),
          time: new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          title: log.account_name,
          gmto: parseFloat(log.gmto_amount),
          color: log.color,
          is_sold: log.is_sold,
          fiat_received: parseFloat(log.fiat_received),
          fiat_currency: log.fiat_currency || 'php'
        })));
      }

      // Fetch all-time sold P2P logs (for stats)
      const { data: soldLogsData } = await supabase
        .from('income_logs')
        .select('gmto_amount, fiat_received, fiat_currency')
        .eq('is_sold', true);
        
      if (soldLogsData) {
        setAllSoldLogs(soldLogsData);
        const sumGmto = soldLogsData.reduce((acc, log) => acc + parseFloat(log.gmto_amount || "0"), 0);
        setTotalP2PSoldGmto(sumGmto);
      }

      // Fetch all-time UNSOLD income logs (for sell modal)
      const { data: unsoldLogsData } = await supabase
        .from('income_logs')
        .select('*')
        .eq('is_sold', false)
        .order('created_at', { ascending: false });

      if (unsoldLogsData) {
        setAllUnsoldLogs(unsoldLogsData.map(log => ({
          id: log.id.toString(),
          time: new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          title: log.account_name,
          gmto: parseFloat(log.gmto_amount),
          color: log.color,
          is_sold: log.is_sold,
          fiat_received: parseFloat(log.fiat_received),
          fiat_currency: log.fiat_currency || 'php'
        })));
      }
    };
    
    Promise.all([
      fetchDashboardData(),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]).finally(() => setLoading(false));

    const channel = supabase.channel('dashboard_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_accounts' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_logs' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    // Re-fetch data when the window regains focus (e.g. switching back from another tab)
    window.addEventListener("focus", fetchDashboardData);
    return () => {
      window.removeEventListener("focus", fetchDashboardData);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch GMTO price via server-side proxy (avoids CORS)
  useEffect(() => {
    // Try to load from local storage first for instant UI updates
    const cachedPrices = localStorage.getItem('gmto_all_prices');
    if (cachedPrices) {
      setTimeout(() => {
        try {
          const parsed = JSON.parse(cachedPrices);
          setAllGmtoPrices(parsed);
          if (parsed[currency]) {
            setGmtoPrice(parsed[currency]);
          }
        } catch {
          console.warn("Failed to parse cached gmto prices");
        }
      }, 0);
    }

    fetch(`/api/gmto-price`)
      .then(res => res.json())
      .then(data => {
        if (data["game-meteor-coin"]) {
          const prices = data["game-meteor-coin"];
          setAllGmtoPrices(prices);
          localStorage.setItem('gmto_all_prices', JSON.stringify(prices));
          if (prices[currency]) {
            setGmtoPrice(prices[currency]);
          }
        }
      })
      .catch(err => console.warn("Failed to fetch GMTO price", err));
  }, [currency]);

  // Compute dynamic stats
  const activeAccountsForStats = accounts.filter(acc => !acc.isBanned);
  const totalTicketsLogged = activeAccountsForStats.reduce((sum, acc) => sum + acc.ticketsDone, 0);
  const totalMaxTickets = activeAccountsForStats.reduce((sum, acc) => sum + acc.totalTickets, 0);
  
  const filteredIncomeLogs = incomeLogs.filter(log => {
    if (incomeLogFilter === "all") return true;
    if (incomeLogFilter === "sold") return log.is_sold;
    return !log.is_sold;
  });

  const getConvertedFiat = useCallback((amount: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency || !allGmtoPrices[fromCurrency] || !allGmtoPrices[toCurrency]) return amount;
    const exchangeRate = allGmtoPrices[toCurrency] / allGmtoPrices[fromCurrency];
    return amount * exchangeRate;
  }, [allGmtoPrices]);

  const totalP2PSoldFiatConverted = useMemo(() => {
    return allSoldLogs.reduce((sum, log) => {
      return sum + getConvertedFiat(parseFloat(log.fiat_received || "0"), log.fiat_currency || "php", currency);
    }, 0);
  }, [allSoldLogs, currency, getConvertedFiat]);

  const totalGross = filteredIncomeLogs.reduce((sum, log) => sum + (log.gmto * gmtoPrice), 0);

  const updateTicket = async (id: number, delta: number) => {
    if (updatingTicketsIds.has(id)) return;
    setUpdatingTicketsIds(prev => new Set(prev).add(id));
    
    try {
      const account = accounts.find(a => a.id === id);
      if (!account) return;
      
      const newCount = Math.max(0, Math.min(account.totalTickets, account.ticketsDone + delta));
      const actualDelta = newCount - account.ticketsDone;
      if (actualDelta === 0) return;
      
      const newAccumulated = account.totalAccumulatedTickets + actualDelta;
      
      if (actualDelta < 0 && newAccumulated < account.repairTicketsUsed) {
        toast.error("Cannot decrease tickets that have already been used for repair.");
        return;
      }
      
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === id ? { ...acc, ticketsDone: newCount, totalAccumulatedTickets: newAccumulated } : acc))
      );
      
      await supabase
        .from('user_accounts')
        .update({ tickets_done: newCount, total_accumulated_tickets: newAccumulated })
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
    } finally {
      setUpdatingTicketsIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleLogIncome = async () => {
    const gmto = parseFloat(gmtoEarned);
    if (isNaN(gmto) || gmto <= 0 || !userId) return;
    
    setIsLoggingIncome(true);
    try {
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
          fiat_received: parseFloat(data.fiat_received),
          fiat_currency: data.fiat_currency || 'php'
        };
        setIncomeLogs(prev => [formattedLog, ...prev]);
        toast.success("Income logged successfully!");
      } else {
        toast.error("Failed to log income.");
      }

      setIsModalOpen(false);
      setGmtoEarned("");
    } finally {
      setIsLoggingIncome(false);
    }
  };

  const handleCashout = async () => {
    if (cashoutAccountIds.length === 0 || !cashoutFiat || isNaN(parseFloat(cashoutFiat))) return;

    setIsCashingOut(true);
    try {
      const fiat = parseFloat(cashoutFiat);
      const targetLogs = allUnsoldLogs.filter(log => cashoutAccountIds.includes(log.id) && !log.is_sold);
      const totalGmto = targetLogs.reduce((sum, log) => sum + log.gmto, 0);

      if (totalGmto <= 0) {
        toast.error("No valid logs selected.");
        return;
      }

      let success = true;

      // We loop through and update sequentially for exact proportional calculation
      for (const targetLog of targetLogs) {
        const proportionalFiat = fiat * (targetLog.gmto / totalGmto);
        const { error } = await supabase
          .from('income_logs')
          .update({
            is_sold: true,
            fiat_received: proportionalFiat,
            fiat_currency: currency
          })
          .eq('id', targetLog.id);

        if (error) {
          success = false;
          console.error("Failed to update log", targetLog.id, error);
        } else {
          setIncomeLogs(prev => prev.map(log => log.id === targetLog.id ? { ...log, is_sold: true, fiat_received: proportionalFiat, fiat_currency: currency } : log));
          setAllUnsoldLogs(prev => prev.filter(log => log.id !== targetLog.id));
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
    } finally {
      setIsCashingOut(false);
    }
  };

  const openDeleteAccountModal = (id: number) => {
    setDeleteAccountId(id);
    setIsDeleteAccountModalOpen(true);
  };

  const confirmDeleteAccount = async () => {
    if (deleteAccountId === null) return;
    
    setIsDeletingAccount(true);
    try {
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
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const openEditAccountModal = (acc: Account) => {
    setEditAccountId(acc.id);
    setEditAccountName(acc.name);
    setEditAccountEmail(acc.email || "");
    setEditAccountReferralLink(acc.referralLink || "");
    setEditAccountAvatar(acc.avatar || "Avatar1");
    setEditAccountIsBanned(acc.isBanned || false);
    setIsEditAccountModalOpen(true);
  };

  const openViewWalletModal = () => {
    setIsViewWalletModalOpen(true);
  };

  const openRepairTicketModal = (accountId: number) => {
    setRepairTicketAccountId(accountId);
    setRepairTicketAmount(1);
    setIsRepairTicketModalOpen(true);
  };

  const handleUseRepairTicket = async () => {
    if (repairTicketAccountId === null) return;
    const account = accounts.find(a => a.id === repairTicketAccountId);
    if (!account) return;

    const available = account.totalAccumulatedTickets - account.repairTicketsUsed;
    if (repairTicketAmount <= 0 || repairTicketAmount > available) {
      toast.error("Invalid amount of tickets.");
      return;
    }

    setIsUsingRepairTicket(true);
    try {
      const newUsed = account.repairTicketsUsed + repairTicketAmount;

      // Optimistic UI update
      setAccounts(prev => prev.map(acc => acc.id === repairTicketAccountId ? { ...acc, repairTicketsUsed: newUsed } : acc));

      const { error } = await supabase
        .from('user_accounts')
        .update({ repair_tickets_used: newUsed })
        .eq('id', repairTicketAccountId);

      if (error) {
        console.error(error);
        toast.error("Failed to use repair tickets.");
        // Rollback
        setAccounts(prev => prev.map(acc => acc.id === repairTicketAccountId ? { ...acc, repairTicketsUsed: account.repairTicketsUsed } : acc));
      } else {
        toast.success(`Used ${repairTicketAmount} repair ticket(s).`);
      }

      setIsRepairTicketModalOpen(false);
      setRepairTicketAccountId(null);
      setRepairTicketAmount(1);
    } finally {
      setIsUsingRepairTicket(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!editAccountId || !editAccountName.trim()) return;

    setIsUpdatingAccount(true);
    try {
      const { error } = await supabase
        .from('user_accounts')
        .update({
          name: editAccountName.trim(),
          avatar: editAccountAvatar,
          email: editAccountEmail.trim() || null,
          referral_link: editAccountReferralLink.trim() || null,
          is_banned: editAccountIsBanned
        })
        .eq('id', editAccountId);

      if (!error) {
        setAccounts(prev => prev.map(acc => acc.id === editAccountId ? {
          ...acc,
          name: editAccountName.trim(),
          avatar: editAccountAvatar,
          email: editAccountEmail.trim() || null,
          referralLink: editAccountReferralLink.trim() || null,
          isBanned: editAccountIsBanned
        } : acc));
        toast.success("Account updated successfully.");
      } else {
        toast.error("Failed to update account.");
      }
      
      setIsEditAccountModalOpen(false);
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const openDeleteLogModal = (id: string) => {
    setDeleteLogId(id);
    setIsDeleteLogModalOpen(true);
  };

  const confirmDeleteLog = async () => {
    if (!deleteLogId) return;
    
    setIsDeletingLog(true);
    try {
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
    } finally {
      setIsDeletingLog(false);
    }
  };

  const openEditLogModal = (log: IncomeLog) => {
    setEditLogId(log.id);
    setEditLogGmto(log.gmto.toString());
    setEditLogFiat(log.fiat_received ? log.fiat_received.toString() : "");
    setEditLogIsSold(log.is_sold);
    setIsEditLogModalOpen(true);
  };

  const handleUpdateLog = async () => {
    if (!editLogId) return;
    const gmto = parseFloat(editLogGmto);
    if (isNaN(gmto) || gmto <= 0) return;

    setIsUpdatingLog(true);
    try {
      const targetLog = incomeLogs.find(l => l.id === editLogId);
      const fiat = parseFloat(editLogFiat);

      const updateData: { gmto_amount: number; fiat_received?: number | null; is_sold?: boolean } = { gmto_amount: gmto };
      
      if (targetLog?.is_sold) {
        updateData.is_sold = editLogIsSold;
        if (editLogIsSold) {
          if (!isNaN(fiat) && fiat >= 0) {
            updateData.fiat_received = fiat;
          }
        } else {
          updateData.fiat_received = null;
        }
      }

      const { error } = await supabase
        .from('income_logs')
        .update(updateData)
        .eq('id', editLogId);

      if (!error) {
        setIncomeLogs(prev => prev.map(log => log.id === editLogId ? { 
          ...log, 
          gmto, 
          ...(targetLog?.is_sold ? { 
            is_sold: editLogIsSold, 
            fiat_received: editLogIsSold ? fiat : 0 
          } : {}) 
        } : log));
        toast.success("Income log updated successfully.");
      } else {
        toast.error("Failed to update income log.");
      }

      setIsEditLogModalOpen(false);
    } finally {
      setIsUpdatingLog(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim() || !userId) return;
    
    setIsAddingAccount(true);
    try {
      const newAccountData = {
        user_id: userId,
        name: newAccountName.trim(),
        tickets_done: 0,
        total_tickets: 10,
        avatar: newAccountAvatar,
        email: newAccountEmail.trim() || null,
        referral_link: newAccountReferralLink.trim() || null
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
          isBanned: false,
          totalAccumulatedTickets: 0,
          repairTicketsUsed: 0
        }]);
        if (selectedAccountId === null) setSelectedAccountId(data.id);
        toast.success("Account added successfully.");
      } else {
        toast.error("Failed to add account.");
      }
      
      setNewAccountName("");
      setNewAccountEmail("");
      setNewAccountReferralLink("");
      setNewAccountAvatar("Avatar1");
      setIsAddAccountModalOpen(false);
    } finally {
      setIsAddingAccount(false);
    }
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
      <div className="fixed inset-0 z-[100] bg-background flex h-screen w-full items-center justify-center">
        <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
      </div>
    );
  }

  return (
    <PageContainer>
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2 mb-3">
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
              <span>—</span>
              <span className={getModeColor()}>{getModeText()}</span>
            </div>
          
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
              Welcome back, <span className="text-primary">{nickname}</span>
            </h1>
            <div className="shrink-0">
              <GuideModal title="Dashboard Overview">
                <p>Welcome to Meteorn Hub! This is your central dashboard for managing game accounts, tickets, and income.</p>
              <ul className="list-disc pl-4 space-y-2 mt-2">
                <li><strong>Accounts:</strong> Add your game accounts to easily track their progress and manage their individual tickets.</li>
                <li><strong>Daily Tickets:</strong> Quickly log the number of tickets you use each day per account.</li>
                <li><strong>Income & Cashouts:</strong> Record the GMTO you earn. You can easily mark income as sold and convert it to your local fiat currency in real-time.</li>
              </ul>
              </GuideModal>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <p className="text-muted-foreground text-sm max-w-2xl">
              Here&apos;s an overview of your game accounts today.
            </p>
            
            <div className="flex items-center gap-2 shrink-0">
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
                          if (error) toast.error("Failed to update currency.");
                          else toast.success("Currency updated successfully.");
                        }}
                        className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors outline-none ${currency === key ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'}`}
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
              
            {globalWalletAddress && (
              <div className="flex flex-col items-center space-y-1.5">
                <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Wallet</label>
                <button
                  type="button"
                  onClick={() => openViewWalletModal()}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors h-[34px]"
                  title="View LBank Wallet"
                >
                  <WalletIcon className="size-3.5" />
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Fact Cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FactCard 
            label="Tickets Logged" 
            value={`${totalTicketsLogged} / ${totalMaxTickets}`} 
            sub={`across ${activeAccountsForStats.length} accounts today`} 
            icon={<Image src="/repair-ticket.png" alt="ticket" width={24} height={24} className="object-contain" />}
          />
          <FactCard 
            label="Est. Income" 
            value={`${currencySymbol}${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            sub={`$GMTO Price: ${currencySymbol}${gmtoPrice.toFixed(6)}`} 
            icon={<Image src="/gmto.png" alt="gmto" width={24} height={24} className="opacity-70" />}
          />
          <FactCard 
            label="Total P2P Sold" 
            value={
              allGmtoPrices[currency] === undefined 
                ? <span className="animate-pulse opacity-50">...</span> 
                : `${currencySymbol}${totalP2PSoldFiatConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
            sub={`${totalP2PSoldGmto.toLocaleString()} GMTO sold`} 
            icon={<WalletIcon className="size-5 opacity-40 text-emerald-500" />}
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
                    className="w-20 sm:w-28 rounded-md border border-input bg-background/50 pl-6 pr-2 py-1.5 text-[10px] sm:text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                  />
                </div>
                
                <div className="relative">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className="h-8 px-2 border-dashed flex items-center gap-1.5"
                  >
                    <ListFilterIcon className="size-3.5" />
                    <span className="hidden sm:inline text-xs">Filter</span>
                  </Button>
                  
                  {isFilterDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} />
                      <div className="absolute z-50 top-full left-0 sm:left-auto sm:right-0 mt-1.5 w-52 bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                        
                        {/* Status Filter */}
                        <div className="flex flex-col py-1.5 border-b border-input/50">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-1.5">Status</span>
                          {[
                            { value: 'all', label: 'All Accounts' },
                            { value: 'active', label: 'Active Only' },
                            { value: 'banned', label: 'Banned Only' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAccountStatusFilter(opt.value as "all" | "active" | "banned")}
                              className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors outline-none ${
                                accountStatusFilter === opt.value 
                                  ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                                  : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                              }`}
                            >
                              <span className="font-medium">{opt.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Quota Filter */}
                        <div className="flex flex-col py-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-1.5">Quota</span>
                          {[
                            { value: 'all', label: 'All Quotas' },
                            { value: 'finished', label: 'Finished' },
                            { value: 'incomplete', label: 'Incomplete' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAccountQuotaFilter(opt.value as "all" | "finished" | "incomplete")}
                              className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors outline-none ${
                                accountQuotaFilter === opt.value 
                                  ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                                  : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                              }`}
                            >
                              <span className="font-medium">{opt.label}</span>
                            </button>
                          ))}
                        </div>

                      </div>
                    </>
                  )}
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
                    className="group flex flex-wrap xl:flex-nowrap items-center gap-2 xl:gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
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
                        className={`block break-words whitespace-normal flex-1 min-w-[50px] text-xs sm:text-sm transition-all ${isDone ? "text-emerald-500" : account.isBanned ? "text-red-500/70" : "text-foreground"}`}
                      >
                        {account.name}
                      </span>
                      {account.isBanned && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-red-500/10 text-red-500">
                          Banned
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {account.referralLink && (
                          <>
                            <button onClick={() => { navigator.clipboard.writeText(account.referralLink!); toast.success("Referral link copied!"); }} className="p-2 text-muted-foreground hover:text-primary transition-colors inline-flex items-center active:scale-95 rounded-md" title="Copy Referral Link">
                              <CopyIcon className="size-4" />
                            </button>
                            <button onClick={(e) => handleReferralClick(e, account.referralLink!)} className="p-2 text-muted-foreground hover:text-primary transition-colors inline-flex items-center rounded-md" title="Open Referral Link">
                              <LinkIcon className="size-4" />
                            </button>
                          </>
                        )}

                        {account.email && (
                          <button onClick={() => { navigator.clipboard.writeText(account.email!); toast.success("Email copied to clipboard!"); }} className="p-2 text-muted-foreground hover:text-primary transition-colors inline-flex items-center active:scale-95 rounded-md" title="Copy Email">
                            <MailIcon className="size-4" />
                          </button>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center transition-opacity shrink-0 ml-1">
                          <button onClick={() => openEditAccountModal(account)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Edit Account">
                            <PencilIcon className="size-4" />
                          </button>
                          <button onClick={() => openDeleteAccountModal(account.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors" title="Delete Account">
                            <TrashIcon className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center w-full xl:w-auto mt-2 xl:mt-0 justify-center xl:justify-end gap-x-4 gap-y-3">
                      {/* Interactive Ticket Logger */}
                      {!account.isBanned && (
                        <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-[11px] sm:text-xs uppercase tracking-[0.2em] shrink-0">
                          <button 
                            onClick={() => updateTicket(account.id, -1)}
                            disabled={account.ticketsDone === 0 || updatingTicketsIds.has(account.id) || (account.totalAccumulatedTickets - 1 < account.repairTicketsUsed)}
                            className="p-1.5 sm:p-2 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <MinusIcon className="size-4" />
                          </button>
                          
                          <span className={`w-10 sm:w-11 text-center ${isDone ? "text-emerald-500" : "text-muted-foreground/70"}`}>
                            {account.ticketsDone}/{account.totalTickets}
                          </span>
                          
                          <button 
                            onClick={() => updateTicket(account.id, 1)}
                            disabled={isDone || updatingTicketsIds.has(account.id)}
                            className="p-1.5 sm:p-2 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <PlusIcon className="size-4" />
                          </button>

                          <Image src="/repair-ticket.png" alt="tix" width={24} height={24} className={`object-contain ml-1 sm:ml-1.5 transition-opacity ${isDone ? "opacity-50 grayscale" : "opacity-100"} w-5 h-5 sm:w-6 sm:h-6`} />

                          {/* Repair Tickets */}
                          <div className="ml-2 sm:ml-3 flex items-center gap-2 border-l border-border/50 pl-2 sm:pl-3">
                            <div className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground/50" title="Total Accumulated Tickets">
                              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest hidden sm:inline">Total</span>
                              <span className="font-medium text-xs sm:text-sm">{account.totalAccumulatedTickets}</span>
                            </div>
                            
                            <button 
                              onClick={() => openRepairTicketModal(account.id)}
                              disabled={(account.totalAccumulatedTickets - account.repairTicketsUsed) <= 0}
                              className="p-1.5 sm:p-2 rounded-md transition-colors inline-flex items-center gap-1 sm:gap-1.5 text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 disabled:opacity-30 disabled:pointer-events-none"
                              title="Use Repair Ticket"
                            >
                              <WrenchIcon className="size-4" />
                              <span className="font-bold text-xs sm:text-sm">{account.totalAccumulatedTickets - account.repairTicketsUsed}</span>
                            </button>
                            
                            {account.repairTicketsUsed > 0 && (
                              <span className="text-muted-foreground/30 text-[9px] sm:text-[10px] ml-0.5" title="Used Tickets">
                                -{account.repairTicketsUsed}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

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
            title="Income Logs" 
            trailing={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setIsIncomeFilterDropdownOpen(!isIncomeFilterDropdownOpen)}
                    className={`w-20 sm:w-24 flex items-center justify-between rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${isIncomeFilterDropdownOpen ? 'ring-1 ring-ring border-ring' : 'hover:bg-foreground/[0.02]'}`}
                  >
                    <span className="capitalize">{incomeLogFilter}</span>
                    <ChevronDownIcon className={`size-3 text-muted-foreground transition-transform ${isIncomeFilterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isIncomeFilterDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsIncomeFilterDropdownOpen(false)} />
                      <div className="absolute z-50 top-full left-0 mt-1.5 w-24 bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'sold', label: 'Sold' },
                          { value: 'unsold', label: 'Unsold' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setIncomeLogFilter(opt.value as "all" | "sold" | "unsold");
                              setIncomePage(1);
                              setIsIncomeFilterDropdownOpen(false);
                            }}
                            className={`px-3 py-2 text-xs cursor-pointer flex items-center transition-colors outline-none ${
                              incomeLogFilter === opt.value 
                                ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                                : 'text-foreground hover:bg-foreground/[0.05] border-l-2 border-transparent'
                            }`}
                          >
                            <span className="font-medium">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
              {filteredIncomeLogs.slice((incomePage - 1) * INCOME_PER_PAGE, incomePage * INCOME_PER_PAGE).map((log) => {
                const logGross = log.gmto * gmtoPrice;

                return (
                  <li
                    key={log.id}
                    className="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
                      <div className="flex w-12 shrink-0 flex-col items-center font-mono text-[11px] mt-0.5 sm:mt-0">
                        <span className="text-foreground">{log.time}</span>
                      </div>
                      <span className={`size-1.5 shrink-0 rounded-full ${log.color} mt-2 sm:mt-0`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">{log.title}</div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-muted-foreground text-xs">
                          <Image src="/gmto.png" alt="GMTO" width={20} height={20} className="object-contain shrink-0" />
                          <span className="font-medium text-foreground/80 truncate">{log.gmto} GMTO</span>
                          <span className="opacity-50 shrink-0">•</span>
                          <span className="truncate">Gross: {currencySymbol}{logGross.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Action Buttons */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto shrink-0 pl-[4.5rem] sm:pl-0 mt-1 sm:mt-0">
                      <div className="flex items-center gap-2">
                        {log.is_sold && (
                          <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full tracking-wider border border-emerald-500/20">
                            Sold
                          </span>
                        )}
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button onClick={() => openEditLogModal(log)} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit Log">
                            <PencilIcon className="size-3.5" />
                          </button>
                          <button onClick={() => openDeleteLogModal(log.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors" title="Delete Log">
                            <TrashIcon className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-right ml-2 shrink-0">
                        <div className="text-sm font-medium text-emerald-500/90">
                          +{currencySymbol}
                          {log.is_sold 
                            ? getConvertedFiat(log.fiat_received, log.fiat_currency, currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : (gmtoPrice === 0 ? "..." : logGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                          }
                        </div>
                        {log.is_sold && (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                            Sold Price
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <PaginationControls 
              currentPage={incomePage} 
              totalPages={Math.ceil(filteredIncomeLogs.length / INCOME_PER_PAGE)} 
              onPageChange={setIncomePage} 
            />
          </DashboardCard>

        </div>

        {/* Weekly Calendar & Chart Section */}
        <div className="mt-8 flex flex-col gap-3">

          <GmtoChartConverter currency={currency} />
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
            <Combobox
              options={accounts.filter(a => !a.isBanned).map(acc => ({ value: acc.id.toString(), label: acc.name }))}
              value={selectedAccountId?.toString()}
              onValueChange={(val) => setSelectedAccountId(Number(val))}
              placeholder="Select account"
              searchPlaceholder="Search account..."
              emptyText="No accounts found."
            />
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
            disabled={!gmtoEarned || isNaN(parseFloat(gmtoEarned)) || parseFloat(gmtoEarned) <= 0 || isLoggingIncome}
            className="w-full mt-2"
          >
            {isLoggingIncome ? "Logging..." : "Record Daily Income"}
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

          <Button 
            onClick={handleAddAccount}
            className="w-full mt-2"
            disabled={!newAccountName.trim() || isAddingAccount}
          >
            {isAddingAccount ? "Adding..." : "Add Account"}
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

          <div className="flex items-center justify-between p-3 border border-red-500/20 bg-red-500/5 rounded-md">
            <div>
              <p className="text-sm font-medium text-red-500">Banned Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Disables logging new income. Preserves old logs.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={editAccountIsBanned} onChange={(e) => setEditAccountIsBanned(e.target.checked)} />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          <Button 
            onClick={handleUpdateAccount}
            className="w-full mt-2"
            disabled={!editAccountName.trim() || isUpdatingAccount}
          >
            {isUpdatingAccount ? "Saving..." : "Save Changes"}
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

          {editLogId && incomeLogs.find(l => l.id === editLogId)?.is_sold && (
            <>
              <div className={`space-y-1.5 transition-opacity ${!editLogIsSold ? "opacity-50 pointer-events-none" : ""}`}>
                <label className="text-sm font-medium text-foreground">Total {currency.toUpperCase()} Received (P2P Sold)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                  <input 
                    type="number"
                    className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={editLogFiat}
                    onChange={(e) => setEditLogFiat(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 border border-orange-500/20 bg-orange-500/5 rounded-md mt-4">
                <div>
                  <p className="text-sm font-medium text-orange-500">Sold Status</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Toggle off to revert to unsold.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={editLogIsSold} onChange={(e) => setEditLogIsSold(e.target.checked)} />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </>
          )}

          <Button 
            onClick={handleUpdateLog}
            className="w-full mt-2"
            disabled={!editLogGmto || isNaN(parseFloat(editLogGmto)) || parseFloat(editLogGmto) <= 0 || isUpdatingLog}
          >
            {isUpdatingLog ? "Saving..." : "Save Changes"}
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
            <Button variant="destructive" onClick={confirmDeleteAccount} disabled={isDeletingAccount}>
              {isDeletingAccount ? "Deleting..." : "Delete Account"}
            </Button>
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
            <Button variant="destructive" onClick={confirmDeleteLog} disabled={isDeletingLog}>
              {isDeletingLog ? "Deleting..." : "Delete Log"}
            </Button>
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
            <MultiSelectCombobox
              options={allUnsoldLogs.map(log => ({
                value: log.id,
                label: `${log.title} — ${log.time}`,
                icon: <div className="flex items-center gap-1.5 opacity-80 ml-2"><span className="text-xs">{log.gmto}</span><Image src="/gmto.png" alt="GMTO" width={12} height={12} /></div>
              }))}
              values={cashoutAccountIds}
              onValuesChange={setCashoutAccountIds}
              placeholder="Choose income logs"
              searchPlaceholder="Search logs..."
              emptyText="No unsold income logs found."
              renderValue={(values) => `${values.length} log${values.length > 1 ? 's' : ''} selected (${allUnsoldLogs.filter(l => values.includes(l.id)).reduce((sum, log) => sum + log.gmto, 0).toFixed(2)} GMTO)`}
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">GMTO to Sell (Auto-filled)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2"><Image src="/gmto.png" alt="GMTO" width={16} height={16} /></span>
              <input 
                type="number"
                value={cashoutAccountIds.length > 0 ? allUnsoldLogs.filter(l => cashoutAccountIds.includes(l.id)).reduce((sum, log) => sum + log.gmto, 0) : ""}
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
          <Button onClick={handleCashout} disabled={cashoutAccountIds.length === 0 || !cashoutFiat || isNaN(parseFloat(cashoutFiat)) || isCashingOut}>
            <Image src="/gmto.png" alt="GMTO" width={14} height={14} className="mr-1.5 opacity-80" />
            {isCashingOut ? "Recording..." : "Record Sale"}
          </Button>
        </div>
      </AnimatedModal>

      {/* View Wallet Modal */}
      <AnimatedModal
        isOpen={isViewWalletModalOpen}
        onClose={() => setIsViewWalletModalOpen(false)}
        title="LBank Wallet Address"
        icon={<WalletIcon size={18} strokeWidth={1.5} />}
        maxWidth="sm"
      >
        <div className="space-y-4 mt-2 flex flex-col items-center">
          <div className="size-48 bg-white p-2 rounded-md border flex items-center justify-center">
            {globalWalletAddress ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${globalWalletAddress}`} alt="QR Code" className="size-full object-contain" />
              </>
            ) : (
              <span className="text-muted-foreground text-sm">No wallet address</span>
            )}
          </div>
          <div className="w-full relative">
            <input 
              type="text" 
              readOnly 
              value={globalWalletAddress} 
              className="w-full rounded-md border border-input bg-background pl-3 pr-24 py-2 text-sm text-muted-foreground focus:outline-none truncate"
            />
            <Button 
              size="sm" 
              variant="secondary" 
              className={`absolute right-1 top-1 bottom-1 h-auto text-xs transition-all duration-200 ${isWalletCopied ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30" : ""}`}
              onClick={() => {
                navigator.clipboard.writeText(globalWalletAddress);
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

      {/* Repair Ticket Modal */}
      <AnimatedModal 
        isOpen={isRepairTicketModalOpen} 
        onClose={() => setIsRepairTicketModalOpen(false)}
        title="Use Repair Tickets"
        icon={<WrenchIcon className="size-4" />}
        maxWidth="sm"
      >
        <div className="flex flex-col gap-5 p-2">
          <p className="text-sm text-muted-foreground mt-2">
            Select how many repair tickets you want to consume for this account.
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Amount to use</label>
              <p className="text-xs text-muted-foreground">
                Available: <span className="font-bold text-foreground">{(accounts.find(a => a.id === repairTicketAccountId)?.totalAccumulatedTickets ?? 0) - (accounts.find(a => a.id === repairTicketAccountId)?.repairTicketsUsed ?? 0)}</span>
              </p>
            </div>
            <div className="relative">
              <input 
                type="number"
                min="1"
                max={(accounts.find(a => a.id === repairTicketAccountId)?.totalAccumulatedTickets ?? 1) - (accounts.find(a => a.id === repairTicketAccountId)?.repairTicketsUsed ?? 0)}
                value={repairTicketAmount}
                onChange={e => setRepairTicketAmount(parseInt(e.target.value) || 1)}
                className="w-full rounded-md border border-input bg-background pl-3 pr-14 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
              <button
                type="button"
                onClick={() => {
                  const acc = accounts.find(a => a.id === repairTicketAccountId);
                  if (acc) {
                    setRepairTicketAmount(Math.max(1, acc.totalAccumulatedTickets - acc.repairTicketsUsed));
                  }
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium uppercase bg-foreground/5 hover:bg-foreground/10 text-foreground px-2 py-1 rounded transition-colors"
              >
                Max
              </button>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" onClick={() => setIsRepairTicketModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUseRepairTicket} disabled={isUsingRepairTicket} className="bg-orange-500 hover:bg-orange-600 text-white border-0">
              {isUsingRepairTicket ? "Processing..." : "Use Tickets"}
            </Button>
          </div>
        </div>
      </AnimatedModal>
    </PageContainer>
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
    <section className="flex flex-col h-full rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest sm:tracking-[0.25em]">
          {title}
        </div>
        {trailing}
      </div>
      <div className="flex flex-col flex-1">
        {children}
      </div>
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
  if (totalPages === 0) return null;
  return (
    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40">
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
  value: ReactNode;
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
