"use client";

/**
 * @file app/settings/page.tsx
 * @description Appearance settings — the ergonomics of the interface.
 *
 * Every control writes through `useTheme().update`, which persists to
 * localStorage and stamps a `data-*` attribute on <html>. The page needs no
 * save button and no preview plumbing as a result — the preview panel is just
 * ordinary markup sitting under the same attributes as the rest of the app, so
 * it is showing the real thing rather than an imitation of it.
 *
 * ── What this page no longer offers ────────────────────────────────────────
 *
 * A seven-tile preset gallery, a four-way light/dark/system/auto mode picker
 * with a day/night hour schedule, and a six-swatch accent picker. Aura Velvet
 * is the design system now, and colour is not a user preference — so those
 * controls had nothing left to write to.
 *
 * What remains is deliberately the non-colour half: radius, density, font
 * scale and motion. Those are ergonomics, and they are the ones that were
 * doing real work — density fits more ticket rows on a 1366x768 workshop
 * panel, and motion quiets the animations for one app without touching an OS
 * setting.
 */

import React, { useSyncExternalStore } from "react";
import { RotateCcw, Type } from "lucide-react";
import PageWrapper from "@/components/PageWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { DENSITIES, FONT_SCALES, RADII } from "@/theme/themeConfig";
import type { TranslationKey } from "@/i18n/translations";


const RADIUS_LABEL = {
  sharp: "theme.radiusSharp",
  soft: "theme.radiusSoft",
  round: "theme.radiusRound"
} as const;

const DENSITY_LABEL = {
  comfortable: "theme.densityComfortable",
  compact: "theme.densityCompact"
} as const;

const FONT_SCALE_LABEL = {
  sm: "theme.fontScaleSm",
  md: "theme.fontScaleMd",
  lg: "theme.fontScaleLg"
} as const;

// ─── The OS "reduce motion" setting, as an external store ────────────────────

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/** A titled block with a hint line, used for each group of controls. */
function Section({
  titleKey,
  hintKey,
  children
}: {
  titleKey: TranslationKey;
  hintKey?: TranslationKey;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-subtle/80 bg-surface p-5 shadow-sm ">
      <h2 className="text-sm font-bold text-ink ">{t(titleKey)}</h2>
      {hintKey && (
        <p className="mt-0.5 text-xs text-ink-secondary ">{t(hintKey)}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Generic segmented picker — one row of mutually exclusive options. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelFor
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelFor: (option: T) => string;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex flex-wrap gap-1 rounded-xl bg-sunken p-1 "
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                active
                  ? "bg-surface text-ink shadow-sm "
                  : "text-ink-secondary hover:text-ink "
              }`}
          >
            {labelFor(option)}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { prefs, update, reset } = useTheme();

  /**
   * The OS motion preference, read as an external store rather than seeded into
   * state by a mount effect — same reasoning as `ThemeProvider` and
   * `LanguageProvider`: `matchMedia` does not exist on the server, the snapshot
   * is a primitive so React's `Object.is` check settles, and the server
   * snapshot keeps hydration honest.
   */
  const osReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );


  return (
    <PageWrapper titleKey="theme.pageTitle" subtitleKey="theme.pageSubtitle">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Controls ─────────────────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Section titleKey="theme.radiusSection" hintKey="theme.radiusHint">
                <Segmented
                  options={RADII}
                  value={prefs.radius}
                  onChange={(radius) => update({ radius })}
                  labelFor={(r) => t(RADIUS_LABEL[r])}
                />
              </Section>

              <Section titleKey="theme.densitySection" hintKey="theme.densityHint">
                <Segmented
                  options={DENSITIES}
                  value={prefs.density}
                  onChange={(density) => update({ density })}
                  labelFor={(d) => t(DENSITY_LABEL[d])}
                />
              </Section>

              <Section titleKey="theme.fontScaleSection" hintKey="theme.fontScaleHint">
                <Segmented
                  options={FONT_SCALES}
                  value={prefs.fontScale}
                  onChange={(fontScale) => update({ fontScale })}
                  labelFor={(f) => t(FONT_SCALE_LABEL[f])}
                />
              </Section>

              <Section titleKey="theme.motionSection" hintKey="theme.motionHint">
                <Segmented
                  options={["full", "reduced"] as const}
                  value={prefs.motion}
                  onChange={(motion) => update({ motion })}
                  labelFor={(m) => t(m === "full" ? "theme.motionFull" : "theme.motionReduced")}
                />
                {osReducedMotion && (
                  <p className="mt-2.5 text-[11px] text-ink-secondary ">
                    {t("theme.motionOsNote")}
                  </p>
                )}
              </Section>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-subtle/80 bg-surface p-4 ">
              <p className="text-[11px] text-ink-secondary ">
                {t("theme.deviceScopeNote")}
              </p>
              <button
                type="button"
                onClick={reset}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-subtle px-3.5 py-2 text-xs font-semibold text-ink-secondary transition-colors duration-150 hover:bg-cushion focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 "
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("theme.reset")}
              </button>
            </div>
          </div>

          {/* ── Live preview ─────────────────────────────────────────────
              Not a mock-up: these are the same utilities the real screens use,
              under the same <html> attributes, so what renders here is exactly
              what the rest of the app will look like. */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-0">
              <Section titleKey="theme.previewSection" hintKey="theme.previewHint">
                <div className="space-y-3">
                  <div className="rounded-xl border border-subtle p-4 ">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-xs font-bold text-ink ">
                          {t("theme.previewCardTitle")}
                        </h3>
                        <p className="mt-1 text-[11px] text-ink-secondary ">
                          {t("theme.previewCardBody")}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent-soft-fg">
                        {t("theme.previewBadge")}
                      </span>
                    </div>

                    <div className="mt-3.5 flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-fg transition-colors duration-150 hover:bg-accent-hover"
                      >
                        {t("theme.previewPrimary")}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-subtle px-3 py-1.5 text-[11px] font-semibold text-ink-secondary "
                      >
                        {t("theme.previewSecondary")}
                      </button>
                    </div>
                  </div>

                  {/* A real <table>, so the density setting visibly applies. */}
                  <div className="overflow-hidden rounded-xl border border-subtle ">
                    <table className="w-full text-left">
                      <thead className="bg-cushion ">
                        <tr>
                          {(
                            [
                              "theme.previewTableRef",
                              "theme.previewTableCustomer",
                              "theme.previewTableStatus",
                            ] as const
                          ).map((key) => (
                            <th
                              key={key}
                              className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted"
                            >
                              {t(key)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle ">
                        {[
                          ["SVC-1042", "Sokha Ltd", true],
                          ["SVC-1041", "Mekong Co", false],
                          ["SVC-1039", "Angkor Ice", false],
                        ].map(([ref, customer, hot]) => (
                          <tr key={ref as string}>
                            <td className="px-3 py-2 font-mono text-[11px] text-ink ">
                              {ref}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-ink-secondary ">
                              {customer}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  hot
                                    ? "bg-accent text-accent-fg"
                                    : "bg-sunken text-ink-secondary "
                                }`}
                              >
                                {t("theme.previewBadge")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-subtle px-3 py-2.5">
                    <Type className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="text-[11px] text-ink-secondary">
                      {t(RADIUS_LABEL[prefs.radius])} · {t(DENSITY_LABEL[prefs.density])} ·{" "}
                      {t(FONT_SCALE_LABEL[prefs.fontScale])}
                    </span>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
