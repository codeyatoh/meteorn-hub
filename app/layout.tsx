import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstaller } from "@/components/pwa-installer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meteorn Hub",
  description: "Meteorn Hub - Your professional dashboard",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.ts",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <style jsx global>{`
          [data-sonner-toaster] {
            top: 1rem !important;
            bottom: auto !important;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: calc(100vw - 2rem) !important;
            max-width: 420px !important;
          }

          @media (min-width: 640px) {
            [data-sonner-toaster] {
              top: auto !important;
              bottom: 1rem !important;
              left: auto !important;
              right: 1rem !important;
              transform: none !important;
              width: 356px !important;
            }
          }
        `}</style>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <PwaInstaller />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
