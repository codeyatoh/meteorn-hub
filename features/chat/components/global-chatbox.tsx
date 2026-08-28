"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Smile, ChevronDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";
import type { IGif } from "@giphy/js-types";

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "");
const PAGE_SIZE = 30;

type GlobalChat = {
  id: number;
  user_id: string;
  message: string | null;
  type: string;
  gif_url: string | null;
  created_at: string;
  user_accounts?: { name?: string; avatar?: string } | null;
};

type Reaction = {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
};

type PanelType = "emoji" | "gif" | null;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👀"];

// Play a Discord-like ping sound using Web Audio API
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
    // AudioContext may be blocked before user interaction — ignore silently
  }
}

async function resolveUserName(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from("user_accounts")
    .select("name, avatar")
    .eq("user_id", userId)
    .single();
  return data;
}

export function GlobalChatbox() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<GlobalChat[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [input, setInput] = useState("");
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [gifSearch, setGifSearch] = useState("");
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Fetch current user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, [supabase]);

  // Subscribe to realtime regardless of whether chat is open (for badge + sound)
  useEffect(() => {
    if (!currentUserId) return;

    const chatSub = supabase
      .channel("global_chats_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chats" },
        async (payload) => {
          const newMsg = payload.new as GlobalChat;
          const ua = await resolveUserName(supabase, newMsg.user_id);
          const fullMsg = { ...newMsg, user_accounts: ua };

          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, fullMsg];
          });

          // Play sound and increment badge only for messages from others
          if (newMsg.user_id !== currentUserId) {
            playPing();
            setIsOpen((open) => {
              if (!open) setUnread((u) => u + 1);
              return open;
            });
          }
        }
      )
      .subscribe();

    const rxSub = supabase
      .channel("chat_reactions_realtime")
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

  // Load initial messages on first open
  const initialLoaded = useRef(false);
  useEffect(() => {
    if (!isOpen || !currentUserId || initialLoaded.current) return;
    initialLoaded.current = true;

    const loadInitial = async () => {
      const { data: chats } = await supabase
        .from("global_chats")
        .select("*, user_accounts(name, avatar)")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (chats) {
        const reversed = (chats as GlobalChat[]).reverse();
        setMessages(reversed);
        setHasMore(chats.length === PAGE_SIZE);
      }

      const { data: rx } = await supabase.from("chat_reactions").select("*");
      if (rx) setReactions(rx as Reaction[]);
    };

    loadInitial();
  }, [isOpen, currentUserId, supabase]);

  // Load reactions for new messages as they arrive
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldestId = messages[0].id;
    const prevScrollHeight = scrollRef.current?.scrollHeight ?? 0;

    const { data: chats } = await supabase
      .from("global_chats")
      .select("*, user_accounts(name, avatar)")
      .lt("id", oldestId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (chats && chats.length > 0) {
      const older = (chats as GlobalChat[]).reverse();
      setMessages((prev) => [...older, ...prev]);
      setHasMore(chats.length === PAGE_SIZE);

      // Restore scroll position so the view doesn't jump
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeight;
        }
      });
    } else {
      setHasMore(false);
    }

    setLoadingMore(false);
  }, [loadingMore, hasMore, messages, supabase]);

  // Scroll listener to trigger load-older
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    if (scrollRef.current.scrollTop < 80) {
      loadOlder();
    }
  }, [loadOlder]);

  // Scroll to bottom on initial load and new messages (only if near bottom)
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;
    const el = scrollRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom || messages.length <= PAGE_SIZE) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);


  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUserId) return;
    const msg = input.trim();
    setInput("");
    setActivePanel(null);
    await supabase.from("global_chats").insert({ user_id: currentUserId, message: msg, type: "text" });
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

  const togglePanel = (panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const fetchGifs = useCallback(
    (offset: number) =>
      gifSearch ? gf.search(gifSearch, { offset, limit: 12 }) : gf.trending({ offset, limit: 12 }),
    [gifSearch]
  );

  if (!currentUserId) return null;

  // — Closed state: floating bubble with badge —
  if (!isOpen) {
    return (
      <div className="fixed bottom-24 right-4 z-[90] sm:bottom-6 sm:right-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setIsOpen(true); setUnread(0); }}
          className="relative size-12 rounded-full bg-background/70 backdrop-blur-xl border border-primary/30 text-primary shadow-lg shadow-primary/10 flex items-center justify-center transition-colors hover:bg-background/90"
        >
          <MessageCircle className="size-5" />
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </motion.button>
      </div>
    );
  }

  return (
    <div
      className={[
        "fixed z-[90] flex flex-col",
        "bottom-20 left-2 right-2 max-h-[65vh]",
        "sm:bottom-6 sm:left-auto sm:right-6 sm:w-[360px] sm:max-h-[600px] sm:h-[80vh]",
        "bg-background/70 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
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

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
      >
        {/* Load-more indicator at top */}
        {loadingMore && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <p className="text-center text-[10px] text-muted-foreground/50 py-1">— Beginning of chat —</p>
        )}

        {messages.length === 0 && !loadingMore && (
          <div className="h-full flex items-center justify-center text-muted-foreground/50 text-xs text-center">
            <p>No messages yet.<br />Be the first to say something! 👋</p>
          </div>
        )}

        {messages.map((msg) => {
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
              {!isMe && (
                <span className="text-[10px] font-semibold text-muted-foreground ml-1">
                  {msg.user_accounts?.name ?? "Player"}
                </span>
              )}

              <div className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                {/* Bubble */}
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

                {/* Quick react on hover */}
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

              {/* Reaction pills */}
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

              {/* Timestamp */}
              <span className={`text-[9px] text-muted-foreground/50 px-1 ${isMe ? "text-right" : "text-left"}`}>
                {format(new Date(msg.created_at), "h:mm a")}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji / GIF Panel — tabbed */}
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
              <EmojiPicker
                theme={Theme.DARK}
                width="100%"
                height={350}
                onEmojiClick={(data: EmojiClickData) => setInput((prev) => prev + data.emoji)}
                lazyLoadEmojis
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
                    <button onClick={() => setGifSearch("")} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  <Grid key={gifSearch} width={340} columns={3} fetchGifs={fetchGifs} onGifClick={sendGif} noLink />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-border/40 bg-background/50">
        <form onSubmit={sendText} className="flex items-center gap-2">
          {/* GIF button */}
          <button
            type="button"
            onClick={() => togglePanel("gif")}
            title="GIFs"
            className={[
              "p-1.5 rounded-xl transition-colors",
              activePanel === "gif"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            ].join(" ")}
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-label="GIF">
              <rect x="2" y="6" width="20" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="800" fontFamily="monospace" fill="currentColor" letterSpacing="0.5">GIF</text>
            </svg>
          </button>

          {/* Text input */}
          <input
            type="text"
            placeholder="Chat with everyone..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-foreground/[0.04] border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/60"
          />

          {/* Emoji button */}
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

          {/* Send button */}
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
