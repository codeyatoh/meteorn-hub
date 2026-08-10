"use client";

import { useState } from "react";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", php: "₱", eur: "€" };

export function AdminCurrencySelector({ currentCurrency }: { currentCurrency: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const currencySymbol = CURRENCY_SYMBOLS[currentCurrency] || "$";

  return (
    <div className="flex flex-col items-start sm:items-end space-y-1.5 relative">
      <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Currency</label>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-28 flex items-center justify-between rounded-md border border-input bg-background/50 px-3 py-1.5 text-xs font-medium ring-offset-background hover:bg-background/80 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span>{currentCurrency.toUpperCase()} ({currencySymbol})</span>
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </button>
      {isOpen && (
        <div className="absolute top-[100%] right-0 z-50 mt-1 w-28 rounded-md border border-border bg-card text-card-foreground shadow-md outline-none">
          <div className="flex flex-col py-1">
            {Object.keys(CURRENCY_SYMBOLS).map(key => (
              <button
                key={key}
                type="button"
                onClick={async () => { 
                  setIsOpen(false); 
                  
                  // Update URL
                  const params = new URLSearchParams(searchParams);
                  params.set("currency", key);
                  router.push(`${pathname}?${params.toString()}`);
                  
                  // Update User Metadata in background
                  await supabase.auth.updateUser({ data: { currency: key } });
                }}
                className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs font-medium outline-none hover:bg-foreground/5 transition-colors ${currentCurrency === key ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {currentCurrency === key && <CheckIcon className="size-3 text-foreground" />}
                </span>
                {key.toUpperCase()} ({CURRENCY_SYMBOLS[key]})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
