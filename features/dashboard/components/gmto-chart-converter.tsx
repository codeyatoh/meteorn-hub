"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowRightLeft, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import Image from "next/image";

interface GmtoChartConverterProps {
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", php: "₱", eur: "€" };

export function GmtoChartConverter({ currency }: GmtoChartConverterProps) {
  const [data, setData] = useState<{ time: string; price: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [gmtoAmount, setGmtoAmount] = useState<string>("1");
  const [fiatAmount, setFiatAmount] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gmto-chart?currency=${currency}&days=1`);
      const json = await res.json();
      
      if (json.prices && json.prices.length > 0) {
        const formattedData = json.prices.map((item: [number, number]) => ({
          time: new Date(item[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: item[1]
        }));
        
        setData(formattedData);
        
        const latestPrice = json.prices[json.prices.length - 1][1];
        const oldestPrice = json.prices[0][1];
        setCurrentPrice(latestPrice);
        setPriceChange(((latestPrice - oldestPrice) / oldestPrice) * 100);
        
        // Update fiat input based on current GMTO input
        const gmto = parseFloat(gmtoAmount || "0");
        setFiatAmount((gmto * latestPrice).toFixed(6));
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch chart data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wrap in setTimeout to avoid synchronous setState in effect (fetchChartData calls setLoading synchronously)
    const timeout = setTimeout(() => {
      fetchChartData();
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  // Handle GMTO Input Change
  const handleGmtoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGmtoAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && currentPrice > 0) {
      setFiatAmount((num * currentPrice).toFixed(6));
    } else {
      setFiatAmount("");
    }
  };

  // Handle Fiat Input Change
  const handleFiatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFiatAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && currentPrice > 0) {
      setGmtoAmount((num / currentPrice).toFixed(2));
    } else {
      setGmtoAmount("");
    }
  };

  const currencySymbol = CURRENCY_SYMBOLS[currency] || "$";
  const isPositive = priceChange >= 0;

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-2">
          <Image src="/gmto.png" alt="GMTO" width={12} height={12} className="object-contain opacity-70" />
          GMTO / {currency.toUpperCase()} Chart
        </div>
        
        <button 
          onClick={fetchChartData}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Updating..." : "Refresh"}
        </button>
      </div>

      <div className="flex items-end gap-3 mb-6">
        <span className="text-3xl font-heading tracking-tight text-foreground">
          {currencySymbol}{currentPrice.toFixed(6)}
        </span>
        <span className={`flex items-center text-xs font-medium mb-1.5 ${isPositive ? "text-emerald-500" : "text-destructive"}`}>
          {isPositive ? <TrendingUp className="size-3.5 mr-1" /> : <TrendingDown className="size-3.5 mr-1" />}
          {Math.abs(priceChange).toFixed(2)}%
        </span>
      </div>

      <div className="h-[200px] w-full mb-8 relative">
        {loading && data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-muted-foreground animate-pulse">Loading chart data...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis 
                dataKey="time" 
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground"
                minTickGap={30}
              />
              <YAxis 
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground"
                tickFormatter={(val) => `${currencySymbol}${val.toFixed(5)}`}
                width={80}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--border)", borderRadius: "8px" }}
                itemStyle={{ color: "var(--foreground)" }}
                formatter={(value) => {
                  const val = typeof value === 'number' ? value : parseFloat(String(value) || '0');
                  return [`${currencySymbol}${val.toFixed(6)}`, 'Price'];
                }}
                labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px" }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke={isPositive ? "#10b981" : "#ef4444"} 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "var(--background)", stroke: isPositive ? "#10b981" : "#ef4444", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Converter Section */}
      <div className="rounded-lg border border-border/40 bg-foreground/[0.02] p-4 mt-2">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] mb-5 text-center">
          Conversion Tool
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <label className="absolute -top-2.5 left-3 bg-background px-1 text-[10px] font-medium text-muted-foreground uppercase">
              GMTO
            </label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Image src="/gmto.png" alt="GMTO" width={16} height={16} className="object-contain" />
            </div>
            <input 
              type="number"
              value={gmtoAmount}
              onChange={handleGmtoChange}
              className="w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              placeholder="0.00"
            />
          </div>

          <div className="flex shrink-0 items-center justify-center size-8 rounded-full bg-accent text-muted-foreground">
            <ArrowRightLeft className="size-4" />
          </div>

          <div className="flex-1 w-full relative">
            <label className="absolute -top-2.5 left-3 bg-background px-1 text-[10px] font-medium text-muted-foreground uppercase">
              {currency}
            </label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground font-medium">
              {currencySymbol}
            </div>
            <input 
              type="number"
              value={fiatAmount}
              onChange={handleFiatChange}
              className="w-full rounded-md border border-input bg-background/50 pl-8 pr-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="text-center mt-4 text-[10px] text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
