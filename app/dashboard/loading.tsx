import React from "react";
import { WanderingEyes } from "@/components/loading-ui/wandering-eyes";

export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen items-center justify-center">
      <WanderingEyes className="h-20 w-[180px] [--eye-color:#f8fafc] [--pupil-color:#0f172a] [--duration:4s]" />
    </div>
  );
}
