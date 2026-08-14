"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Command } from "cmdk"
import { cn } from "@/lib/utils"

export interface MultiSelectComboboxProps {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  renderValue?: (selectedValues: string[]) => React.ReactNode;
}

export function MultiSelectCombobox({
  options,
  values,
  onValuesChange,
  placeholder = "Select options...",
  emptyText = "No results found.",
  className,
  renderValue,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  const toggleOption = (value: string) => {
    const newValues = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value]
    onValuesChange(newValues)
  }

  const displayValue = renderValue 
    ? renderValue(values) 
    : values.length > 0 
      ? `${values.length} selected`
      : ""

  const showDisplayValue = !open && values.length > 0

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) setInputValue("")
    }}>
      <PopoverPrimitive.Trigger asChild>
        <div className={cn("relative w-full", className)}>
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="multi-select-options"
            value={showDisplayValue ? (typeof displayValue === 'string' ? displayValue : '') : inputValue}
            onChange={(e) => {
              if (showDisplayValue) return
              setInputValue(e.target.value)
              if (!open) setOpen(true)
            }}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            placeholder={showDisplayValue ? "" : placeholder}
            className="flex w-full items-center justify-between rounded-md border border-input bg-background pl-3 pr-10 py-2.5 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {showDisplayValue && typeof displayValue !== 'string' && (
             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none pr-8">
               {displayValue}
             </div>
          )}
          <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
        </div>
      </PopoverPrimitive.Trigger>
      
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()} // Don't steal focus from input
          className="z-[200] w-[var(--radix-popover-trigger-width)] min-w-[200px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <Command>
            <Command.List id="multi-select-options" className="max-h-[200px] overflow-y-auto overflow-x-hidden custom-scrollbar">
              <Command.Empty className="py-6 text-center text-sm">
                {emptyText}
              </Command.Empty>
              <Command.Group className="overflow-hidden p-1 text-foreground">
                {filteredOptions.map((option) => {
                  const isSelected = values.includes(option.value)
                  return (
                    <Command.Item
                      key={option.value}
                      value={option.label}
                      onSelect={() => toggleOption(option.value)}
                      onMouseDown={(e) => e.preventDefault()} // Prevent blur
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                      <CheckIcon
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.icon && <span className="mr-2">{option.icon}</span>}
                      {option.label}
                    </Command.Item>
                  )
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
