"use client";

import dynamic from "next/dynamic";
import { LoginForm } from "@/features/auth/components/auth-form";

const InteractiveParticles = dynamic(
  () => import("@/features/auth/components/interactive-particles"),
  { ssr: false }
);

export default function LoginPage() {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2 bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Left Pane: Visual/Atmosphere */}
      <div className="relative hidden flex-col lg:flex overflow-hidden border-r border-border/40 bg-[#09090f]">
        {/* Top Left Branding */}
        <div className="absolute top-8 left-8 z-20 flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground pointer-events-none">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
          <span>Meteorn Hub</span>
        </div>
        
        {/* Particle Effect Container */}
        <div className="flex h-full w-full items-center justify-center" style={{ background: '#09090f' }}>
          <InteractiveParticles
            src="/particle-image.png"
            allowUpload={false}
            background="#09090f"
            color="#ffffff"
          />
        </div>

        {/* Bottom Left Text */}
        <div className="absolute bottom-8 left-8 z-20 max-w-sm pointer-events-none">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] mb-3">
            About Meteorn Hub
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Your centralized platform to manage accounts, track quotas, and monitor income seamlessly. Built for efficiency.
          </p>
        </div>
      </div>

      {/* Right Pane: Form */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-12 relative">
        <LoginForm />
      </div>
    </div>
  );
}
