"use client";

import React, { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  Package,
  Wrench,
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  FileSpreadsheet,
  ShieldAlert,
  Settings,
  Activity,
  Leaf,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useActionHandler } from "@/components/ActionBus";
import { NAV_GROUPS, HOME_ITEM, SETTINGS_ITEM } from "@/config/navigation";
import { ProgressBar } from "@/components/av";
import { useAnimatedNavigate } from "@/components/PageTransition";
import { cn } from "@/lib/utils";

/**
 * @file components/Sidebar.tsx
 * @description Left navigation, on the Aura Velvet system.
 *
 * The seven preset branches this file used to carry are gone. Every one of
 * them existed to answer "what colour is an active link in this theme"; there
 * is one theme now, so the answer is a token.
 *
 * The active treatment is a green left border plus a soft green tint. Both are
 * drawn with a pseudo-element and a background — never with a border that
 * appears on activation, which would widen the row by 3px and shove the label
 * sideways every time you navigate.
 */

const ICONS: Record<string, React.ElementType> = {
  "/daily-report": FileSpreadsheet,
  "/monthly-report": FileSpreadsheet,
  "/customer-report": FileSpreadsheet,
  "/engineer-report": FileSpreadsheet,
  "/repair-report": FileSpreadsheet,
  "/history-report": FileSpreadsheet,
  "/sparepart-usage": FileSpreadsheet,
  "/sparepart-hold": FileSpreadsheet,
  "/received-inventory": Package,
  "/spareparts": Wrench,
  "/customers": Users,
  "/receive-item": ClipboardList,
  "/inspect-item": Clock,
  "/inspection": FileText,
  "/approve-repair": CheckCircle,
  "/approve-verify": CheckCircle,
  "/spare-request": Wrench,
  "/confirmed-sale": CheckCircle,
  "/waiting-confirm": Clock,
  "/rejected": XCircle,
  "/unrepairable": ShieldAlert,
};

/**
 * The active row's two moving parts, ported from the reference app's sidebar.
 *
 * Both springs are its values verbatim: the tinted pill is the softer of the
 * two so it reads as the body of the movement, and the accent bar is stiffer
 * so it arrives a beat earlier and leads the eye to the new row.
 */
const NAV_PILL_SPRING = { type: "spring", stiffness: 450, damping: 32 } as const;
const NAV_ACCENT_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

/** One nav row. Shared by the dashboard link, the groups, and settings. */
const NavRow = memo(function NavRow({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  compact = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  compact?: boolean;
  onNavigate?: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        // Let the browser have the clicks that mean "not here": a modified or
        // non-primary click is a request for a new tab or window, and
        // swallowing it to run an animation in THIS tab would be taking away
        // something the user asked for.
        if (
          e.defaultPrevented ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        e.preventDefault();
        onNavigate?.(href);
      }}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 font-medium",
        compact ? "py-2 text-xs" : "py-2.5 text-sm",
        // Colour only — no border, no padding change, so the row never
        // reflows between states.
        "transition-colors duration-150 ease-out",
        active
          ? "text-accent-soft-fg"
          : "text-ink-secondary hover:text-ink hover:bg-cushion",
        collapsed && "justify-center px-0"
      )}
    >
      {/*
        The tinted pill and the green accent no longer belong to this row —
        they belong to whichever row is active, and they TRAVEL between rows.
        A shared `layoutId` is what does that: when the active row changes,
        framer finds the same id in its old and new positions within one commit
        and interpolates between the two rectangles, rather than fading one out
        and another in.

        They are rendered before the icon and label and carry no z-index. Two
        positioned siblings paint in DOM order, so the content lands on top on
        its own — a negative z-index would have pushed the pill behind the
        sidebar's own `bg-surface` and made it invisible.

        `bg-accent-soft` moved off the Link and onto the pill: leaving it on
        both would have shown a stationary tint under the travelling one.
      */}
      {active && (
        <motion.span
          aria-hidden
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-xl bg-accent-soft"
          transition={NAV_PILL_SPRING}
        />
      )}
      {active && (
        <motion.span
          aria-hidden
          layoutId="sidebar-accent-bar"
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent"
          transition={NAV_ACCENT_SPRING}
        />
      )}
      {/*
        `top-2 bottom-2` rather than the old `top-1/2` + `translateY(-50%)`:
        framer owns `transform` on a layout-animated element and would overwrite
        the centring translate mid-flight, dropping the bar to the row's top
        edge for the length of the animation. Insetting from both edges gets the
        same 60%-ish height with no transform to clash over.
      */}
      <Icon className={cn("relative shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
      {!collapsed && <span className="relative truncate">{label}</span>}
    </Link>
  );
});

/**
 * The bottom-pinned health widget.
 *
 * Shows measured state from `/api/health`, not a decorative number: the
 * percentage is the share of reported components that are up, and the tone
 * follows it. A widget that always reads "98%" teaches people to ignore it.
 */
const HealthWidget = memo(function HealthWidget({ collapsed }: { collapsed: boolean }) {
  const [health, setHealth] = useState<{ pct: number; label: string } | null>(null);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = await res.json();
        const comps = Object.values(data?.components ?? {}) as { status?: string }[];
        const up = comps.filter((c) => c?.status === "up").length;
        const pct = comps.length ? (up / comps.length) * 100 : data?.status === "healthy" ? 100 : 0;
        if (alive) setHealth({ pct, label: `${up}/${comps.length}` });
      } catch {
        if (alive) setHealth({ pct: 0, label: "—" });
      }
    }

    void check();

    /**
     * 60s, not a tight poll: this is a background reassurance widget, and one
     * request a minute per open tab is already the dominant cost of having it.
     *
     * Skipped entirely while the tab is hidden. This app is left open for a
     * whole shift, often behind other windows, and a widget nobody can see has
     * no reason to keep asking the server how it is — that was 480 requests
     * per idle tab per 8-hour shift, multiplied by every open tab in the
     * workshop. `useRealtimeTickets` and `SystemStatus` already gate their
     * polling on visibility; this one had been missed.
     *
     * A `visibilitychange` listener re-checks immediately on return, so coming
     * back to the tab shows current health rather than a value up to a minute
     * stale.
     */
    const tick = () => {
      if (document.visibilityState === "visible") void check();
    };
    const id = setInterval(tick, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const pct = health?.pct ?? 0;
  const tone = pct >= 100 ? "success" : pct > 0 ? "warning" : "danger";

  if (collapsed) {
    return (
      <div className="grid place-items-center py-2" title={`System health ${Math.round(pct)}%`}>
        <Activity
          className={cn(
            "w-5 h-5",
            tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger"
          )}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-cushion border border-subtle p-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="text-[11px] font-semibold text-ink">System Health</span>
        <span className="ml-auto text-[11px] font-semibold text-ink tabular-nums">
          {health ? `${Math.round(pct)}%` : "…"}
        </span>
      </div>
      <ProgressBar value={pct} tone={tone} />
      <div className="mt-1.5 text-[10px] text-ink-muted">
        {health ? `${health.label} services responding` : "Checking…"}
      </div>
    </div>
  );
});

export default function Sidebar({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const collapsed = !isOpen;
  const animatedNavigate = useAnimatedNavigate();

  /**
   * Where the user has asked to go, before the router has taken them there.
   *
   * The active row drives the travelling pill, and deriving "active" from
   * `pathname` alone means the pill cannot move until the route has actually
   * changed — which is now deliberately delayed by the outgoing page's exit
   * animation. Measured at 1440x900: the pill sat still for the whole ~230ms
   * exit and only set off once the new route rendered, so a click produced no
   * feedback in the menu for nearly a quarter of a second, and then the pill
   * and the incoming page moved at the same time and competed for attention.
   *
   * Holding the requested href optimistically restores the reference app's
   * ordering, where the menu is a state change and answers instantly: pill
   * leaves on the click, content follows it out, new content arrives.
   *
   * It expires on `pathname` moving rather than on a timer, so a navigation
   * that is cancelled or redirected settles back to the truth instead of
   * leaving the menu pointing somewhere the user never landed.
   *
   * The expiry is computed during render, from the path the click STARTED on,
   * rather than cleared in an effect on `pathname`. Both work; only this one
   * avoids a setState-in-effect, which is a cascading render and is exactly
   * the smell the four pre-existing `react-hooks/set-state-in-effect` errors
   * in this codebase are flagging. No reason to add a fifth.
   */
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const activeHref = pending && pending.from === pathname ? pending.href : pathname;

  useActionHandler("ui.sidebar.collapse", () => {
    setIsOpen(false);
    return true;
  });
  useActionHandler("ui.sidebar.expand", () => {
    setIsOpen(true);
    return true;
  });
  useActionHandler("ui.sidebar.toggle", () => {
    setIsOpen(!isOpen);
    return true;
  });

  /**
   * Below `lg`, start closed.
   *
   * The shell initialises `sidebarOpen` to `true`, which is right for a desk
   * but means a phone loads with a 256px drawer sitting on top of the content.
   * Deciding this during render would need `window`, which does not exist on
   * the server and would cause a hydration mismatch — so it is a one-shot
   * effect after mount instead. It only ever *closes*, so it cannot fight a
   * user who has since opened the drawer.
   */
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
    // Intentionally mount-only: this is an initial default, not a live binding.
    // Re-running it on resize would slam the drawer shut mid-interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * What a nav row does when it is followed.
   *
   * Two things, in this order:
   *
   * 1. **Below `lg`, dismiss the drawer.** On a phone the drawer is a
   *    full-width overlay with a scrim behind it, so navigating used to run
   *    the whole page transition underneath something opaque — the user tapped
   *    a menu item, the menu stayed put, and the animation they were meant to
   *    see happened out of sight. Closing first hands the stage back before
   *    anything animates on it. Guarded by the media query rather than always
   *    closing: on a desktop the sidebar is part of the layout, and collapsing
   *    it on every click would destroy a state the user deliberately set.
   *
   * 2. **Play the outgoing page out, then route.** See
   *    `useAnimatedNavigate` — the exit has to happen before the route change,
   *    because the route change is what destroys the element it animates.
   */
  const handleNavigate = useCallback(
    (href: string) => {
      if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
      setPending({ href, from: pathname });
      animatedNavigate(href);
    },
    [setIsOpen, animatedNavigate, pathname]
  );

  return (
    <>
      {/* Scrim. Mobile only — on desktop the sidebar is part of the layout
          rather than something covering it. Fades rather than slides so it
          never competes with the drawer's own motion. */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-0 z-30 bg-ink/40 lg:hidden",
          "transition-opacity duration-300 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen flex flex-col",
          "bg-surface border-r border-subtle",
          "transition-[width,transform] duration-300 ease-out",
          // ── Mobile / tablet: an off-canvas drawer.
          // Always full width; visibility is a transform, which costs no
          // layout and lets the page below it stay exactly where it is.
          "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // ── Desktop: part of the layout, collapsing to an icon rail.
          "lg:translate-x-0",
          isOpen ? "lg:w-64" : "lg:w-20",
          !isOpen && "lg:shadow-none shadow-soft-xl"
        )}
      >
      {/* Brand */}
      <div className="h-16 px-4 flex items-center shrink-0 border-b border-subtle">
        <Link href="/" className="flex items-center gap-3 overflow-hidden min-w-0">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-accent text-accent-fg shadow-soft-sm">
            <Leaf className="w-5 h-5" />
          </span>
          {isOpen && (
            <span className="flex flex-col min-w-0">
              <span className="font-semibold tracking-tight text-sm leading-none text-ink truncate">
                {t("app.brand")}
              </span>
              <span className="text-[10px] font-medium tracking-wider uppercase mt-1 text-accent truncate">
                {t("app.brandTagline")}
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <NavRow
          href="/"
          label={t(HOME_ITEM.nameKey)}
          icon={Home}
          active={activeHref === "/"}
          collapsed={collapsed}
          onNavigate={handleNavigate}
        />

        {NAV_GROUPS.map((group) => (
          <div key={group.titleKey} className="space-y-1">
            {isOpen && (
              <h3 className="px-3 text-[11px] font-semibold uppercase tracking-wider mb-2 text-ink-muted">
                {t(group.titleKey)}
              </h3>
            )}
            {group.items.map((item) => (
              <NavRow
                key={item.href}
                href={item.href}
                label={t(item.nameKey)}
                icon={ICONS[item.href] ?? FileText}
                active={activeHref === item.href}
                collapsed={collapsed}
                compact
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

        {/* Pinned footer: health, then settings. */}
        <div className="p-3 border-t border-subtle shrink-0 space-y-2">
          <HealthWidget collapsed={collapsed} />
          <NavRow
            href={SETTINGS_ITEM.href}
            label={t(SETTINGS_ITEM.nameKey)}
            icon={Settings}
            active={activeHref === "/settings"}
            collapsed={collapsed}
            compact
            onNavigate={handleNavigate}
          />
        </div>
      </aside>
    </>
  );
}
