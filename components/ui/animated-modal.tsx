"use client";

import { motion, AnimatePresence } from "motion/react";
import { XIcon } from "lucide-react";
import { ReactNode } from "react";

const springConfig = {
  type: "spring",
  stiffness: 450,
  damping: 38,
  mass: 1,
} as const;

interface AnimatedCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  onClose?: () => void;
}

export function AnimatedCard({ title, icon, children, maxWidth = "md", className = "", onClose }: AnimatedCardProps) {
  const maxWidthClass = {
    "sm": "sm:max-w-sm",
    "md": "sm:max-w-md",
    "lg": "sm:max-w-lg",
    "xl": "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
  }[maxWidth];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.98 }}
      transition={springConfig}
      className={`z-10 flex max-h-[95vh] w-full flex-col overflow-hidden rounded-[24px] border border-gray-200/60 bg-[#F5F5F7] text-[#374151] shadow-xl sm:max-h-[92vh] sm:rounded-[24px] ${maxWidthClass} dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 mx-auto`}
    >
      {/* Header */}
      <div className="flex flex-none items-center justify-between bg-[#F5F5F7] py-3 pr-3 pl-4 sm:py-4 sm:pr-4 sm:pl-5 dark:bg-zinc-900">
        <div className="flex items-center gap-2 sm:gap-3">
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-10 sm:w-10 sm:rounded-xl">
              {icon}
            </div>
          )}
          <span className="text-[14px] font-semibold tracking-tight text-[#29292B] sm:text-[15px] dark:text-zinc-100">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {onClose && (
            <button
              title="close"
              onClick={onClose}
              type="button"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:text-black/70 sm:p-2 dark:hover:text-white/70"
            >
              <XIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className={`custom-scrollbar flex-1 overflow-y-auto rounded-[18px] border border-[#E5E5E5] bg-white sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-950 m-1 sm:m-1.5 mt-0 p-4 sm:p-6 shadow-sm ${className}`}>
        {children}
      </div>
    </motion.div>
  );
}

interface AnimatedModalProps extends AnimatedCardProps {
  isOpen: boolean;
}

export function AnimatedModal({ isOpen, ...cardProps }: AnimatedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <AnimatedCard {...cardProps} />
        </div>
      )}
    </AnimatePresence>
  );
}
