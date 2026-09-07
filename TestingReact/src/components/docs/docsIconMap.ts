/**
 * @file components/docs/docsIconMap.ts
 * @description Resolves the `icon` string on a catalogue entry to a lucide
 * component.
 *
 * The catalogue is plain data (see `content/articleTypes.ts`), so it names its
 * icons rather than importing them. This is the one place that mapping lives —
 * it used to be a private `iconMap` inside `DocsSidebarNav`, which meant the
 * sidebar was the only surface that could render an article's icon. The
 * outline rail and the chapter map need the same lookup.
 *
 * `docsIcon()` never throws on an unknown name: a typo in the catalogue should
 * cost the reader a generic glyph, not a blank page.
 */

import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle,
  Clock,
  Compass,
  Cpu,
  FileSpreadsheet,
  GitFork,
  Inbox,
  Layers,
  Package,
  PackageCheck,
  Palette,
  PieChart,
  Rocket,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle,
  Clock,
  Compass,
  Cpu,
  FileSpreadsheet,
  GitFork,
  Inbox,
  Layers,
  Package,
  PackageCheck,
  Palette,
  PieChart,
  Rocket,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
};

export function docsIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Layers;
}
