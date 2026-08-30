"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  X,
  Send,
  Smile,
  ChevronDown,
  Loader2,
  ArrowDown,
  Handshake,
  Reply,
  ChevronRight,
  Heart,
  HandHeart,
  AtSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import type { IGif } from "@giphy/js-types";

// Dynamic imports — both are browser-only; ssr:false prevents SSR crashes on Vercel
const EmojiPicker = dynamic(() => import("./safe-emoji-picker"), {
  ssr: false,
});
const GiphyGrid = dynamic(
  () => import("@giphy/react-components").then((m) => m.Grid),
  { ssr: false },
);

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "");
const PAGE_SIZE = 30;

type GlobalChat = {
  id: number;
  user_id: string;
  message: string | null;
  type: string;
  gif_url: string | null;
  created_at: string;
  user_profile?: { full_name?: string; role?: string } | null;
  reply_to_id?: number | null;
};

type UserAccount = {
  id: number;
  name: string;
  tickets_done: number;
  total_tickets: number;
  avatar: string;
  referral_link: string | null;
};

// Mention parser helper
const parseMentions = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(@[\w.-]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          return (
            <span
              key={i}
              className="text-cyan-400 font-semibold bg-cyan-400/10 px-1 rounded-sm"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

type Reaction = {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
};

type PanelType = "emoji" | "gif" | null;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👀"];

// Pre-unlocked AudioContext helper
// AudioContext must be created/resumed during a user gesture.
// We create it once on first gesture, then reuse it for all pings.
function createPing(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore if AudioContext API fails
  }
}

const supabase = createClient();

export function GlobalChatbox() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Declared early so setIsOpen (below) can reference the setter without a
  // temporal dead-zone error — useState setters are stable references.
  const [messages, setMessages] = useState<GlobalChat[]>([]);
  const [isOpen, setIsOpenState] = useState<boolean>(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Restore open state once we know the user
  useEffect(() => {
    if (!currentUserId) return;
    const saved = localStorage.getItem(`gchat_open_${currentUserId}`);
    if (saved === "1") {
      setTimeout(() => setIsOpenState(true), 0);
    }
  }, [currentUserId]);
  const setIsOpen = useCallback((val: boolean) => {
    setIsOpenState(val);
    if (currentUserIdRef.current) {
      localStorage.setItem(
        `gchat_open_${currentUserIdRef.current}`,
        val ? "1" : "0",
      );
    }
    // Persist last-seen message ID when chat is opened so the badge resets correctly.
    // We use setMessages functional form; setter is stable so it's safe here.
    if (val) {
      setMessages((prev) => {
        const latestId = prev.length > 0 ? prev[prev.length - 1].id : 0;
        if (latestId > 0 && currentUserIdRef.current) {
          localStorage.setItem(
            `gchat_last_seen_${currentUserIdRef.current}`,
            String(latestId),
          );
        }
        return prev;
      });
    }
  }, []);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [input, setInput] = useState("");
  const [currentUserProfileName, setCurrentUserProfileName] = useState<
    string | null
  >(null);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [gifSearch, setGifSearch] = useState("");
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [hasUnreadMention, setHasUnreadMention] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const mySafeName = currentUserProfileName?.replace(/\s+/g, "") ?? "";
  const checkIsMentioned = useCallback(
    (msgText: string | null) => {
      if (!msgText) return false;
      const text = msgText.toLowerCase();
      return (
        text.includes("@everyone") ||
        text.includes("@highlight") ||
        (mySafeName !== "" && text.includes(`@${mySafeName.toLowerCase()}`))
      );
    },
    [mySafeName],
  );

  const [replyingTo, setReplyingTo] = useState<GlobalChat | null>(null);
  const [showReferralPicker, setShowReferralPicker] = useState(false);
  const [myAccounts, setMyAccounts] = useState<UserAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const openReferralPicker = async () => {
    if (showReferralPicker) {
      setShowReferralPicker(false);
      return;
    }
    setShowReferralPicker(true);
    setLoadingAccounts(true);
    const { data } = await supabase
      .from("user_accounts")
      .select("*")
      .eq("user_id", currentUserId)
      .neq("is_banned", true);
    if (data) setMyAccounts(data as UserAccount[]);
    setLoadingAccounts(false);
  };

  const sendReferral = async (acc: UserAccount) => {
    setShowReferralPicker(false);
    if (!currentUserId) return;
    const payload = JSON.stringify({
      accountId: acc.id,
      name: acc.name,
      avatar: acc.avatar,
      link: acc.referral_link,
    });
    const { error } = await supabase
      .from("global_chats")
      .insert({ user_id: currentUserId, message: payload, type: "referral" });
    if (error) toast.error("Failed to send referral help request.");
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  const handleReferralClick = (url: string) => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          const scheme = parsed.protocol.replace(":", "");
          const intentUrl = `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=${scheme};S.browser_fallback_url=${encodeURIComponent(url)};end;`;
          window.location.assign(intentUrl);
          return;
        }
      } catch {}
    }
    window.location.assign(url);
  };

  // Track whether user is at the bottom
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Count of new messages received while scrolled up
  const [newWhileAway, setNewWhileAway] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpenRef = useRef(isOpen);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  // Persisted AudioContext — unlocked on first user gesture
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Unlock AudioContext on user gesture (required by browser autoplay policy)
  const unlockAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    } catch {
      // AudioContext not available in this environment
    }
  }, []);

  // Globally listen for the FIRST user interaction anywhere on the page to unlock audio.
  // This ensures background chat pings work even if they haven't opened the chatbox yet.
  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudio();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };

    window.addEventListener("click", handleFirstInteraction, { once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, {
      once: true,
    });

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [unlockAudio]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // When opened, jump to bottom and focus input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollToBottom("instant");
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, scrollToBottom]);

  // Track auth state changes — works on hard refresh, logout, and re-login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .rpc("get_chat_profiles", { user_ids: [currentUserId] })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCurrentUserProfileName(data[0].full_name);
        }
      });
  }, [currentUserId]);

  // Reset component state when user logs out or switches accounts 
  const previousUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      previousUserIdRef.current !== null &&
      currentUserId !== previousUserIdRef.current
    ) {
      setMessages([]);
      setUnread(0);
      setHasUnreadMention(false);
      setIsOpenState(false);
      setHasMore(true);
    }
    previousUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Always-on realtime subscription (for badge + sound when chat is closed)
  useEffect(() => {
    if (!currentUserId) return;

    const chatSub = supabase
      .channel("global_chats_always")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chats" },
        async (payload) => {
          const newMsg = payload.new as GlobalChat;
          const { data: profiles } = await supabase.rpc("get_chat_profiles", {
            user_ids: [newMsg.user_id],
          });
          const ua = profiles?.[0] ?? null;

          const fullMsg: GlobalChat = { ...newMsg, user_profile: ua };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, fullMsg];
          });

          if (newMsg.user_id !== currentUserId) {
            // Play ping only if AudioContext has been unlocked by a user gesture
            if (
              audioCtxRef.current &&
              audioCtxRef.current.state === "running"
            ) {
              createPing(audioCtxRef.current);
            }
            if (!isOpenRef.current) {
              setUnread((u) => u + 1);
              if (checkIsMentioned(newMsg.message)) {
                setHasUnreadMention(true);
              }
            }
            // If chat is open but user scrolled up, increment new-while-away counter
            if (isOpenRef.current && !isAtBottomRef.current) {
              setNewWhileAway((n) => n + 1);
            }
          }
        },
      )
      .subscribe();

    const rxSub = supabase
      .channel("chat_reactions_always")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_reactions" },
        (payload) => {
          setReactions((prev) => {
            if (prev.some((r) => r.id === (payload.new as Reaction).id))
              return prev;
            return [...prev, payload.new as Reaction];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_reactions" },
        (payload) => {
          setReactions((prev) =>
            prev.filter((r) => r.id !== (payload.old as Reaction).id),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatSub);
      supabase.removeChannel(rxSub);
    };
  }, [currentUserId, checkIsMentioned]);

  // Helper: fetch user names for a list of user_ids via secure RPC
  const fetchUserNames = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0)
      return new Map<string, { full_name?: string; role?: string }>();
    const { data } = await supabase.rpc("get_chat_profiles", {
      user_ids: userIds,
    });
    return new Map(
      (data ?? []).map(
        (u: { user_id: string; full_name: string; role: string }) => [
          u.user_id,
          { full_name: u.full_name, role: u.role },
        ],
      ),
    );
  }, []);

  // Load initial messages as soon as auth resolves
  useEffect(() => {
    if (!currentUserId) return;

    const loadInitial = async () => {
      setInitialLoading(true);

      const { data: chats, error } = await supabase
        .from("global_chats")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) {
        console.error("[Chat] Failed to load messages:", error.message);
        setInitialLoading(false);
        return;
      }

      if (chats && chats.length > 0) {
        const userIds = [
          ...new Set((chats as GlobalChat[]).map((c) => c.user_id)),
        ];
        const userMap = await fetchUserNames(userIds);

        const enriched = (chats as GlobalChat[])
          .map((c) => ({ ...c, user_profile: userMap.get(c.user_id) ?? null }))
          .reverse();

        setMessages((prev) => {
          const existingIds = new Set(enriched.map((m) => m.id));
          const realtimeOnly = prev.filter((m) => !existingIds.has(m.id));
          return [...enriched, ...realtimeOnly];
        });
        setHasMore(chats.length === PAGE_SIZE);

        // Compute initial unread count from last-seen message ID persisted in localStorage
        const lastSeenId = Number(
          localStorage.getItem(`gchat_last_seen_${currentUserId}`) ?? 0,
        );
        const initialUnread = (enriched as GlobalChat[]).filter(
          (m) => m.id > lastSeenId && m.user_id !== currentUserId,
        ).length;
        setUnread(initialUnread);
        const unreadMentions =
          (enriched as GlobalChat[]).filter(
            (m) =>
              m.id > lastSeenId &&
              m.user_id !== currentUserId &&
              checkIsMentioned(m.message),
          ).length > 0;
        setHasUnreadMention(unreadMentions);
      } else {
        setHasMore(false);
      }

      const { data: rx } = await supabase.from("chat_reactions").select("*");
      if (rx) setReactions(rx as Reaction[]);
      setInitialLoading(false);

      // Instant scroll after initial load
      requestAnimationFrame(() => scrollToBottom("instant" as ScrollBehavior));
    };

    loadInitial();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, fetchUserNames, checkIsMentioned]);

  // Load older messages on scroll-to-top
  // setMessages is a stable useState setter — including it in deps satisfies
  // React Compiler's inferred dependency analysis without causing extra re-renders.
  const loadOlder = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldestId = messages[0].id;
    const prevScrollHeight = scrollRef.current?.scrollHeight ?? 0;

    const { data: chats } = await supabase
      .from("global_chats")
      .select("*")
      .lt("id", oldestId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (chats && chats.length > 0) {
      const userIds = [
        ...new Set((chats as GlobalChat[]).map((c) => c.user_id)),
      ];
      const userMap = await fetchUserNames(userIds);
      const older = (chats as GlobalChat[])
        .map((c) => ({ ...c, user_profile: userMap.get(c.user_id) ?? null }))
        .reverse();

      setMessages((prev) => [...older, ...prev]);
      setHasMore(chats.length === PAGE_SIZE);

      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop =
            scrollRef.current.scrollHeight - prevScrollHeight;
        }
      });
    } else {
      setHasMore(false);
    }

    setLoadingMore(false);
  };

  // Scroll listener — tracks position and triggers load-older
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    if (el.scrollTop < 80) loadOlder();

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < 60;
    setIsAtBottom(atBottom);
    if (atBottom) setNewWhileAway(0);
  };

  // Auto-scroll to bottom when new message arrives and user is already at bottom
  useEffect(() => {
    if (messages.length === 0) return;
    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isNewMessage && isAtBottomRef.current) {
      scrollToBottom("smooth");
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const jumpToBottom = () => {
    setNewWhileAway(0);
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    scrollToBottom("smooth");
    inputRef.current?.focus();
  };

  const uniqueNames = React.useMemo(() => {
    const names = new Set<string>();
    messages.forEach((m) => {
      if (m.user_profile?.full_name && m.user_id !== currentUserId) {
        names.add(m.user_profile.full_name);
      }
    });
    return Array.from(names);
  }, [messages, currentUserId]);

  const mentionOptions = React.useMemo(() => {
    if (mentionSearch === null) return [];
    const search = mentionSearch.toLowerCase();
    const allOptions = [
      "everyone",
      "highlight",
      ...uniqueNames.map((n) => n.replace(/\s+/g, "")),
    ];
    return allOptions.filter((opt) => opt.toLowerCase().includes(search));
  }, [mentionSearch, uniqueNames]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const match = val.match(/(?:^|\s)@([\w.-]*)$/);
    if (match) {
      setMentionSearch(match[1]);
      setMentionIndex(0);
    } else {
      setMentionSearch(null);
    }
  };

  const insertMention = (name: string) => {
    setInput((prev) =>
      prev.replace(/(?:^|\s)@([\w.-]*)$/, ` @${name} `).trimStart(),
    );
    setMentionSearch(null);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionSearch !== null && mentionOptions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionOptions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (prev) => (prev - 1 + mentionOptions.length) % mentionOptions.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionOptions[mentionIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMentionSearch(null);
      }
    }
  };

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUserId) return;
    const msg = input.trim();
    setInput("");
    setActivePanel(null);
    const replyId = replyingTo?.id || null;
    setReplyingTo(null);
    const { error } = await supabase.from("global_chats").insert({
      user_id: currentUserId,
      message: msg,
      type: "text",
      reply_to_id: replyId,
    });
    if (error) toast.error("Failed to send message. Please try again.");
    // Always jump to bottom when user sends
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  const sendGif = async (
    gif: IGif,
    e: React.SyntheticEvent<HTMLElement, Event>,
  ) => {
    e.preventDefault();
    if (!currentUserId) return;
    setActivePanel(null);
    const { error } = await supabase.from("global_chats").insert({
      user_id: currentUserId,
      type: "gif",
      gif_url: gif.images.fixed_height.url,
    });
    if (error) toast.error("Failed to send GIF. Please try again.");
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    if (!currentUserId) return;
    const existing = reactions.find(
      (r) =>
        r.message_id === messageId &&
        r.user_id === currentUserId &&
        r.emoji === emoji,
    );
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      await supabase.from("chat_reactions").delete().match({ id: existing.id });
    } else {
      const { data } = await supabase
        .from("chat_reactions")
        .insert({ message_id: messageId, user_id: currentUserId, emoji })
        .select()
        .single();
      if (data) setReactions((prev) => [...prev, data as Reaction]);
    }
  };

  const togglePanel = (panel: PanelType) =>
    setActivePanel((prev) => (prev === panel ? null : panel));

  const fetchGifs = useCallback(
    (offset: number) =>
      gifSearch
        ? gf.search(gifSearch, { offset, limit: 12 })
        : gf.trending({ offset, limit: 12 }),
    [gifSearch],
  );

  if (!currentUserId) return null;

  // Closed state: floating bubble
  if (!isOpen) {
    return (
      <div className="fixed bottom-24 right-4 z-[90] sm:bottom-6 sm:right-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            unlockAudio();
            setIsOpen(true);
            setUnread(0);
            setHasUnreadMention(false);
          }}
          className="relative size-12 rounded-full bg-background/70 backdrop-blur-xl border border-primary/30 text-primary shadow-lg shadow-primary/10 flex items-center justify-center transition-colors hover:bg-background/90"
        >
          <MessageCircle className="size-5" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hasUnreadMention && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute -top-2 -left-2 size-6 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center shadow-lg shadow-amber-500/20 border-2 border-background animate-bounce"
              >
                <AtSign className="size-3.5" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    );
  }

  return (
    <div
      onClick={unlockAudio}
      className={[
        "fixed z-[90] flex flex-col",
        // Mobile: explicit height so flex-1 resolves. bottom-24=96px, dock top ~82px = 14px gap.
        "bottom-24 left-2 right-2 h-[calc(100svh-7rem)]",
        // Desktop: normal float bottom-right
        "sm:bottom-6 sm:left-auto sm:right-6 sm:w-[360px] sm:h-[min(600px,80vh)]",
        "bg-background sm:bg-background/80 sm:backdrop-blur-2xl border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
      ].join(" ")}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-widest font-bold text-foreground/80">
            Global Chat
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-foreground/5"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Messages — relative wrapper so the jump pill can float inside */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-3 py-3 space-y-3"
        >
          {loadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!hasMore && messages.length > 0 && (
            <p className="text-center text-[10px] text-muted-foreground/50 py-1">
              — Beginning of chat —
            </p>
          )}

          {initialLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground/50 text-xs text-center">
              <p>
                No messages yet.
                <br />
                Be the first to say something! 👋
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user_id === currentUserId;

              let mentionType: "none" | "direct" | "highlight" | "everyone" = "none";
              if (!isMe && msg.message) {
                const text = msg.message.toLowerCase();
                const mySafeName = currentUserProfileName?.replace(/\s+/g, "") ?? "";
                if (text.includes("@everyone")) mentionType = "everyone";
                else if (text.includes("@highlight")) mentionType = "highlight";
                else if (mySafeName && text.includes(`@${mySafeName.toLowerCase()}`)) mentionType = "direct";
              }

              const msgRx = reactions.filter((r) => r.message_id === msg.id);
              const grouped = msgRx.reduce(
                (acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              );

              return (
                <div
                  key={msg.id}
                  className="flex flex-col gap-0.5 group relative"
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                >
                  <div
                    className={`flex items-center gap-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {msg.user_profile?.full_name ?? "Player"}
                    </span>
                    {msg.user_profile?.role === "admin" && (
                      <span className="text-[8.5px] font-bold tracking-widest uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm">
                        Admin
                      </span>
                    )}
                  </div>

                  <div
                    className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"} flex-wrap sm:flex-nowrap`}
                  >
                    <div className="flex flex-col gap-1 max-w-[80%]">
                      {msg.reply_to_id && (
                        <div
                          onClick={() => {
                            const el = document.getElementById(
                              `msg-${msg.reply_to_id}`,
                            );
                            el?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            el?.classList.add(
                              "bg-primary/20",
                              "transition-colors",
                              "duration-500",
                            );
                            setTimeout(
                              () => el?.classList.remove("bg-primary/20"),
                              1500,
                            );
                          }}
                          className="text-[10px] bg-foreground/[0.03] border border-border/30 rounded-md px-2 py-1 cursor-pointer hover:bg-foreground/[0.06] transition-colors truncate flex items-center gap-1 text-muted-foreground"
                        >
                          <Reply className="size-3" />
                          <span className="truncate">Replied to message</span>
                        </div>
                      )}

                      <div
                        id={`msg-${msg.id}`}
                        className={[
                          "rounded-2xl px-3 py-2 text-sm leading-snug w-full relative",
                          isMe
                            ? "bg-primary/20 border border-primary/30 text-foreground rounded-br-sm"
                            : mentionType === "everyone"
                              ? "bg-cyan-500/10 border border-cyan-500/40 text-foreground rounded-bl-sm shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                              : mentionType === "highlight"
                                ? "bg-rose-500/10 border border-rose-500/40 text-foreground rounded-bl-sm shadow-[0_0_10px_rgba(243,24,113,0.1)]"
                                : mentionType === "direct"
                                  ? "bg-amber-500/10 border border-amber-500/40 text-foreground rounded-bl-sm shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                                  : "bg-foreground/[0.06] border border-border/40 text-foreground rounded-bl-sm",
                          msg.type === "referral"
                            ? "p-0 border-none bg-transparent"
                            : "",
                        ].join(" ")}
                      >
                        {msg.type === "text" && (
                          <span className="whitespace-pre-wrap break-words">
                            {parseMentions(msg.message || "")}
                          </span>
                        )}
                        {msg.type === "gif" && msg.gif_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={msg.gif_url}
                            alt="GIF"
                            className="max-w-[180px] rounded-lg object-contain"
                          />
                        )}
                        {msg.type === "referral" && msg.message && (
                          <div className="bg-background/95 backdrop-blur border border-border/50 rounded-xl p-3 max-w-[220px] w-full shadow-sm flex flex-col gap-2.5">
                            <div className="flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                              <HandHeart className="size-3.5 text-primary" />
                              <span className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">
                                Help Needed
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              {(() => {
                                try {
                                  const data = JSON.parse(msg.message);
                                  return (
                                    <>
                                      Help{" "}
                                      <span className="text-primary font-semibold">
                                        {data.name}
                                      </span>{" "}
                                      by using their referral link!
                                    </>
                                  );
                                } catch {
                                  return "Invalid request";
                                }
                              })()}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <button
                                onClick={async () => {
                                  try {
                                    const data = JSON.parse(msg.message!);
                                    if (data.link)
                                      handleReferralClick(data.link);
                                  } catch {}
                                }}
                                className="flex-[2] bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-[10px] font-bold py-1.5 rounded-md transition-all flex items-center justify-center gap-1 border border-primary/20"
                              >
                                Go to Link <ChevronRight className="size-3" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const data = JSON.parse(msg.message!);
                                    const { error } = await supabase.rpc(
                                      "increment_referral_tickets",
                                      { target_account_id: data.accountId },
                                    );
                                    if (error)
                                      toast.error("Error updating account.");
                                    else
                                      toast.success("Help marked as Done! 💖");
                                  } catch {}
                                }}
                                title="Mark as Done"
                                className="flex-1 flex justify-center items-center py-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:scale-105 active:scale-95 rounded-md transition-all border border-rose-500/20"
                              >
                                <Heart className="size-3.5 fill-current" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {hoveredMsg === msg.id && msg.type !== "referral" && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className={`flex gap-0.5 bg-background/90 backdrop-blur-sm border border-border/50 rounded-full p-1 shadow-lg shrink-0 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                        >
                          {msg.type !== "gif" && (
                            <>
                              <button
                                onClick={() => setReplyingTo(msg)}
                                className="text-muted-foreground hover:text-foreground text-xs hover:bg-foreground/10 transition-colors rounded-full p-1"
                                title="Reply"
                              >
                                <Reply className={`size-3.5 ${isMe ? 'scale-x-[-1]' : ''}`} />
                              </button>
                              <div className="w-px h-3 bg-border/50 self-center mx-0.5" />
                            </>
                          )}
                          <div className="flex gap-0.5">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className="text-sm hover:scale-125 transition-transform leading-none"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {Object.keys(grouped).length > 0 && (
                    <div
                      className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      {Object.entries(grouped).map(([emoji, count]) => {
                        const iReacted = msgRx.some(
                          (r) =>
                            r.emoji === emoji && r.user_id === currentUserId,
                        );
                        return (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={[
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors",
                              iReacted
                                ? "bg-primary/20 border-primary/40 text-primary"
                                : "bg-foreground/[0.04] border-border/40 text-muted-foreground hover:bg-foreground/[0.08]",
                            ].join(" ")}
                          >
                            <span>{emoji}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <span
                    className={`text-[9px] text-muted-foreground/50 px-1 ${isMe ? "text-right" : "text-left"}`}
                  >
                    {format(new Date(msg.created_at), "h:mm a")}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Unread messages pill at the top */}
        <AnimatePresence>
          {!isAtBottom && newWhileAway > 0 && (
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              onClick={jumpToBottom}
              className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors whitespace-nowrap z-20"
            >
              <ArrowDown className="size-3.5 shrink-0" />
              {newWhileAway} unread message{newWhileAway > 1 ? "s" : ""}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Emoji / GIF Panel */}
      <AnimatePresence>
        {activePanel !== null && (
          <motion.div
            key={activePanel}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: activePanel === "emoji" ? 350 : 300,
              opacity: 1,
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 border-t border-border/40 overflow-hidden bg-background/80"
          >
            {activePanel === "emoji" && (
              <EmojiPicker
                onEmojiClick={(data: EmojiClickData) =>
                  setInput((prev) => prev + data.emoji)
                }
              />
            )}
            {activePanel === "gif" && (
              <div className="flex flex-col h-[300px]">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search GIFs..."
                    value={gifSearch}
                    onChange={(e) => setGifSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
                  />
                  {gifSearch && (
                    <button
                      onClick={() => setGifSearch("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  <GiphyGrid
                    key={gifSearch}
                    width={340}
                    columns={3}
                    gutter={6}
                    user={{}}
                    fetchGifs={fetchGifs}
                    onGifClick={sendGif}
                    noLink
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 flex flex-col border-t border-border/40 bg-background/50 relative">
        <AnimatePresence>
          {showReferralPicker && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-[100%] left-2 right-2 mb-2 bg-background border border-border rounded-xl shadow-xl overflow-hidden p-2 z-50 flex flex-col gap-2 max-h-[250px]"
            >
              <div className="flex justify-between items-center px-2 py-1">
                <span className="text-xs font-bold">Pick an Account</span>
                <button
                  onClick={() => setShowReferralPicker(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 flex flex-col gap-1">
                {loadingAccounts ? (
                  <div className="py-4 flex justify-center">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                ) : myAccounts.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No active accounts found.
                  </div>
                ) : (
                  myAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => sendReferral(acc)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-foreground/5 text-left border border-transparent hover:border-border transition-colors"
                    >
                      <span className="text-sm font-semibold truncate">
                        {acc.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {acc.tickets_done}/{acc.total_tickets}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mention Picker */}
        <AnimatePresence>
          {mentionSearch !== null && mentionOptions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full mb-2 left-4 z-50 bg-background/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-xl overflow-hidden min-w-[200px]"
            >
              <div className="max-h-[160px] overflow-y-auto py-1">
                {mentionOptions.map((opt, idx) => (
                  <button
                    key={opt}
                    onClick={() => insertMention(opt)}
                    onMouseEnter={() => setMentionIndex(idx)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                      idx === mentionIndex
                        ? "bg-primary/20 text-primary"
                        : "text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    <AtSign className="size-3 opacity-50" />
                    <span className="font-semibold">{opt}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {replyingTo && (
          <div className="flex items-center justify-between px-3 py-2 bg-foreground/[0.02] border-b border-border/20">
            <div className="flex items-center gap-2 overflow-hidden">
              <Reply className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">
                Replying to{" "}
                <span className="font-semibold text-foreground">
                  {replyingTo.user_profile?.full_name ?? "Player"}
                </span>
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded-md hover:bg-foreground/10 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={sendText}
          className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3"
        >
          <button
            type="button"
            onClick={openReferralPicker}
            title="Help me Refer"
            className={[
              "p-1.5 rounded-xl transition-colors flex items-center justify-center",
              showReferralPicker
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            ].join(" ")}
          >
            <Handshake className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => togglePanel("gif")}
            title="GIFs"
            className={[
              "p-1.5 rounded-xl transition-colors flex items-center justify-center",
              activePanel === "gif"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            ].join(" ")}
          >
            <div className="border-[1.5px] border-current rounded-[4px] px-1 py-0.5 text-[10px] font-black leading-none tracking-wider">
              GIF
            </div>
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder="Chat with everyone..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            className="flex-1 min-w-0 bg-foreground/[0.04] border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/60"
          />

          <button
            type="button"
            onClick={() => togglePanel("emoji")}
            title="Emoji"
            className={[
              "p-2 rounded-xl transition-colors",
              activePanel === "emoji"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            ].join(" ")}
          >
            <Smile className="size-4" />
          </button>

          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
