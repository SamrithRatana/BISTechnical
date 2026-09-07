/**
 * @file components/login/constants.ts
 * @description Static data the login stage renders from. Bilingual copy lives
 * here as `*En`/`*Km` pairs (the pattern this page has always used for
 * data-driven content); simple UI strings go through `t("login.*")` keys.
 * Micro-labels on the floating chips are sanctioned English-only telemetry
 * terms (see `download/ScanScreen.tsx`'s language note).
 */

import {
  BarChart3,
  Bot,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  Package,
  ScanFace,
  Server,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AuthMethod } from "./authMethodStore";

// ─── Sign-in pipeline (the 5-stage handshake overlay) ───────────────────────

export interface PipelineNode {
  id: number;
  titleEn: string;
  titleKm: string;
  descEn: string;
  descKm: string;
  icon: LucideIcon;
  port: string;
}

export const PIPELINE_NODES: readonly PipelineNode[] = [
  {
    id: 1,
    titleEn: "Client Gate",
    titleKm: "ច្រកសុវត្ថិភាពម៉ាស៊ីន",
    descEn: "Sanitizing payload & TLS link",
    descKm: "ផ្ទៀងផ្ទាត់ទិន្នន័យ & TLS Link",
    icon: UserCheck,
    port: "Client",
  },
  {
    id: 2,
    titleEn: "User Auth API",
    titleKm: "ប្រព័ន្ធ Auth API",
    descEn: "Identity check & minting JWT",
    descKm: "ផ្ទៀងផ្ទាត់ Identity & បង្កើត JWT",
    icon: ShieldCheck,
    port: "API",
  },
  {
    id: 3,
    titleEn: "Technical Core",
    titleKm: "ប្រព័ន្ធបច្ចេកទេសស្នូល",
    descEn: "Syncing tickets & telemetry",
    descKm: "ភ្ជាប់ SignalR Hub & គ្រឿងបន្លាស់",
    icon: Server,
    port: "API",
  },
  {
    id: 4,
    titleEn: "Gemini & Pollinations AI",
    titleKm: "បច្ចេកវិទ្យា AI ជំនួយការ",
    descEn: "Mounting smart diagnostics runtime",
    descKm: "ដំណើរការ Gemini & Visual AI Engine",
    icon: Bot,
    port: "AI Engine",
  },
  {
    id: 5,
    titleEn: "Enterprise Hub",
    titleKm: "ផ្ទាំងការងារ Dashboard",
    descEn: "Launching dashboard workspace...",
    descKm: "ជោគជ័យ! កំពុងបើកផ្ទាំងការងារ...",
    icon: LayoutDashboard,
    port: "Hub",
  },
];

// ─── Auth methods (the selector deck + active badge) ────────────────────────

export interface AuthMethodSpec {
  id: AuthMethod;
  titleEn: string;
  titleKm: string;
  descEn: string;
  descKm: string;
  icon: LucideIcon;
  accentColor: string;
  tag: string;
}

export const AUTH_METHODS: readonly AuthMethodSpec[] = [
  {
    id: "password",
    titleEn: "Password & PIN",
    titleKm: "ពាក្យសម្ងាត់ & PIN",
    descEn: "Standard secure sign-in with username, password, and session token.",
    descKm: "ចូលប្រើប្រាស់តាមរយៈឈ្មោះគណនី លេខសម្ងាត់ និងផ្ទៀងផ្ទាត់សុវត្ថិភាពស្តង់ដារ។",
    icon: KeyRound,
    accentColor: "#10b981",
    tag: "Standard",
  },
  {
    id: "phone",
    titleEn: "CAM ID Mobile Face & Auth",
    titleKm: "ទូរស័ព្ទ CAM ID Face & Auth",
    descEn: "Face Login, PIN verification, or camera QR scan from your mobile app.",
    descKm: "ផ្ញើសំណើ Face Login, PIN ឬស្កេន QR ផ្ទៀងផ្ទាត់មុខឆ្លាតវៃ។",
    icon: Smartphone,
    accentColor: "#06b6d4",
    tag: "Mobile 2FA",
  },
  {
    id: "passkey",
    titleEn: "Hardware Passkey",
    titleKm: "ជីវមាត្រ Passkey",
    descEn: "Biometric login via Apple iCloud Keychain (Face ID / Touch ID), Android, Windows Hello, or FIDO2.",
    descKm: "ស្កេនជីវមាត្រ Face ID / Touch ID (iOS iCloud Keychain), Android, Windows Hello ឬ Security Key។",
    icon: ScanFace,
    accentColor: "#14b8a6",
    tag: "Biometric",
  },
];

// ─── Showcase cards (the curtain's 3D cover-flow) ───────────────────────────

export interface ShowcaseCard {
  id: string;
  badgeEn: string;
  badgeKm: string;
  titleEn: string;
  titleKm: string;
  descEn: string;
  descKm: string;
  icon: LucideIcon;
  accentColor: string;
  tag: string;
  /** Short pill label (English-only telemetry micro-label). */
  pill: string;
}

export const SHOWCASE_CARDS: readonly ShowcaseCard[] = [
  {
    id: "gemini",
    badgeEn: "Visual AI",
    badgeKm: "AI ឆ្លាតវៃ",
    titleEn: "Gemini AI",
    titleKm: "Gemini AI",
    descEn: "Smart defect diagnostics & OCR scanning",
    descKm: "ស្កេនពិនិត្យបញ្ហា និងវិភាគកំហុសម៉ាស៊ីន",
    icon: Bot,
    accentColor: "#10b981",
    tag: "Vision",
    pill: "Gemini",
  },
  {
    id: "biometrics",
    badgeEn: "Biometrics",
    badgeKm: "ជីវមាត្រ",
    titleEn: "Passkeys",
    titleKm: "Passkeys",
    descEn: "Instant face scan & passwordless login",
    descKm: "ស្កេនផ្ទៃមុខ និង Passkey ឥតប្រើលេខសម្ងាត់",
    icon: Fingerprint,
    accentColor: "#06b6d4",
    tag: "FIDO2",
    pill: "Passkeys",
  },
  {
    id: "telemetry",
    badgeEn: "Telemetry",
    badgeKm: "ទិន្នន័យផ្ទាល់",
    titleEn: "Telemetry",
    titleKm: "Telemetry",
    descEn: "Live workshop tracking & status sync",
    descKm: "តាមដានការជួសជុល និងទិន្នន័យផ្ទាល់",
    icon: BarChart3,
    accentColor: "#14b8a6",
    tag: "Live KPIs",
    pill: "SignalR",
  },
  {
    id: "spareparts",
    badgeEn: "Inventory",
    badgeKm: "ស្តុកគ្រឿងបន្លាស់",
    titleEn: "Stock Sync",
    titleKm: "គ្រប់គ្រងស្តុក",
    descEn: "Instant inventory check & parts request",
    descKm: "ត្រួតពិនិត្យស្តុក និងស្នើសុំគ្រឿងបន្លាស់រហ័ស",
    icon: Package,
    accentColor: "#0ea5e9",
    tag: "Auto-Sync",
    pill: "Stock",
  },
];

// ─── Demo personas (1-click autofill on the password form) ──────────────────

export interface DemoPersona {
  id: string;
  label: string;
  titleAttr: string;
  icon: LucideIcon;
  user: string;
  pass: string;
  accentColor: string;
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    id: "admin",
    label: "Admin",
    titleAttr: "Sign in as System Administrator",
    icon: ShieldCheck,
    user: "admin",
    pass: "admin123",
    accentColor: "#10b981",
  },
  {
    id: "technician",
    label: "Technician",
    titleAttr: "Sign in as Technical Specialist",
    icon: Wrench,
    user: "admin",
    pass: "admin123",
    accentColor: "#14b8a6",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    titleAttr: "Sign in as Service Supervisor",
    icon: BarChart3,
    user: "admin",
    pass: "admin123",
    accentColor: "#06b6d4",
  },
];

// ─── Backdrop particles (deterministic — random positions would hydrate-mismatch) ──

export interface Particle {
  left: string;
  top: string;
  size: number;
  opacity: number;
  /** Parallax depth tier: 0 far, 1 mid, 2 near. Only tier 2 carries the ambient drift. */
  tier: 0 | 1 | 2;
}

export const PARTICLES: readonly Particle[] = [
  { left: "6%", top: "18%", size: 3, opacity: 0.35, tier: 2 },
  { left: "14%", top: "68%", size: 2, opacity: 0.28, tier: 0 },
  { left: "23%", top: "34%", size: 2, opacity: 0.22, tier: 1 },
  { left: "38%", top: "12%", size: 3, opacity: 0.3, tier: 2 },
  { left: "47%", top: "82%", size: 2, opacity: 0.24, tier: 0 },
  { left: "58%", top: "24%", size: 2, opacity: 0.2, tier: 1 },
  { left: "67%", top: "72%", size: 3, opacity: 0.32, tier: 2 },
  { left: "76%", top: "16%", size: 2, opacity: 0.26, tier: 0 },
  { left: "84%", top: "58%", size: 3, opacity: 0.34, tier: 2 },
  { left: "92%", top: "30%", size: 2, opacity: 0.24, tier: 1 },
];
