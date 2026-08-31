/**
 * @file components/docs/docsIcons.ts
 * @description Maps the content layer's icon names to lucide components.
 *
 * This map is the whole reason `docsTypes.ts` can stay plain data: the
 * catalogue says `icon: "wrench"`, and only this module knows that means a
 * React component. Adding an icon is one line here plus one name in
 * `DocsIconName` — after which the compiler refuses any content that asks for
 * an icon this map does not have.
 */

import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  ClipboardList,
  Gauge,
  KeyRound,
  Layers,
  LifeBuoy,
  Package,
  Printer,
  Rocket,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { DocsIconName } from "./docsTypes";

export const DOCS_ICONS: Record<DocsIconName, LucideIcon> = {
  book: BookOpen,
  rocket: Rocket,
  shield: ShieldCheck,
  workflow: Workflow,
  clipboard: ClipboardList,
  search: Search,
  wrench: Wrench,
  package: Package,
  boxes: Boxes,
  chart: BarChart3,
  printer: Printer,
  users: Users,
  settings: Settings,
  sparkles: Sparkles,
  scan: ScanLine,
  phone: Smartphone,
  bell: Bell,
  key: KeyRound,
  layers: Layers,
  gauge: Gauge,
  "life-buoy": LifeBuoy,
};
