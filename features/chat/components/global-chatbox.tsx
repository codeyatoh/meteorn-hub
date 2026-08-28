"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Minimize2, Send, Smile, Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChatMessage } from "@/components/ui/chat-message";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || "");

type GlobalChat = {
  id: number;
  user_id: string;
  message: string | null;
  type: string;
  gif_url: string | null;
  created_at: string;
  users?: { name?: string; avatar?: string };
};

type Reaction = {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
};

export function GlobalChatbox() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<GlobalChat[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchGifs = (offset: number) => {
    return gifSearch ? gf.search(gifSearch, { offset, limit: 10 }) : gf.trending({ offset, limit: 10 });
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
  }, [supabase]);

  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    
    // Load initial messages
    const loadData = async () => {
      const { data: chats } = await supabase
        .from("global_chats")
        .select(`*, users:user_accounts(name, avatar)`)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (chats) setMessages(chats.reverse());

      const { data: rx } = await supabase.from("chat_reactions").select("*");
      if (rx) setReactions(rx);
    };
    loadData();

    // Subscribe to new messages
    const chatSub = supabase.channel('global_chats_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_chats' }, async (payload) => {
        const newMsg = payload.new as GlobalChat;
        // Fetch user info for new message
        const { data: userData } = await supabase.from('user_accounts').select('name, avatar').eq('user_id', newMsg.user_id).single();
        setMessages(prev => [...prev, { ...newMsg, users: userData || {} }]);
      })
      .subscribe();

    const rxSub = supabase.channel('chat_reactions_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_reactions' }, (payload) => {
        setReactions(prev => [...prev, payload.new as Reaction]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_reactions' }, (payload) => {
        setReactions(prev => prev.filter(r => r.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatSub);
      supabase.removeChannel(rxSub);
    };
  }, [isOpen, supabase]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUserId) return;
    const msg = input.trim();
    setInput("");
    setShowEmojiPicker(false);
    
    await supabase.from("global_chats").insert({
      user_id: currentUserId,
      message: msg,
      type: "text"
    });
  };

  const handleSendGif = async (gif: any, e: React.SyntheticEvent<HTMLElement, Event>) => {
    e.preventDefault();
    setShowGifPicker(false);
    await supabase.from("global_chats").insert({
      user_id: currentUserId,
      type: "gif",
      gif_url: gif.images.fixed_height.url
    });
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji);
    if (existing) {
      await supabase.from("chat_reactions").delete().match({ id: existing.id });
      // Optimistic delete
      setReactions(prev => prev.filter(r => r.id !== existing.id));
    } else {
      const { data } = await supabase.from("chat_reactions").insert({
        message_id: messageId,
        user_id: currentUserId,
        emoji
      }).select().single();
      // Optimistic insert
      if (data) setReactions(prev => [...prev, data]);
    }
  };

  const quickReactions = ["👍", "❤️", "😂", "🔥", "👀"];

  if (!currentUserId) return null;

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-[100] sm:bottom-6 sm:right-6">
        <Button 
          onClick={() => setIsOpen(true)}
          className="rounded-full size-12 shadow-lg shadow-primary/20 bg-background/50 border border-primary/30 text-primary hover:bg-background/80 transition-all duration-300 backdrop-blur-md"
        >
          <MessageCircle className="size-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] sm:bottom-6 sm:right-6 w-[350px] max-h-[600px] h-[80vh] flex flex-col bg-background/60 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-foreground/[0.02]">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-foreground">Global Chat</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
          <Minimize2 className="size-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.user_id === currentUserId;
          const msgReactions = reactions.filter(r => r.message_id === msg.id);
          // Group reactions by emoji
          const groupedReactions = msgReactions.reduce((acc, r) => {
            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <div key={msg.id} className="group relative flex flex-col">
              {!isMe && (
                <div className="text-[10px] text-muted-foreground mb-1 ml-1 flex items-center gap-1.5">
                  <span className="font-semibold text-foreground/80">{msg.users?.name || "Player"}</span>
                </div>
              )}
              
              <div className={`flex items-end gap-2 relative ${isMe ? "self-end" : "self-start"}`}>
                <ChatMessage
                  from={isMe ? "user" : "assistant"}
                  time={format(new Date(msg.created_at), "h:mm a")}
                  className="max-w-full"
                >
                  {msg.type === "text" && msg.message}
                  {msg.type === "gif" && msg.gif_url && (
                    <img src={msg.gif_url} alt="GIF" className="max-w-[200px] rounded-md object-contain" />
                  )}
                </ChatMessage>
                
                {/* Reaction Popover (appears on hover) */}
                <div className={`absolute bottom-0 p-1 bg-background border border-border rounded-full shadow-lg flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isMe ? "right-full mr-2" : "left-full ml-2"}`}>
                  {quickReactions.map(emoji => (
                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-sm">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Reactions */}
              {Object.keys(groupedReactions).length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                  {Object.entries(groupedReactions).map(([emoji, count]) => {
                    const iReacted = msgReactions.some(r => r.emoji === emoji && r.user_id === currentUserId);
                    return (
                      <button 
                        key={emoji} 
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className={`px-1.5 py-0.5 rounded-full border text-[10px] flex items-center gap-1 transition-colors ${iReacted ? "bg-primary/20 border-primary/50" : "bg-foreground/[0.05] border-border/50 hover:bg-foreground/[0.1]"}`}
                      >
                        <span>{emoji}</span>
                        <span className={iReacted ? "text-primary" : "text-muted-foreground"}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Popovers for GIF/Emoji */}
      <AnimatePresence>
        {showGifPicker && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 left-2 right-2 h-[300px] bg-background border border-border rounded-xl shadow-xl overflow-hidden flex flex-col z-20"
          >
            <div className="p-2 border-b border-border flex items-center justify-between">
              <input 
                type="text" 
                placeholder="Search GIFs..." 
                className="w-full bg-transparent text-sm focus:outline-none"
                value={gifSearch}
                onChange={e => setGifSearch(e.target.value)}
              />
              <button onClick={() => setShowGifPicker(false)}><X className="size-4 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
              <Grid 
                width={330} 
                columns={3} 
                fetchGifs={fetchGifs} 
                key={gifSearch} 
                onGifClick={handleSendGif} 
                noLink
              />
            </div>
          </motion.div>
        )}
        
        {showEmojiPicker && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 right-2 z-20"
          >
            <EmojiPicker 
              theme={Theme.DARK}
              onEmojiClick={(emoji: EmojiClickData) => setInput(prev => prev + emoji.emoji)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-3 border-t border-border/50 bg-foreground/[0.02]">
        <form onSubmit={handleSendText} className="flex items-center gap-2 relative bg-background/50 border border-input rounded-full px-3 py-2 focus-within:border-primary/50 transition-colors">
          <button 
            type="button" 
            onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
            className={`text-muted-foreground hover:text-foreground transition-colors ${showGifPicker ? "text-primary" : ""}`}
            title="GIFs"
          >
            <ImageIcon className="size-4" />
          </button>
          
          <input 
            type="text"
            placeholder="Chat with everyone..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground/70"
            onClick={() => { setShowGifPicker(false); setShowEmojiPicker(false); }}
          />

          <button 
            type="button" 
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
            className={`text-muted-foreground hover:text-foreground transition-colors ${showEmojiPicker ? "text-primary" : ""}`}
            title="Emojis"
          >
            <Smile className="size-4" />
          </button>
          
          <button 
            type="submit"
            disabled={!input.trim()}
            className="bg-primary text-primary-foreground rounded-full p-1.5 disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Send className="size-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
