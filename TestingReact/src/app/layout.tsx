import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Khmer, Battambang, Kantumruy_Pro } from "next/font/google";
import { Suspense } from "react";
import AuthGuard from "@/components/AuthGuard";
import MotionPreference from "@/components/MotionPreference";
import { ActionBusProvider } from "@/components/ActionBus";
import { AiAssistantProvider } from "@/components/ai/AiAssistantProvider";
import AiAssistantPanelHost from "@/components/ai/AiAssistantPanelHost";
import AiLauncher from "@/components/ai/AiLauncher";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { CompanionScannerProvider } from "@/context/CompanionScannerContext";
import GlobalCompanionModal from "@/components/GlobalCompanionModal";
import PerformanceProvider from "@/components/PerformanceProvider";
import TopNavigationProgressBar from "@/components/TopNavigationProgressBar";
import AppShell from "@/components/AppShell";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansKhmer = Noto_Sans_Khmer({
  variable: "--font-noto-khmer",
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const battambang = Battambang({
  variable: "--font-battambang",
  subsets: ["khmer"],
  weight: ["400", "700"],
  display: "swap",
});

const kantumruyPro = Kantumruy_Pro({
  variable: "--font-kantumruy",
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Service & Maintenance Portal",
  description: "Enterprise Service and Maintenance Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="km"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansKhmer.variable} ${battambang.variable} ${kantumruyPro.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CAM ID" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)]" suppressHydrationWarning>
        <LanguageProvider>
          <Suspense fallback={null}>
            <TopNavigationProgressBar />
          </Suspense>
          {/* Outside AuthGuard: the login screen is themed too, and the theme
              must survive the route change that logging in causes. */}
          <ThemeProvider>
          {/* Inside ThemeProvider because it reads the in-app motion switch,
              and above everything animated because framer's reduced-motion
              mode is delivered through context. The stylesheet's own
              reduced-motion rules cannot reach a framer animation — see
              components/MotionPreference.tsx. */}
          <MotionPreference>
          {/* Inside MotionPreference because `isLiteMode` folds in framer's
              resolved reduced-motion value, which is delivered through that
              context. Above AuthGuard so the one-time device check runs on the
              login screen too — it measures the machine, not the session, and
              a technician who never signs out would otherwise never be asked.
              It renders nothing until its idle callback fires. */}
          <PerformanceProvider>
          {/* Above AuthGuard so a requested action survives the page change it
              usually accompanies — the provider stays mounted while routes swap
              underneath it. */}
          <ActionBusProvider>
            {/* Inside the bus so the assistant can open dialogs; outside the
                pages so the conversation survives navigation. */}
            <AiAssistantProvider>
              <CompanionScannerProvider>
                <AuthGuard>
                  <AppShell>{children}</AppShell>
                </AuthGuard>
                <GlobalCompanionModal />
                <AiLauncher />
                <AiAssistantPanelHost />
              </CompanionScannerProvider>
            </AiAssistantProvider>
          </ActionBusProvider>
          </PerformanceProvider>
          </MotionPreference>
          </ThemeProvider>
          <Toaster position="top-right" />
        </LanguageProvider>
      </body>
    </html>
  );
}
