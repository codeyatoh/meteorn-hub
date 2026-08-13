"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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
      <div className="relative">
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-28 flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${isOpen ? 'ring-1 ring-ring border-ring' : 'hover:bg-foreground/[0.02]'}`}
        >
          <span className={currentCurrency ? "text-foreground" : "text-muted-foreground"}>
            {currentCurrency.toUpperCase()} ({currencySymbol})
          </span>
          <ChevronDownIcon className={`size-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute z-50 top-full right-0 mt-1.5 w-28 bg-background border border-input rounded-md shadow-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
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
                    const { error } = await supabase.auth.updateUser({ data: { currency: key } });
                    if (error) {
                      toast.error("Failed to update currency.");
                    } else {
                      toast.success("Currency updated successfully.");
                    }
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors outline-none ${
                    currentCurrency === key 
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
  );
}
