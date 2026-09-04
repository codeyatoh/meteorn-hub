"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  Copy,
  CheckIcon,
  RefreshCw,
  Trash2,
  Clock,
  Inbox,
  ChevronDown,
  ChevronLeft,
  Loader2,
  AtSign,
  Crown,
  HelpCircle,
  Shuffle,
  Plus,
  Trash2 as TrashIcon,
} from "lucide-react";
import { GenerateButton } from "@/components/ui/generate-button";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { GuideModal } from "@/components/ui/guide-modal";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";
import { AnimatePresence, motion } from "motion/react";
import { getTierLimits, TIER_TABLE } from "@/lib/utils/tiers";
import { TierEffect } from "@/components/ui/tier-effect";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  id: string;
  subject: string;
  from: { address: string; name: string };
  createdAt: string;
  seen: boolean;
  intro: string;
};

type MessageDetail = Message & {
  to: { address: string }[];
  text: string;
  html: string[];
};

type Session = {
  address: string;
  expires_at: string;
  mailtm_account_id?: string;
};

type DomainInfo = {
  domain: string;
  is_banned: boolean;
  available_at?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatCountdown(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function prepareHtml(html: string) {
  if (!html) return "";
  const baseTag = '<base target="_blank">';
  // Explicit dark-mode colors — CanvasText is unreliable on Android WebView
  // because the iframe does not inherit the parent page's color-scheme.
  const styleTag = [
    '<style>',
    'html, body {',
    '  overflow-x: hidden !important;',
    '  word-wrap: break-word !important;',
    '  overflow-wrap: break-word !important;',
    '  font-family: system-ui, -apple-system, sans-serif;',
    '  background-color: transparent !important;',
    '  color: #e2e8f0 !important;',
    '  color-scheme: dark;',
    '}',
    'img { max-width: 100% !important; height: auto !important; }',
    'a { color: #818cf8 !important; }',
    '</style>',
  ].join('');

  if (html.toLowerCase().includes('<head>')) {
    return html.replace(/<head>/i, `<head>${baseTag}${styleTag}`);
  }
  return baseTag + styleTag + html;
}

// ─── Random username (letters only) ──────────────────────────────────────────
const ADJECTIVES = [
  "star","moon","blue","red","oak","pine","fox","hawk","wolf","jade",
  "nova","echo","river","sage","dawn","dusk","mist","storm","bright","swift",
  "calm","bold","keen","lone","wild","fire","ice","cloud","peak","ray",
  "amber","onyx","ivory","cobalt","slate","ember","coral","fern","teal","ash",
  "gold","silver","bronze","iron","steel","solar","lunar","arctic","coastal","alpine",
  "deep","vast","noir","pure","dark","glow","zen","free","true","prime",
  "crisp","sharp","cool","warm","clear","raw","soft","rare","fine","brave",
  "mystic","silent","broken","frozen","hollow","radiant","ancient","hidden","sacred","cursed",
  "bright","faded","vivid","smoky","hazy","misty","dusky","sunny","shady","rainy",
  "velvet","silken","rough","smooth","heavy","light","tangled","twisted","gentle","fierce",
  "crimson","violet","indigo","scarlet","golden","ebony","pearl","topaz","emerald","sapphire",
  "cosmic","stellar","galactic","orbital","quantum","digital","electric","magnetic","atomic","sonic",
  "blazing","shining","drifting","rising","falling","flying","burning","glowing","fading","surging",
  "lucky","clever","restless","endless","fearless","timeless","boundless","weightless","breathless","careless",
  // Medaka color types (as adjectives)
  "hikari","miyuki","platinum","albino","kohaku","shiro","orochi","ginga","ryusei","yukiguni",
  "hagoromo","rakuraku","kaga","panda","shirogane","matsukaze","yamato","daruma","balloon","lyretail",
];
const NOUNS = [
  "blade","wave","crest","drift","veil","path","gate","core","forge","realm",
  "ridge","vale","shore","grove","field","brook","creek","cliff","dune","plain",
  "vault","rift","spire","haven","cape","bay","glen","ford","moor","peak",
  "hawk","wolf","raven","crane","falcon","heron","tern","kite","wren","lynx",
  "stone","marble","flint","quartz","obsidian","topaz","garnet","pearl","opal","ruby",
  "trail","track","route","lane","road","pass","bridge","arch","tower","dome",
  "spark","flame","ember","frost","gust","tide","surge","pulse","flow","beam",
  "ghost","shade","echo","trace","signal","cypher","vector","node","cipher","prism",
  "arrow","shield","lance","crown","throne","anvil","hammer","chain","key","seal",
  "horizon","zenith","orbit","galaxy","cosmos","nebula","pulsar","quasar","comet","meteor",
  "canyon","cavern","lagoon","delta","basin","crater","summit","glacier","tundra","marsh",
  "phoenix","dragon","serpent","chimera","golem","specter","wraith","titan","colossus","leviathan",
  "circuit","matrix","kernel","daemon","pixel","codec","shader","render","buffer","thread",
  "storm","thunder","cyclone","tempest","squall","gale","torrent","blizzard","avalanche","tsunami",
  "garden","forest","jungle","desert","island","mountain","ocean","valley","meadow","reef",
  // Medaka fish variety names (as nouns)
  "medaka","oryzias","koi","guppy","betta","tetro","neon","danio","rasbora","molly",
  "platy","swordtail","endler","gambusia","furcata","celebes","ricefish","killifish","panchax","aphyosemion",
  // Extra nature/element words
  "aurora","solstice","equinox","eclipse","zenith","meridian","parallax","vortex","anomaly","paradox",
  "crystal","diamond","sapphire","amethyst","tourmaline","malachite","citrine","peridot","zircon","tanzanite",
  "monsoon","typhoon","sirocco","mistral","zephyr","haboob","chinook","foehn","tramontane","bora",
];
function generateRandomUsername(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${b}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TempMailPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<{ status: string; daily_count: number; total_donated?: number } | null>(null);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [isTiersModalOpen, setIsTiersModalOpen] = useState(false);

  // Generator form
  const [username, setUsername] = useState("");
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [domainOpen, setDomainOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // BYOE States
  const [mode, setMode] = useState<"public" | "byoe">("public");
  const [byoeConnections, setByoeConnections] = useState<{ id: string; gmail_address: string }[]>([]);
  const [selectedByoeId, setSelectedByoeId] = useState("");
  const [byoeEmail, setByoeEmail] = useState("");
  const [byoePassword, setByoePassword] = useState("");
  const [byoeConnecting, setByoeConnecting] = useState(false);
  const [isAddingByoe, setIsAddingByoe] = useState(false);
  const [byoeDropdownOpen, setByoeDropdownOpen] = useState(false);

  // Inbox
  const [messages, setMessages] = useState<Message[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<MessageDetail | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [copied, setCopied] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const destroyingRef = useRef(false);
  const [inboxPage, setInboxPage] = useState(0);
  const INBOX_PAGE_SIZE = 8;

  // Countdown
  const [countdown, setCountdown] = useState("10:00");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Load existing session + domains + access on mount ──
  useEffect(() => {
    Promise.all([
      fetch("/api/temp-mail/session").then((r) => r.json()),
      fetch("/api/temp-mail/domains").then((r) => r.json()),
      fetch("/api/temp-mail/access").then((r) => r.json()),
      fetch("/api/temp-mail/byoe/connections").then((r) => r.json()),
      new Promise((res) => setTimeout(res, 800)),
    ]).then(([sessionData, domainData, accessData, byoeData]) => {
      if (accessData && accessData.status) {
        setAccess({ status: accessData.status, daily_count: accessData.daily_count, total_donated: accessData.total_donated ?? 0 });
      }
      
      if (sessionData.session) {
        setSession(sessionData.session);
        // Pre-fill username from existing active session
        const [u, d] = (sessionData.session.address as string).split('@');
        if (sessionData.session.mailtm_account_id === 'byoe_gmail') {
          const suffix = u.split('+')[1];
          if (suffix) setUsername(suffix);
        } else {
          if (u) setUsername(u);
          if (d) setDomain(d);
        }
      }
      if (domainData.domains?.length) {
        // Sort domains: not banned first, then banned
        const sortedDomains = domainData.domains.sort((a: DomainInfo, b: DomainInfo) => 
          (a.is_banned === b.is_banned) ? 0 : a.is_banned ? 1 : -1
        );
        setDomains(sortedDomains);
        if (!sessionData.session) {
          const firstAvailable = sortedDomains.find((d: DomainInfo) => !(d.available_at && new Date(d.available_at).getTime() > Date.now()));
          setDomain(firstAvailable?.domain || sortedDomains[0]?.domain || '');
        }
      }
      
      if (byoeData.connections) {
        setByoeConnections(byoeData.connections);
        if (byoeData.connections.length > 0) {
          setSelectedByoeId(byoeData.connections[0].id);
        }
      }
    }).finally(() => setPageLoading(false));
  }, []);

  // ── Countdown timer ──
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => setCountdown(formatCountdown(session.expires_at)), 0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(formatCountdown(session.expires_at));
    }, 1000);
    return () => {
      clearTimeout(t);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [session]);

  // ── Auto-refresh inbox every 10 seconds ──
  const fetchMessages = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/temp-mail/messages");
      if (res.status === 410 || res.status === 404) {
        // Session expired — retain username so user can quickly regenerate
        setSession((prev) => {
          if (prev?.address) {
            const isByoe = prev.mailtm_account_id === 'byoe_gmail' || prev.address.endsWith('@gmail.com');
            const [u, d] = prev.address.split('@');
            if (isByoe) {
              const suffix = u.split('+')[1];
              if (suffix) setUsername(suffix);
            } else {
              setUsername(u ?? '');
              setDomain((currentDomain) => d ?? currentDomain);
            }
          }
          return null;
        });
        setMessages([]);
        if (pollRef.current) clearInterval(pollRef.current);
        if (!destroyingRef.current) {
          toast.error("Session expired. Generate a new email.", { classNames: { icon: 'text-destructive' } });
        }
        return;
      }
      if (!res.ok) {
        try {
          const errData = await res.json();
          console.error("API Error Response:", errData);
        } catch {
          console.error("API returned non-JSON error:", res.status);
        }
        return;
      }
      const data = await res.json();
      setSession({ address: data.address, expires_at: data.expires_at });
      
      const currentReadIds = new Set(JSON.parse(localStorage.getItem('temp_mail_read') || '[]'));
      setMessages((data.messages ?? []).map((m: Message) => ({
        ...m,
        seen: currentReadIds.has(m.id)
      })));
    } catch (err) {
      console.error("Fetch error caught:", err);
      if (!silent) toast.error("Inbox sync failed. Check connection.");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    // Immediately fetch (deferred to avoid synchronous setState in effect)
    const t = setTimeout(() => fetchMessages(true), 0);
    pollRef.current = setInterval(() => fetchMessages(true), 10000);
    return () => {
      clearTimeout(t);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session, fetchMessages]);

  // ── Generate new temp email ──
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "public" && (!username.trim() || !domain)) return;
    if (mode === "byoe" && !selectedByoeId) return;

    setGenerating(true);
    destroyingRef.current = false;
    try {
      const bodyPayload = mode === "public" 
        ? { username: username.trim().toLowerCase(), domain } 
        : { byoe_gmail_id: selectedByoeId };

      const res = await fetch("/api/temp-mail/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create mailbox.", { classNames: { icon: "text-destructive" } });
        return;
      }
      setSession({ address: data.address, expires_at: data.expires_at });
      setMessages([]);
      setSelectedMsg(null);
      setAccess((prev) => prev ? { ...prev, daily_count: prev.daily_count + 1 } : null);
      toast.success(`Temp email active and ready.`, { classNames: { icon: "text-green-500" } });
    } catch {
      toast.error("Network error. Please try again.", { classNames: { icon: "text-destructive" } });
    } finally {
      setGenerating(false);
    }
  };

  // ── BYOE Connect ──
  const handleConnectByoe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!byoeEmail || !byoePassword) return;
    setByoeConnecting(true);
    try {
      const res = await fetch("/api/temp-mail/byoe/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: byoeEmail, appPassword: byoePassword })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to connect Gmail.", { classNames: { icon: "text-destructive" } });
        return;
      }
      setByoeConnections(prev => [data.connection, ...prev]);
      setSelectedByoeId(data.connection.id);
      setByoeEmail("");
      setByoePassword("");
      setIsAddingByoe(false);
      toast.success("Gmail connected successfully!");
    } catch {
      toast.error("Network error.");
    } finally {
      setByoeConnecting(false);
    }
  };

  // ── BYOE Delete ──
  const handleDeleteByoe = async (id: string) => {
    try {
      const res = await fetch(`/api/temp-mail/byoe/connections?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to remove Gmail.");
        return;
      }
      setByoeConnections(prev => prev.filter(c => c.id !== id));
      if (selectedByoeId === id) {
        const remaining = byoeConnections.filter(c => c.id !== id);
        setSelectedByoeId(remaining.length > 0 ? remaining[0].id : "");
      }
      toast.success("Gmail removed.");
    } catch {
      toast.error("Network error.");
    }
  };

  // ── Destroy session ──
  const handleDestroy = async () => {
    if (!session) return;
    setDestroying(true);
    destroyingRef.current = true;
    const prevAddress = session.address;
    try {
      await fetch("/api/temp-mail/create", { method: "DELETE" });
      setSession(null);
      setMessages([]);
      setSelectedMsg(null);
      
      // Keep username/domain in the field so user can quickly regenerate
      const isByoe = session.mailtm_account_id === 'byoe_gmail' || prevAddress.endsWith('@gmail.com');
      const [u, d] = prevAddress.split("@");
      
      if (isByoe) {
        const suffix = u.split('+')[1];
        if (suffix) setUsername(suffix);
      } else {
        if (u) setUsername(u);
        if (d) setDomain(d);
      }
      
      if (pollRef.current) clearInterval(pollRef.current);
      
      toast.success("Temp email session closed.", { classNames: { icon: "text-green-500" } });
    } catch {
      destroyingRef.current = false;
      toast.error("Failed to destroy session.", { classNames: { icon: "text-destructive" } });
    } finally {
      setDestroying(false);
    }
  };

  const requestAccess = async () => {
    setRequestingAccess(true);
    try {
      const res = await fetch("/api/temp-mail/access", { method: "POST" });
      if (res.ok) {
        setAccess({ status: "pending", daily_count: 0 });
        toast.success("Whitelist request sent to admin.");
      } else {
        throw new Error();
      }
    } catch {
      toast.error("Failed to request access.");
    } finally {
      setRequestingAccess(false);
    }
  };

  // ── Open message detail ──
  const openMessage = async (id: string) => {
    setLoadingMsg(true);
    setSelectedMsg(null);
    try {
      const res = await fetch(`/api/temp-mail/message/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedMsg(data);
      // Mark as seen locally
      const currentReadIds = new Set(JSON.parse(localStorage.getItem('temp_mail_read') || '[]'));
      currentReadIds.add(id);
      localStorage.setItem('temp_mail_read', JSON.stringify(Array.from(currentReadIds)));
      
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, seen: true } : m)));
    } catch {
      toast.error("Failed to load message.", { classNames: { icon: "text-destructive" } });
    } finally {
      setLoadingMsg(false);
    }
  };

  // ── Copy email address ──
  const copyAddress = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.address);
    setCopied(true);
    toast.success("Temp email copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  if (pageLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
        <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-10 relative min-h-screen">
      <div className="mx-auto max-w-3xl">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
            <Mail className="size-3 mr-2" />
            Temp Mail
          </div>
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
              Temporary Email
            </h1>
            <GuideModal title="How Temp Mail Works">
              <p>Generate a disposable email address to receive verification codes without exposing your real email.</p>
              <ul className="list-disc pl-4 space-y-2 mt-2">
                <li><strong>Privacy:</strong> All emails strictly expire 10 minutes after generation. Messages and addresses are permanently deleted.</li>
                <li><strong>Limits:</strong> By default, users have a limited number of active temp mail addresses.</li>
                <li><strong>Upgrading:</strong> Donating POL to the community Faucet immediately increases your daily limit. If you reach your limit and donate to reach the next tier, you instantly get the extra quota to use today! Quotas fully reset at 12 AM PHT.</li>
              </ul>
            </GuideModal>
          </div>
          <p className="mt-2 text-muted-foreground text-sm">
            Generate a disposable email address to receive codes and verifications.
          </p>

        </div>

        {/* ── Access Gating ── */}
        {access?.status !== "approved" && (
          <div className="rounded-xl border border-border/60 bg-background/40 p-10 flex flex-col items-center justify-center text-center space-y-4">
            <Mail className="size-12 text-muted-foreground/30 mb-2" />
            <h2 className="font-heading text-xl text-foreground">Temp Mail Access Required</h2>
            {(!access || access.status === "none") && (
              <>
                <p className="text-sm text-muted-foreground max-w-md">
                  You need to request access from an administrator to use the temporary email feature.
                </p>
                <button
                  onClick={requestAccess}
                  disabled={requestingAccess}
                  className="mt-4 flex items-center justify-center h-10 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {requestingAccess ? <Loader2 className="size-4 animate-spin" /> : "Request Access"}
                </button>
              </>
            )}
            {access?.status === "pending" && (
              <p className="text-sm text-amber-500 max-w-md font-medium">
                Your request is pending admin approval. Please check back later.
              </p>
            )}
            {access?.status === "rejected" && (
              <p className="text-sm text-destructive max-w-md font-medium">
                Your request to use Temp Mail was denied by an administrator.
              </p>
            )}
            <p className="mt-6 text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
              💡 Tip: Donate at least 10 POL to the community Faucet to get automatically approved for Temp Mail access!
            </p>
          </div>
        )}

        {/* ── Message Detail View ── */}
        {access?.status === "approved" && (
        <AnimatePresence mode="wait">
          {selectedMsg && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setSelectedMsg(null)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-foreground/5 hover:bg-foreground/10 px-4 py-2 rounded-full transition-all"
                >
                  <ChevronLeft className="size-4" />
                  Back to inbox
                </button>
              </div>

              <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-background/80 to-background/40 overflow-hidden shadow-xl shadow-black/5 backdrop-blur-xl relative">
                {/* Decorative blur */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none -z-10" />

                {/* Email header */}
                <div className="p-6 sm:p-8 border-b border-border/40 relative">
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                    <div className="space-y-5 flex-1 min-w-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug tracking-tight truncate whitespace-normal break-words">
                        {selectedMsg.subject || "(No subject)"}
                      </h2>
                      
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg flex-shrink-0 border border-primary/20">
                          {(selectedMsg.from.name || selectedMsg.from.address).charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="flex flex-col gap-0.5 text-sm min-w-0">
                          <div className="flex items-center gap-2 text-foreground flex-wrap">
                            <span className="font-semibold truncate max-w-full">
                              {selectedMsg.from.name || selectedMsg.from.address.split('@')[0]}
                            </span>
                            <span className="text-muted-foreground/60 text-xs truncate">
                              &lt;{selectedMsg.from.address}&gt;
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                            To: <span className="text-foreground/80 font-mono text-[11px] truncate">{selectedMsg.to?.[0]?.address ?? session?.address}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground font-mono bg-foreground/5 px-3 py-1.5 rounded-md border border-border/30 flex-shrink-0 self-start">
                      {new Date(selectedMsg.createdAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {/* Email body */}
                <div className="p-4 sm:p-8 border-t border-border/40">
                  <div className="rounded-xl overflow-hidden border border-border/20 relative mx-auto w-full max-w-full bg-background/50">
                    {selectedMsg.html?.length > 0 ? (
                      <iframe
                        srcDoc={prepareHtml(selectedMsg.html[0])}
                        className="w-full min-h-[500px] border-0 bg-transparent"
                        style={{ colorScheme: 'dark' }}
                        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                        title="Email content"
                      />
                    ) : (
                      <div className="p-6 sm:p-10 overflow-auto bg-transparent min-h-[300px]">
                        <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                          {selectedMsg.text || "(Empty message)"}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {!selectedMsg && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 max-w-2xl mx-auto"
            >
              {/* ── Active Session Card ── */}
              {session ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1.5">
                        Active Inbox
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-semibold text-foreground font-mono break-all">
                          {session.address}
                        </span>
                        <button
                          onClick={copyAddress}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                            copied
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                          }`}
                        >
                          {copied ? (
                            <><CheckIcon className="size-3" /> Copied</>
                          ) : (
                            <><Copy className="size-3" /> Copy</>
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleDestroy}
                      disabled={destroying}
                      className="flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      title="Destroy this inbox"
                    >
                      {destroying ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </button>
                  </div>

                  {/* Timer */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span>
                      Resets on incoming mail · expires in{" "}
                      <span className={`font-mono font-medium ${
                        parseInt(countdown.split(":")[0]) < 2 ? "text-destructive" : "text-foreground"
                      }`}>
                        {countdown}
                      </span>
                    </span>
                  </div>
                </div>
              ) : (
                /* ── Generator Form ── */
                <div className="rounded-xl border border-border/60 bg-background/40 p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex bg-foreground/5 p-1 rounded-lg">
                      <button 
                        onClick={() => setMode("public")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === "public" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Public Domain
                      </button>
                      <button 
                        onClick={() => setMode("byoe")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${mode === "byoe" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Personal Gmail <Crown className="size-3 text-amber-500" />
                      </button>
                    </div>
                    <button onClick={() => setIsTiersModalOpen(true)} className="flex items-center gap-1 text-primary hover:underline hover:text-primary/80 transition-colors bg-primary/10 px-2 py-1 rounded-md shrink-0">
                      <HelpCircle className="size-3" /> <span className="text-[9px] whitespace-nowrap">View Tiers</span>
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 -mt-2">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Daily Limit Remaining
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                          {(() => {
                            const tempMailLimit = getTierLimits(access?.total_donated ?? 0).tempMailLimit;
                            const used = access?.daily_count || 0;
                            const remaining = Math.max(0, tempMailLimit - used);
                            const fillPct = Math.max(0, (remaining / tempMailLimit) * 100);
                            const isLow = fillPct <= 20;
                            return (
                              <>
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-destructive' : 'bg-emerald-500'}`}
                                  style={{ width: `${fillPct}%` }}
                                />
                              </>
                            );
                          })()}
                        </div>
                        {(() => {
                          const tempMailLimit = getTierLimits(access?.total_donated ?? 0).tempMailLimit;
                          const used = access?.daily_count || 0;
                          const remaining = Math.max(0, tempMailLimit - used);
                          const fillPct = Math.max(0, (remaining / tempMailLimit) * 100);
                          const isLow = fillPct <= 20;
                          return (
                            <div className={`font-mono text-xs font-bold ${isLow ? 'text-destructive' : 'text-emerald-500'}`}>
                              {remaining} remaining
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {(() => {
                      const tempMailLimit = getTierLimits(access?.total_donated ?? 0).tempMailLimit;
                      const used = access?.daily_count || 0;
                      const remaining = Math.max(0, tempMailLimit - used);
                      if (remaining <= 5) {
                        return (
                          <div className="text-[10px] text-primary/80 text-right w-full mt-0.5 animate-pulse">
                            💡 Hit your limit? Donate to instantly unlock more today!
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {mode === "byoe" && (byoeConnections.length === 0 || isAddingByoe) ? (
                    <form onSubmit={handleConnectByoe} className="p-5 border border-primary/20 bg-primary/5 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">Connect your Gmail (BYOE)</div>
                        {byoeConnections.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsAddingByoe(false)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-500/90 flex gap-2 items-start">
                        <span className="mt-0.5 text-amber-500">⚠️</span>
                        <span><strong>Tip:</strong> Use a <strong>dummy or secondary Gmail</strong>, not your main account, for better privacy.</span>
                      </div>

                      <div className="rounded-lg bg-foreground/[0.03] border border-border/40 px-4 py-3 space-y-2">
                        <p className="text-xs font-semibold text-foreground">How to connect your Gmail:</p>
                        <ol className="text-xs text-muted-foreground space-y-3 pl-1">
                          <li className="flex gap-2">
                            <span className="text-primary font-bold shrink-0">1.</span>
                            <span>
                              <strong className="text-foreground">Enable IMAP</strong> in Gmail:{" "}
                              <a href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold inline-flex items-center gap-0.5 hover:text-primary/80 transition-colors">Open Gmail Settings ↗</a>
                              {" "}→ click <span className="font-mono bg-foreground/10 px-1 rounded">Forwarding and POP/IMAP</span> tab → scroll to <strong className="text-foreground">IMAP access</strong> → select <span className="font-mono bg-foreground/10 px-1 rounded">Enable IMAP</span> → click <strong className="text-foreground">Save Changes</strong>.
                            </span>
                          </li>
                          <li className="flex gap-2"><span className="text-primary font-bold shrink-0">2.</span><span>Make sure <strong className="text-foreground">2-Step Verification</strong> is ON in your Google account.</span></li>
                          <li className="flex gap-2"><span className="text-primary font-bold shrink-0">3.</span><span>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold inline-flex items-center gap-0.5 hover:text-primary/80 transition-colors">myaccount.google.com/apppasswords ↗</a></span></li>
                          <li className="flex gap-2"><span className="text-primary font-bold shrink-0">4.</span><span>Type a name (e.g. <span className="font-mono bg-foreground/10 px-1 rounded">Meteorn Hub</span>) and click <strong className="text-foreground">Create</strong>.</span></li>
                          <li className="flex gap-2"><span className="text-primary font-bold shrink-0">5.</span><span>Copy the <strong className="text-foreground">16-letter password</strong> Google gives you and paste it below.</span></li>
                        </ol>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="email"
                          placeholder="Your Gmail address"
                          value={byoeEmail}
                          onChange={(e) => setByoeEmail(e.target.value)}
                          required
                          className="w-full h-10 rounded-lg border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <input
                          type="password"
                          placeholder="16-letter App Password"
                          value={byoePassword}
                          onChange={(e) => setByoePassword(e.target.value)}
                          required
                          className="w-full h-10 rounded-lg border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={byoeConnecting}
                        className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
                      >
                        {byoeConnecting ? <Loader2 className="size-4 animate-spin" /> : "Connect Gmail"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleGenerate} className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-stretch gap-3">
                        {mode === "public" && (
                          <div className="flex-[2] relative">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                              <AtSign className="size-4 text-muted-foreground/70" />
                            </div>
                            <input
                              type="text"
                              placeholder="yourusername"
                              value={username}
                              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                              minLength={3}
                              maxLength={30}
                              required
                              className="w-full h-11 rounded-xl border border-border/50 bg-background/50 pl-9 pr-24 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors placeholder:text-muted-foreground/50 font-mono shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setUsername(generateRandomUsername())}
                              className="absolute inset-y-0 right-2 flex items-center gap-1 px-2 my-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-semibold transition-all"
                            >
                              <Shuffle className="size-3" />
                              Random
                            </button>
                          </div>
                        )}

                        <div className="flex-1 relative">
                          {mode === "byoe" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setByoeDropdownOpen((o) => !o)}
                                className={`w-full h-11 flex items-center justify-between gap-2 px-4 rounded-xl border border-border/50 bg-background/50 text-sm font-mono transition-colors shadow-sm ${
                                  byoeDropdownOpen ? "ring-1 ring-primary/50 border-primary/50" : "hover:bg-foreground/[0.03]"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="truncate">{byoeConnections.find(c => c.id === selectedByoeId)?.gmail_address || "Select Gmail"}</span>
                                </div>
                                <ChevronDown className={`size-4 text-muted-foreground transition-transform flex-shrink-0 ${byoeDropdownOpen ? "rotate-180" : ""}`} />
                              </button>

                              <AnimatePresence>
                              {byoeDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setByoeDropdownOpen(false)} />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute z-50 right-0 top-full mt-1.5 w-full min-w-[220px] rounded-xl border border-border bg-background shadow-xl overflow-hidden"
                                  >
                                    <div className="py-1">
                                      {byoeConnections.map((c) => (
                                        <div
                                          key={c.id}
                                          className={`w-full px-4 py-2.5 text-sm font-mono transition-colors flex items-center justify-between gap-2 group ${
                                            selectedByoeId === c.id
                                              ? "bg-primary/10 text-primary"
                                              : "text-foreground hover:bg-foreground/[0.04]"
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => { setSelectedByoeId(c.id); setByoeDropdownOpen(false); }}
                                            className="flex-1 text-left truncate"
                                          >
                                            <span className="truncate">{c.gmail_address}</span>
                                          </button>
                                          <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {selectedByoeId === c.id && <CheckIcon className="size-3.5" />}
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); handleDeleteByoe(c.id); setByoeDropdownOpen(false); }}
                                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-destructive hover:bg-destructive/10 transition-all"
                                              title="Remove this Gmail"
                                            >
                                              <TrashIcon className="size-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                      <div className="h-px bg-border/50 my-1" />
                                      <button
                                        type="button"
                                        onClick={() => { setByoeDropdownOpen(false); setIsAddingByoe(true); }}
                                        className="w-full px-4 py-2.5 text-sm text-left font-mono transition-colors flex items-center text-primary hover:bg-primary/10"
                                      >
                                        <Plus className="size-4 mr-2" /> Add another Gmail
                                      </button>
                                    </div>
                                  </motion.div>
                                </>
                              )}
                              </AnimatePresence>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDomainOpen((o) => !o)}
                              className={`w-full h-11 flex items-center justify-between gap-2 px-4 rounded-xl border border-border/50 bg-background/50 text-sm font-mono transition-colors shadow-sm ${
                                domainOpen ? "ring-1 ring-primary/50 border-primary/50" : "hover:bg-foreground/[0.03]"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <><span className="text-muted-foreground/60">@</span><span className="truncate">{domain}</span></>
                              </div>
                              <ChevronDown className={`size-4 text-muted-foreground transition-transform flex-shrink-0 ${domainOpen ? "rotate-180" : ""}`} />
                            </button>
                          )}

                          {mode === "public" && (
                            <AnimatePresence>
                            {domainOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setDomainOpen(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute z-50 right-0 top-full mt-1.5 w-full min-w-[220px] rounded-xl border border-border bg-background shadow-xl overflow-hidden"
                                >
                                  <div className="py-1">
                                    {domains.map((d) => {
                                      const isUpcoming = Boolean(d.available_at && new Date(d.available_at).getTime() > now);
                                      return (
                                      <button
                                        key={d.domain}
                                        type="button"
                                        disabled={isUpcoming}
                                        onClick={() => { setDomain(d.domain); setDomainOpen(false); }}
                                        className={`w-full px-4 py-2.5 text-sm text-left font-mono transition-colors flex items-center justify-between ${
                                          domain === d.domain
                                            ? "bg-primary/10 text-primary"
                                            : isUpcoming ? "opacity-50 cursor-not-allowed bg-background" : "text-foreground hover:bg-foreground/[0.04]"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <span className="truncate">@{d.domain}</span>
                                          {d.is_banned && (
                                            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-500 flex-shrink-0">
                                              Banned in Game
                                            </span>
                                          )}
                                          {isUpcoming && (
                                            <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 rounded flex items-center gap-1 flex-shrink-0">
                                              <Clock className="size-3" />
                                              {(() => {
                                                const diff = new Date(d.available_at!).getTime() - now;
                                                const h = Math.floor(diff / (1000 * 60 * 60));
                                                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                const s = Math.floor((diff % (1000 * 60)) / 1000);
                                                if (h > 0) return `${h}h ${m}m`;
                                                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                              })()}
                                            </span>
                                          )}
                                        </div>
                                        {domain === d.domain && <CheckIcon className="size-3.5 flex-shrink-0" />}
                                      </button>
                                    )})}
                                  </div>
                                </motion.div>
                              </>
                            )}
                            </AnimatePresence>
                          )}
                        </div>
                      </div>

                      <p className={`text-[11px] font-medium ${mode === "byoe" ? "text-primary/80" : "text-muted-foreground/80"}`}>
                        {mode === "byoe" 
                          ? "✨ Auto-generating unique dot trick variation for your Gmail address." 
                          : "3–30 characters · lowercase letters, numbers, dots, and dashes allowed"
                        }
                      </p>

                      <div className="pt-2">
                        <GenerateButton 
                          onClick={handleGenerate}
                          isGenerating={generating}
                          disabled={generating || (mode === "public" && (!username || !domain || (domains.find(d => d.domain === domain)?.available_at ? new Date(domains.find(d => d.domain === domain)!.available_at!).getTime() > now : false))) || (mode === "byoe" && !selectedByoeId)}
                          hue={210}
                        />
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* ── Inbox ── */}
              {session && (
                <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
                  {/* Inbox header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <Inbox className="size-4 text-muted-foreground" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Inbox
                      </span>
                      {messages.filter((m) => !m.seen).length > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          {messages.filter((m) => !m.seen).length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => fetchMessages(false)}
                      disabled={refreshing}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  {/* Message list */}
                  {loadingMsg ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mail className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Waiting for emails</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto-refreshes every 10 seconds. Send an email to{" "}
                          <span className="font-mono text-foreground">{session.address}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {messages
                        .slice(inboxPage * INBOX_PAGE_SIZE, (inboxPage + 1) * INBOX_PAGE_SIZE)
                        .map((msg) => (
                        <button
                          key={msg.id}
                          onClick={() => openMessage(msg.id)}
                          className="w-full text-left px-5 py-4 hover:bg-foreground/[0.02] transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            {/* Unread dot */}
                            <div className="mt-1.5 flex-shrink-0">
                              <span className={`block size-2 rounded-full ${msg.seen ? "bg-transparent" : "bg-primary"}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm truncate ${msg.seen ? "text-muted-foreground font-normal" : "text-foreground font-medium"}`}>
                                  {msg.from.name || msg.from.address}
                                </span>
                                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                                  {formatRelativeTime(msg.createdAt)}
                                </span>
                              </div>
                              <p className={`text-sm truncate mt-0.5 ${msg.seen ? "text-muted-foreground/60" : "text-foreground/80"}`}>
                                {msg.subject || "(No subject)"}
                              </p>
                              {msg.intro && (
                                <p className="text-xs text-muted-foreground/50 truncate mt-0.5">
                                  {msg.intro}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Footer + Pagination */}
                  <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between gap-3">
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {messages.length} message{messages.length !== 1 ? "s" : ""} · auto-refreshing every 10s
                    </p>
                    {messages.length > INBOX_PAGE_SIZE && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setInboxPage((p) => Math.max(0, p - 1))}
                          disabled={inboxPage === 0}
                          className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="size-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {inboxPage + 1} / {Math.ceil(messages.length / INBOX_PAGE_SIZE)}
                        </span>
                        <button
                          onClick={() => setInboxPage((p) => Math.min(Math.ceil(messages.length / INBOX_PAGE_SIZE) - 1, p + 1))}
                          disabled={inboxPage >= Math.ceil(messages.length / INBOX_PAGE_SIZE) - 1}
                          className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown className="size-3.5 -rotate-90" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>

      {/* ── Tiers Modal ── */}
      <AnimatedModal isOpen={isTiersModalOpen} onClose={() => setIsTiersModalOpen(false)} title="Donation Tiers & Limits" icon={<Crown size={18} strokeWidth={1.5} />} maxWidth="lg">
        <div className="p-4 sm:p-6">
          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {TIER_TABLE.map((tier, i) => {
              const totalDonated = access?.total_donated ?? 0;
              const isCurrentTier = totalDonated >= tier.min && (i === TIER_TABLE.length - 1 || totalDonated < TIER_TABLE[i + 1].min);
              return (
                <div key={tier.min} className={`rounded-xl border p-4 space-y-2 transition-colors ${
                  isCurrentTier ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-background/40'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TierEffect donatedAmount={tier.min} className="text-sm" />
                      <span className="text-[10px] text-muted-foreground">({tier.min}+ POL)</span>
                    </div>
                    {isCurrentTier && <span className="text-[9px] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded shrink-0">YOUR TIER</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-foreground/5 p-2 text-center">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Faucet</div>
                      <div className="text-xs font-bold text-foreground">{tier.faucetLimit}/day</div>
                    </div>
                    <div className="rounded-lg bg-foreground/5 p-2 text-center">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Temp Mail</div>
                      <div className="text-xs font-bold text-foreground">{tier.tempMailLimit.toLocaleString()}/day</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3 pr-4 font-medium">Lifetime Donated</th>
                  <th className="py-3 px-4 font-medium">Faucet Claims</th>
                  <th className="py-3 px-4 font-medium">Temp Mail Quota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-muted-foreground">
                {TIER_TABLE.map((tier, i) => {
                  const totalDonated = access?.total_donated ?? 0;
                  const isCurrentTier = totalDonated >= tier.min && (i === TIER_TABLE.length - 1 || totalDonated < TIER_TABLE[i + 1].min);
                  return (
                    <tr key={tier.min} className={`hover:bg-foreground/5 transition-colors ${isCurrentTier ? 'bg-primary/5' : ''}`}>
                      <td className={`py-3 pr-4 font-medium whitespace-nowrap ${isCurrentTier ? 'text-primary' : i === 0 ? 'text-foreground' : 'text-foreground/70'}`}>
                        <div className="flex items-center gap-2">
                          <TierEffect donatedAmount={tier.min} />
                          <span className="text-xs text-muted-foreground">({tier.min}+ POL)</span>
                          {isCurrentTier && <span className="text-[9px] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">YOUR TIER</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">{tier.faucetLimit} / day</td>
                      <td className="py-3 px-4">{tier.tempMailLimit.toLocaleString()} / day</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 p-4 bg-primary/5 rounded-xl border border-primary/20 text-center">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              Donations are cumulative. Upgrade your tier anytime.
            </p>
          </div>
        </div>
      </AnimatedModal>
    </div>
  );
}
