import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Khmer } from "next/font/google";
import AuthGuard from "@/components/AuthGuard";
import ThemeScript from "@/components/ThemeScript";
import MotionPreference from "@/components/MotionPreference";
import { ActionBusProvider } from "@/components/ActionBus";
import { AiAssistantProvider } from "@/components/ai/AiAssistantProvider";
import AiAssistantPanel from "@/components/ai/AiAssistantPanel";
import AiLauncher from "@/components/ai/AiLauncher";
import { LanguageProvider, LanguageScript } from "@/i18n/LanguageProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { CompanionScannerProvider } from "@/context/CompanionScannerContext";
import GlobalCompanionModal from "@/components/GlobalCompanionModal";
import PerformanceProvider from "@/components/PerformanceProvider";
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

/**
 * The Khmer UI face, self-hosted rather than fetched from Google.
 *
 * It was previously requested twice on every page load — a <link rel=stylesheet>
 * in the <head> below and an `@import url(...)` at the top of globals.css — and
 * both were render-blocking. next/font downloads the file at build time and
 * serves it from this origin, so a page load now makes no request to
 * fonts.googleapis.com or fonts.gstatic.com at all.
 *
 * `display: "swap"` keeps text visible while the face loads, matching the
 * `&display=swap` the old URL carried. The full 100..900 axis is preserved
 * because the UI relies on real bold cuts in dense tables.
 */
const notoSansKhmer = Noto_Sans_Khmer({
  variable: "--font-noto-khmer",
  subsets: ["khmer"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
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
      lang="en"
      // LanguageScript rewrites lang/data-lang here before hydration, so the
      // attributes legitimately differ from this server-rendered markup.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansKhmer.variable} h-full antialiased`}
    >
      <head>
        {/* No font <link> and no preconnects: every face is self-hosted by
            next/font, so there is nothing to connect to. The two preconnect
            hints that used to sit here pointed at fonts.googleapis.com and
            fonts.gstatic.com and are now dead weight — a preconnect to an
            origin the page never calls costs a DNS lookup and a TLS handshake
            for nothing. */}
        <LanguageScript />
        {/* Both run before first paint so the opening frame already has the
            right language and the right theme. */}
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)]" suppressHydrationWarning>
        <LanguageProvider>
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
                <AuthGuard>{children}</AuthGuard>
                <GlobalCompanionModal />
                <AiLauncher />
                <AiAssistantPanel />
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
