"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  className?: string;
}

export function DateTimePicker({ value, onChange, className }: DateTimePickerProps) {
  const date = value;

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange?.(undefined);
      return;
    }

    if (date) {
      selectedDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
    } else {
      selectedDate.setHours(12, 0, 0, 0);
    }

    onChange?.(selectedDate);
  };

  const handleTimeChange = (type: "hour" | "minute" | "ampm", val: number | string) => {
    const newDate = date ? new Date(date) : new Date();
    if (!date) {
      newDate.setHours(12, 0, 0, 0);
    }

    let h = newDate.getHours();
    let m = newDate.getMinutes();

    if (type === "hour") {
      const isPM = h >= 12;
      const hour = val as number;
      if (isPM) {
        h = hour === 12 ? 12 : hour + 12;
      } else {
        h = hour === 12 ? 0 : hour;
      }
    } else if (type === "minute") {
      m = val as number;
    } else if (type === "ampm") {
      const ampm = val as string;
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h >= 12) h -= 12;
    }

    newDate.setHours(h, m, 0, 0);
    onChange?.(newDate);
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start text-left font-normal px-3 shadow-sm",
          !date && "text-muted-foreground/50",
          className
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, "MMM d, yyyy \u00B7 h:mm a") : <span>Pick launch date & time...</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row shadow-xl border-border/60" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          className="rounded-l-md"
        />
        
        {/* Time Picker Sidebar */}
        <div className="w-full sm:w-[160px] border-t sm:border-t-0 sm:border-l border-border bg-muted/10 sm:relative">
          <div className="flex flex-col sm:absolute sm:inset-0">
            <div className="px-3 py-2.5 text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1.5 border-b border-border bg-muted/20">
              <Clock className="size-3.5" />
              Time
            </div>
            
            <div className="flex-1 flex p-2 gap-1.5 min-h-0">
              {/* Hours */}
              <ScrollArea className="flex-1 bg-background rounded-md border border-border/40 shadow-inner">
                <div className="flex flex-col p-1 gap-1">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const h = i === 0 ? 12 : i;
                    const isSelected = date ? (date.getHours() % 12 || 12) === h : (h === 12);
                    return (
                      <button 
                        key={h}
                        type="button"
                        onClick={() => handleTimeChange("hour", h)}
                        className={cn(
                          "py-1.5 text-xs rounded-sm transition-colors font-mono",
                          isSelected ? "bg-primary text-primary-foreground shadow-sm font-semibold" : "hover:bg-muted text-foreground/80"
                        )}
                      >
                        {h.toString().padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              
              {/* Minutes */}
              <ScrollArea className="flex-1 bg-background rounded-md border border-border/40 shadow-inner">
                <div className="flex flex-col p-1 gap-1">
                  {Array.from({ length: 60 }).map((_, i) => {
                    if (i % 5 !== 0) return null; // Step by 5
                    const isSelected = date ? Math.floor(date.getMinutes() / 5) * 5 === i : (i === 0);
                    return (
                      <button 
                        key={i}
                        type="button"
                        onClick={() => handleTimeChange("minute", i)}
                        className={cn(
                          "py-1.5 text-xs rounded-sm transition-colors font-mono",
                          isSelected ? "bg-primary text-primary-foreground shadow-sm font-semibold" : "hover:bg-muted text-foreground/80"
                        )}
                      >
                        {i.toString().padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* AM/PM */}
              <div className="flex flex-col gap-1.5 w-10">
                {['AM', 'PM'].map((ampm) => {
                  const isPM = date ? date.getHours() >= 12 : false;
                  const isSelected = (ampm === 'PM') === isPM;
                  return (
                    <button
                      key={ampm}
                      type="button"
                      onClick={() => handleTimeChange("ampm", ampm)}
                      className={cn(
                        "flex-1 text-[10px] font-bold rounded-md transition-colors flex items-center justify-center border shadow-sm",
                        isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/40 hover:bg-muted text-foreground/70"
                      )}
                    >
                      {ampm}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
