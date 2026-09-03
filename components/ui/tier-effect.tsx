"use client";

import { motion } from "motion/react";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getTierDetails } from "@/lib/utils/tiers";

export interface TierEffectProps {
  donatedAmount: number;
  className?: string;
  badge?: boolean;
}

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  x: number;
  size: number;
}

export function TierEffect({ donatedAmount, className, badge = false }: TierEffectProps) {
  const tier = getTierDetails(donatedAmount);
  const name = tier.name;
  
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Golden ratio physics: Smooth but active (not too fast, not too slow)
      setParticles(
        Array.from({ length: 8 }).map((_, i) => ({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 2.5,
          duration: 2 + Math.random() * 2, // 2-4 seconds base duration
          x: Math.random() * 20 - 10,
          size: 0.5 + Math.random() * 1.5
        }))
      );
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  let effectContent = null;
  if (name.includes("Shoshin")) effectContent = <ShoshinTier name={name} particles={particles} />;
  else if (name.includes("Minarai")) effectContent = <MinaraiTier name={name} particles={particles} />;
  else if (name.includes("Tatsujin")) effectContent = <TatsujinTier name={name} particles={particles} />;
  else if (name.includes("Kakusei")) effectContent = <KakuseiTier name={name} particles={particles} />;
  else if (name.includes("Mugen")) effectContent = <MugenTier name={name} particles={particles} />;
  else if (name.includes("Shinwa")) effectContent = <ShinwaTier name={name} particles={particles} />;
  else effectContent = <span className={cn(tier.colorClass, "font-bold relative z-10")}>{name}</span>;

  const content = (
    <span className="relative inline-flex items-center justify-center">
      {effectContent}
    </span>
  );

  if (badge) {
    return (
      <div className={cn("relative inline-flex flex-shrink-0 items-center justify-center px-3 py-1 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm text-sm z-10", className)}>
        {content}
      </div>
    );
  }

  return (
    <div className={cn("relative inline-flex items-center z-10 text-sm", className)}>
      {content}
    </div>
  );
}

// 1. Shoshin (Beginner) - Silver metallic text + moderate diamond sparkles
function ShoshinTier({ name, particles }: { name: string; particles: Particle[] }) {
  return (
    <>
      <span className="relative z-10 font-bold bg-clip-text text-transparent bg-gradient-to-b from-slate-100 to-slate-400 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">
        {name}
      </span>
      <span className="absolute inset-0 pointer-events-none z-[20]">
        {particles.slice(0, 5).map((p) => (
          <motion.span
            key={p.id}
            className="absolute bottom-1 bg-white shadow-[0_0_4px_rgba(255,255,255,1)] rotate-45"
            style={{ left: `${p.left}%`, width: p.size * 2, height: p.size * 2 }}
            animate={{ 
              y: [0, -15], 
              opacity: [0, 1, 0], 
              scale: [0, 1.5, 0] 
            }}
            transition={{ duration: p.duration * 1.2, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </span>
    </>
  );
}

// 2. Minarai (Apprentice) - Emerald glow text + moderate fireflies
function MinaraiTier({ name, particles }: { name: string; particles: Particle[] }) {
  return (
    <>
      <span className="relative z-10 font-bold text-emerald-400" style={{ textShadow: "0 0 8px rgba(52,211,153,0.4)" }}>
        {name}
      </span>
      <span className="absolute inset-0 pointer-events-none z-[20]">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute bottom-0 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,1)]"
            style={{ left: `${p.left}%`, width: p.size * 1.5, height: p.size * 1.5 }}
            animate={{ 
              y: [0, -10, -25], 
              x: [0, p.x, -p.x], 
              opacity: [0, 1, 0], 
              scale: [0, 1.2, 0] 
            }}
            transition={{ duration: p.duration * 1.4, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </span>
    </>
  );
}

// 3. Tatsujin (Expert) - Neon Orange static tech + moderate shooting sparks
function TatsujinTier({ name, particles }: { name: string; particles: Particle[] }) {
  return (
    <>
      <span className="relative z-10 font-bold text-orange-500 drop-shadow-[0_0_3px_rgba(249,115,22,0.5)] tracking-wide">
        {name}
      </span>
      <span className="absolute inset-0 pointer-events-none z-[20]">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute bottom-1 bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,1)]"
            style={{ left: `${p.left}%`, width: p.size, height: p.size * 3 }}
            animate={{ 
              y: [0, -30], 
              opacity: [0, 1, 0],
              rotate: 15
            }}
            transition={{ duration: p.duration * 0.8, repeat: Infinity, repeatDelay: p.delay, ease: "linear" }}
          />
        ))}
      </span>
    </>
  );
}

// 4. Kakusei (Awakening) - Crimson with white core + moderate aura streaks
function KakuseiTier({ name, particles }: { name: string; particles: Particle[] }) {
  return (
    <>
      <span className="relative z-10 font-bold text-red-100" style={{ textShadow: "0 0 3px #fff, 0 0 10px #ef4444" }}>
        {name}
      </span>
      <span className="absolute inset-0 pointer-events-none z-[20]">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute bottom-0 bg-red-500 blur-[1px]"
            style={{ left: `${p.left}%`, width: p.size * 1.5, height: p.size * 8 }}
            animate={{ 
              y: [0, -25], 
              opacity: [0, 0.8, 0], 
              scaleY: [1, 2, 1] 
            }}
            transition={{ duration: p.duration * 0.6, repeat: Infinity, repeatDelay: p.delay * 1.5, ease: "easeOut" }}
          />
        ))}
      </span>
    </>
  );
}

// 5. Mugen (Infinity) - Cosmic gradient + moderate swirling dust
function MugenTier({ name, particles }: { name: string; particles: Particle[] }) {
  return (
    <>
      <motion.span 
        className="relative z-10 font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-sky-400"
        style={{ backgroundSize: '200% auto' }}
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 8, ease: "linear", repeat: Infinity }}
      >
        {name}
      </motion.span>
      <span className="absolute inset-0 pointer-events-none z-[20]">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute bottom-1 rounded-full bg-indigo-300 shadow-[0_0_6px_rgba(129,140,248,1)]"
            style={{ left: `${p.left}%`, width: p.size * 1.5, height: p.size * 1.5 }}
            animate={{ 
              y: [0, -10, -20],
              x: [0, p.x * 2, 0], 
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0]
            }}
            transition={{ duration: p.duration * 1.1, repeat: Infinity, delay: p.delay, ease: "linear" }}
          />
        ))}
      </span>
    </>
  );
}

// 6. Shinwa (Myth) - Solid Gold + moderate majestic embers
function ShinwaTier({ name, particles }: { name: string; particles: Particle[] }) {
  return (
    <>
      <span 
        className="relative z-10 font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-amber-600"
        style={{ filter: "drop-shadow(0 2px 4px rgba(217,119,6,0.6))" }}
      >
        {name}
      </span>
      <span className="absolute inset-0 pointer-events-none z-[20]">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute bottom-0 rounded-full bg-yellow-200 shadow-[0_0_8px_rgba(253,224,71,1)]"
            style={{ left: `${p.left}%`, width: p.size * 2, height: p.size * 2 }}
            animate={{ 
              y: [0, -30],
              x: [0, p.x],
              opacity: [0, 1, 0],
              scale: [0.5, 2, 0.5]
            }}
            transition={{ duration: p.duration * 1.6, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
          />
        ))}
      </span>
    </>
  );
}
