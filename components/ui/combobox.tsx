"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Command } from "cmdk"
import { cn } from "@/lib/utils"

export interface ComboboxProps {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  emptyText = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  // Sync input value with selected option when popover closes
  React.useEffect(() => {
    if (!open) {
      if (selectedOption) {
        setInputValue(selectedOption.label)
      } else {
        setInputValue("")
      }
    }
  }, [open, selectedOption])

  // Initialize input value
  React.useEffect(() => {
    if (selectedOption && !inputValue && !open) {
      setInputValue(selectedOption.label)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div className={cn("relative w-full", className)}>
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="combobox-options"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              if (!open) setOpen(true)
            }}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Small timeout to allow click on options to process before reverting text
              setTimeout(() => {
                if (selectedOption) {
                  setInputValue(selectedOption.label)
                } else {
                  setInputValue("")
                }
              }, 150)
            }}
            placeholder={placeholder}
            className="flex w-full items-center justify-between rounded-md border border-input bg-background pl-3 pr-10 py-2.5 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
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
            <Command.List id="combobox-options" className="max-h-[200px] overflow-y-auto overflow-x-hidden custom-scrollbar">
              <Command.Empty className="py-6 text-center text-sm">
                {emptyText}
              </Command.Empty>
              <Command.Group className="overflow-hidden p-1 text-foreground">
                {filteredOptions.map((option) => (
                  <Command.Item
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value)
                      setInputValue(option.label)
                      setOpen(false)
                    }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.icon && <span className="mr-2">{option.icon}</span>}
                    {option.label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
