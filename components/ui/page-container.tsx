import React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  innerClassName?: string;
}

export function PageContainer({
  children,
  className,
  innerClassName,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-10 relative min-h-screen w-full",
        className
      )}
      {...props}
    >
      <div className={cn("mx-auto max-w-6xl w-full", innerClassName)}>
        {children}
      </div>
    </div>
  );
}
