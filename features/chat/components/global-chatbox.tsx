"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MessageCircle, X, Send, Smile, ChevronDown, Loader2, ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import type { IGif } from "@giphy/js-types";

// Dynamic imports — both are browser-only; ssr:false prevents SSR crashes on Vercel
const EmojiPicker = dynamic(
  () => import("./safe-emoji-picker"),
  { ssr: false }
);
const GiphyGrid = dynamic(
  () => import("@giphy/react-components").then((m) => m.Grid),
  { ssr: false }
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
};

type Reaction = {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
};

type PanelType = "emoji" | "gif" | null;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👀"];

function playPing() {
  try {
    const ctx = new AudioContext();
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
    // Ignore if AudioContext not available
  }
}

export function GlobalChatbox() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Persist open/closed state across page refreshes
  const [isOpen, setIsOpenState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("gchat_open") === "1";
  });
  const setIsOpen = useCallback((val: boolean) => {
    setIsOpenState(val);
    localStorage.setItem("gchat_open", val ? "1" : "0");
  }, []);
  const [messages, setMessages] = useState<GlobalChat[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [input, setInput] = useState("");
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [gifSearch, setGifSearch] = useState("");
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // Track whether user is at the bottom
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Count of new messages received while scrolled up
  const [newWhileAway, setNewWhileAway] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);

  // Stable supabase client — never recreated on re-render
  const supabase = useMemo(() => createClient(), []);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Track auth state changes — works on hard refresh, logout, and re-login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

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
          const { data: ua } = await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("id", newMsg.user_id)
            .single();

          const fullMsg: GlobalChat = { ...newMsg, user_profile: ua };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, fullMsg];
          });

          if (newMsg.user_id !== currentUserId) {
            playPing();
            if (!isOpenRef.current) {
              setUnread((u) => u + 1);
            }
            // If chat is open but user scrolled up, increment new-while-away counter
            if (isOpenRef.current && !isAtBottomRef.current) {
              setNewWhileAway((n) => n + 1);
            }
          }
        }
      )
      .subscribe();

    const rxSub = supabase
      .channel("chat_reactions_always")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_reactions" }, (payload) => {
        setReactions((prev) => {
          if (prev.some((r) => r.id === (payload.new as Reaction).id)) return prev;
          return [...prev, payload.new as Reaction];
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_reactions" }, (payload) => {
        setReactions((prev) => prev.filter((r) => r.id !== (payload.old as Reaction).id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatSub);
      supabase.removeChannel(rxSub);
    };
  }, [currentUserId, supabase]);

  // Helper: fetch user names for a list of user_ids
  const fetchUserNames = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return new Map<string, { full_name?: string; role?: string }>();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", userIds);
    return new Map((data ?? []).map((u) => [u.id, { full_name: u.full_name, role: u.role }]));
  }, [supabase]);

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
        const userIds = [...new Set((chats as GlobalChat[]).map((c) => c.user_id))];
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
  }, [currentUserId, supabase, fetchUserNames, scrollToBottom]);

  // Load older messages on scroll-to-top
  const loadOlder = useCallback(async () => {
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
      const userIds = [...new Set((chats as GlobalChat[]).map((c) => c.user_id))];
      const userMap = await fetchUserNames(userIds);
      const older = (chats as GlobalChat[])
        .map((c) => ({ ...c, user_profile: userMap.get(c.user_id) ?? null }))
        .reverse();

      setMessages((prev) => [...older, ...prev]);
      setHasMore(chats.length === PAGE_SIZE);

      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeight;
        }
      });
    } else {
      setHasMore(false);
    }

    setLoadingMore(false);
  }, [loadingMore, hasMore, messages, supabase, fetchUserNames]);

  // Scroll listener — tracks position and triggers load-older
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (el.scrollTop < 80) loadOlder();

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < 60;
    setIsAtBottom(atBottom);
    if (atBottom) setNewWhileAway(0);
  }, [loadOlder]);

  // Auto-scroll to bottom when new message arrives and user is already at bottom
  useEffect(() => {
    if (messages.length === 0) return;
    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isNewMessage && isAtBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages, scrollToBottom]);

  const jumpToBottom = useCallback(() => {
    setNewWhileAway(0);
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUserId) return;
    const msg = input.trim();
    setInput("");
    setActivePanel(null);
    await supabase.from("global_chats").insert({ user_id: currentUserId, message: msg, type: "text" });
    // Always jump to bottom when user sends
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  const sendGif = async (gif: IGif, e: React.SyntheticEvent<HTMLElement, Event>) => {
    e.preventDefault();
    if (!currentUserId) return;
    setActivePanel(null);
    await supabase.from("global_chats").insert({
      user_id: currentUserId,
      type: "gif",
      gif_url: gif.images.fixed_height.url,
    });
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    if (!currentUserId) return;
    const existing = reactions.find(
      (r) => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji
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
      gifSearch ? gf.search(gifSearch, { offset, limit: 12 }) : gf.trending({ offset, limit: 12 }),
    [gifSearch]
  );

  if (!currentUserId) return null;

  // Closed state: floating bubble
  if (!isOpen) {
    return (
      <div className="fixed bottom-36 right-4 z-[90] sm:bottom-6 sm:right-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setIsOpen(true); setUnread(0); }}
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
        </motion.button>
      </div>
    );
  }

  return (
    <div
      className={[
        "fixed z-[90] flex flex-col",
        // Mobile: sits above nav dock (dock = 58px at bottom-6 = 82px total; we use bottom-36 = 144px for breathing room)
        "bottom-36 left-2 right-2 max-h-[55vh]",
        // Desktop: normal positioning
        "sm:bottom-6 sm:left-auto sm:right-6 sm:w-[360px] sm:max-h-[600px] sm:h-[80vh]",
        "bg-background/85 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-2xl shadow-black/30 overflow-hidden",
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

      {/* Messages — positioned relative so the jump pill can float inside it */}
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
            <p className="text-center text-[10px] text-muted-foreground/50 py-1">— Beginning of chat —</p>
          )}

          {initialLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground/50 text-xs text-center">
              <p>No messages yet.<br />Be the first to say something! 👋</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user_id === currentUserId;
              const msgRx = reactions.filter((r) => r.message_id === msg.id);
              const grouped = msgRx.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return (
                <div
                  key={msg.id}
                  className="flex flex-col gap-0.5 group"
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                >
                  <div className={`flex items-center gap-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {msg.user_profile?.full_name ?? "Player"}
                    </span>
                    {msg.user_profile?.role === "admin" && (
                      <span className="text-[8.5px] font-bold tracking-widest uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm">
                        Admin
                      </span>
                    )}
                  </div>

                  <div className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    <div
                      className={[
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug",
                        isMe
                          ? "bg-primary/20 border border-primary/30 text-foreground rounded-br-sm"
                          : "bg-foreground/[0.06] border border-border/40 text-foreground rounded-bl-sm",
                      ].join(" ")}
                    >
                      {msg.type === "text" && <span>{msg.message}</span>}
                      {msg.type === "gif" && msg.gif_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={msg.gif_url} alt="GIF" className="max-w-[180px] rounded-lg object-contain" />
                      )}
                    </div>

                    <AnimatePresence>
                      {hoveredMsg === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex gap-0.5 bg-background/90 backdrop-blur-sm border border-border/50 rounded-full p-1 shadow-lg"
                        >
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="text-sm hover:scale-125 transition-transform leading-none"
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {Object.keys(grouped).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                      {Object.entries(grouped).map(([emoji, count]) => {
                        const iReacted = msgRx.some((r) => r.emoji === emoji && r.user_id === currentUserId);
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

                  <span className={`text-[9px] text-muted-foreground/50 px-1 ${isMe ? "text-right" : "text-left"}`}>
                    {format(new Date(msg.created_at), "h:mm a")}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Jump-to-bottom pill — shown when scrolled up, shows unread count */}
        <AnimatePresence>
          {!isAtBottom && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={jumpToBottom}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shadow-lg hover:bg-primary/90 transition-colors whitespace-nowrap z-10"
            >
              <ArrowDown className="size-3 shrink-0" />
              {newWhileAway > 0
                ? `${newWhileAway} new message${newWhileAway > 1 ? "s" : ""}`
                : "Jump to bottom"}
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
            animate={{ height: activePanel === "emoji" ? 350 : 300, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 border-t border-border/40 overflow-hidden bg-background/80"
          >
            {activePanel === "emoji" && (
              <EmojiPicker onEmojiClick={(data: EmojiClickData) => setInput((prev) => prev + data.emoji)} />
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
                    <button onClick={() => setGifSearch("")} className="text-muted-foreground hover:text-foreground">
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
      <div className="shrink-0 p-3 border-t border-border/40 bg-background/50">
        <form onSubmit={sendText} className="flex items-center gap-2">
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
            type="text"
            placeholder="Chat with everyone..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-foreground/[0.04] border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/60"
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
