"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "lucide-react";
import Image from "next/image";
import { AnimatedModal } from "@/components/ui/animated-modal";

// Define the beforeinstallprompt event type
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
    }

    // Listen for PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Delay prompt slightly so it's not jarring on load
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // We do not clear deferredPrompt here, so if they trigger it manually later, it still works.
  };

  return (
    <AnimatedModal
      isOpen={showPrompt}
      onClose={handleDismiss}
      title="Install Meteorn Hub"
      icon={<DownloadIcon className="size-5" />}
      maxWidth="sm"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative size-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-4 ring-1 ring-border/50 shadow-inner">
          <Image 
            src="/particle-image.png" 
            alt="Meteorn Hub" 
            fill 
            className="object-contain p-2" 
          />
        </div>

        <div className="space-y-1.5">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Get the Native Experience
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Install our app for a faster, full-screen native experience. Access your dashboard instantly from your home screen.
          </p>
        </div>

        <button
          onClick={handleInstall}
          className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:ring-2 hover:ring-primary/50 hover:ring-offset-2 hover:ring-offset-background active:scale-[0.98]"
        >
          <DownloadIcon className="size-4 transition-transform group-hover:-translate-y-0.5" />
          Install App
          <div className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full" />
        </button>
      </div>
    </AnimatedModal>
  );
}
