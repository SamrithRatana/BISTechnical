"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, PackageCheck, Hourglass, CheckCircle2 } from "lucide-react";
import { fetchDashboardStats } from "@/services/api";
import { useI18n } from "@/i18n/LanguageProvider";
import { KpiCard } from "@/components/av";
import {
  useTicketSeries,
  dailyCounts,
  halfOverHalfTrend,
  statusIs,
} from "@/hooks/useTicketSeries";
import type { RepairServiceItem } from "@/services/types";
import type { TranslationKey } from "@/i18n/translations";

/**
 * @file components/StatCards.tsx
 * @description The dashboard's four KPI tiles, on the Aura Velvet system.
 *
 * This file used to branch six ways on `prefs.preset` and again on `isDark` —
 * every card carried an `activeRing`, `bgLight`, `borderColor` and `accent`
 * string per theme, plus two entirely separate JSX trees. That went with the
 * old design system; each tile is now one `KpiCard` and the colour comes from
 * tokens.
 *
 * ── About the trend and sparkline ──────────────────────────────────────────
 *
 * The previous version rendered "+100%", "23.5% vs last month" and "-5% vs
 * last week" as fixed strings baked into the card definitions. They were never
 * computed from anything and never changed when the counts did.
 *
 * These are computed — from real ticket dates, over the last 7 days, via
 * `useTicketSeries`. Two honesty rules are enforced by that hook rather than
 * here: a trend is `undefined` (and simply not drawn) when the earlier half of
 * the window is empty, because a rise from zero has no percentage; and the
 * footer caption names the window explicitly, because the big number above is
 * an all-time count from `fetchDashboardStats` while the sparkline is recent
 * daily intake. Those are different quantities and the card must not let them
 * be read as the same one.
 */

const DAYS = 7;

interface StatDef {
  id: string;
  titleKey: TranslationKey;
  icon: React.ElementType;
  /** Which tickets this tile counts. */
  match: (item: RepairServiceItem) => boolean;
  /** Which date the ticket is bucketed on. */
  dateOf: (item: RepairServiceItem) => string | undefined | null;
  /** Whether more of this metric is a good thing. */
  trendIsGood: boolean;
}

/** Module scope: a fixed list, so it is not rebuilt on every render. */
const STAT_DEFS: readonly StatDef[] = [
  {
    id: "Today",
    titleKey: "dash.todayReport",
    icon: TrendingUp,
    match: () => true,
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Received",
    titleKey: "dash.receivedItem",
    icon: PackageCheck,
    // The DB has spelled this "Item Recieved" for years; match on the stem.
    match: (i) => statusIs(i, "reciev") || statusIs(i, "receiv"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Waiting",
    titleKey: "dash.waitingCustomer",
    icon: Hourglass,
    match: (i) => statusIs(i, "awaiting customer"),
    dateOf: (i) => i.serviceDate,
    // A growing queue of customers waiting on a decision is not good news.
    trendIsGood: false,
  },
  {
    id: "Finished",
    titleKey: "dash.finished",
    icon: CheckCircle2,
    match: (i) => statusIs(i, "finish"),
    // Bucketed on completion, not intake: the day a ticket arrived says
    // nothing about the day the work was actually finished.
    dateOf: (i) => i.finishedDate ?? i.serviceDate,
    trendIsGood: true,
  },
];

interface StatCardsProps {
  selectedFilter: string;
  setSelectedFilter: (id: string) => void;
}

export default function StatCards({ selectedFilter, setSelectedFilter }: StatCardsProps) {
  const { t } = useI18n();
  const { items } = useTicketSeries();

  const [counts, setCounts] = useState<Record<string, number>>({
    Today: 0,
    Received: 0,
    Waiting: 0,
    Finished: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadCounts() {
      try {
        const stats = await fetchDashboardStats();
        if (isMounted) {
          setCounts({
            Today: stats.todayCount,
            Received: stats.receivedCount,
            Waiting: stats.waitingCustomerCount,
            Finished: stats.finishedCount,
          });
        }
      } catch (err) {
        console.warn("Failed to load stat card counts:", err);
      }
    }
    void loadCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Derived once per ticket sample, not per card render.
  const series = useMemo(
    () =>
      Object.fromEntries(
        STAT_DEFS.map((s) => {
          const data = dailyCounts(items, DAYS, s.match, s.dateOf);
          return [s.id, { data, trend: halfOverHalfTrend(data) }];
        })
      ) as Record<string, { data: number[]; trend: number | undefined }>,
    [items]
  );

  // One stable callback per id rather than a fresh arrow per card per render,
  // which is what lets `KpiCard`'s `memo` actually hold.
  const handlers = useMemo(
    () =>
      Object.fromEntries(
        STAT_DEFS.map((s) => [s.id, () => setSelectedFilter(s.id)])
      ) as Record<string, () => void>,
    [setSelectedFilter]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {STAT_DEFS.map((stat, i) => {
        const Icon = stat.icon;
        const s = series[stat.id];
        const hasData = s && s.data.some((n) => n > 0);

        return (
          <div
            key={stat.id}
            style={{ "--enter-i": i } as React.CSSProperties}
            className="enter-up"
          >
            <KpiCard
              label={t(stat.titleKey)}
              value={counts[stat.id] ?? 0}
              icon={<Icon className="w-4 h-4" />}
              selected={selectedFilter === stat.id}
              onClick={handlers[stat.id]}
              trend={s?.trend}
              trendIsGood={stat.trendIsGood}
              trendCaption={hasData ? t("dash.last7Days") : undefined}
              sparkline={hasData ? s.data : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
