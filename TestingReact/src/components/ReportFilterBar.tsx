"use client";

/**
 * @file ReportFilterBar.tsx
 * @description The filter toolbar shared by the report pages — the port of the
 * Blazor reports' filter panels (status multi-select, service type, location,
 * company search).
 *
 * Each page declares which filters it wants; the ones it does not name are not
 * rendered. That matters because an empty control is worse than a missing one:
 * a "Service Type" dropdown on a report that ignores service type invites
 * someone to set it, see nothing change, and stop trusting the filters.
 *
 * Filtering happens **server-side** — every value here maps to a parameter on
 * `/technicalservices/search`. Filtering a 2000-row client-side slice would
 * quietly lie whenever the period held more rows than one page.
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { SERVICE_LOCATIONS, SERVICE_STATUSES_DB } from "@/services/types";

/** Which controls a report wants. */
export type ReportFilterKind =
  | "search"
  | "status"
  | "serviceType"
  | "location"
  | "dateMode";

/**
 * Which date a stock movement is attributed to. The backend has always
 * supported both; only `standard` was ever reachable from the UI.
 *
 * - `standard` — the transaction ledger. Filters `SparepartStockAuditLog.
 *   Timestamp`, the moment the trigger fired and stock actually moved. This is
 *   the citable ledger: a report printed last week still reconciles today.
 * - `alwayscreated` — intake attribution. Reads `SparepartItems` joined to the
 *   ticket and filters on the ticket's own date, answering "what did the
 *   machines that arrived in this period end up consuming", regardless of when
 *   the movement posted.
 *
 * They answer different questions and neither is a fix for the other, which is
 * why this is a visible control rather than a default someone has to guess at.
 */
export type ReportDateMode = "standard" | "alwayscreated";

export interface ReportFilterValues {
  search: string;
  /** Empty means every status. */
  statuses: string[];
  /** Empty means every type. */
  serviceType: string;
  /** Empty means every location. */
  serviceLocation: string;
  /** Stock-movement date attribution. Defaults to the transaction ledger. */
  dateMode: ReportDateMode;
}

export const EMPTY_FILTERS: ReportFilterValues = {
  search: "",
  statuses: [],
  serviceType: "",
  serviceLocation: "",
  dateMode: "standard",
};

const controlClass =
  "flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-cushion ";

/** Status picker: a portaled checkbox list, so several statuses can be combined. */
function StatusPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLButtonElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: 260,
    estimatedHeight: 340,
    align: "start",
  });

  const toggle = (name: string) => {
    onChange(
      selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]
    );
  };

  const label =
    selected.length === 0
      ? t("report.allStatuses")
      : selected.length === 1
        ? translateStatus(selected[0], t)
        : t("report.statusesSelected", { count: String(selected.length) });

  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen((v) => !v)} className={controlClass}>
        <span className="max-w-44 truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className="z-[100] max-h-80 overflow-auto rounded-xl border border-subtle bg-surface p-1.5 shadow-xl "
          >
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-ink-secondary hover:bg-sunken "
              >
                <X className="h-3.5 w-3.5" />
                {t("report.clearStatuses")}
              </button>
            )}
            {SERVICE_STATUSES_DB.map((status) => {
              const isOn = selected.includes(status.name);
              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => toggle(status.name)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink hover:bg-sunken "
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isOn
                        ? "border-info bg-info text-white"
                        : "border-prominent "
                    }`}
                  >
                    {isOn && <Check className="h-3 w-3" />}
                  </span>
                  {/* Backend spelling stays in state; only the label is translated. */}
                  {translateStatus(status.name, t)}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

interface ReportFilterBarProps {
  show: ReportFilterKind[];
  value: ReportFilterValues;
  onChange: (next: ReportFilterValues) => void;
}

export default function ReportFilterBar({ show, value, onChange }: ReportFilterBarProps) {
  const { t } = useI18n();

  // Local so typing stays responsive; the debounced value is what triggers a
  // reload, so a five-letter company name is one request rather than five.
  const [searchText, setSearchText] = useState(value.search);
  const debouncedSearch = useDebouncedValue(searchText, 400);

  useEffect(() => {
    if (debouncedSearch !== value.search) onChange({ ...value, search: debouncedSearch });
    // `value`/`onChange` deliberately excluded: including them re-runs this on
    // every parent render and fights the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const selectClass =
    "rounded-lg border border-subtle bg-surface px-2 py-1.5 text-xs text-ink ";

  const hasAny =
    value.search ||
    value.statuses.length > 0 ||
    value.serviceType ||
    value.serviceLocation ||
    value.dateMode !== EMPTY_FILTERS.dateMode;

  return (
    <>
      {show.includes("search") && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("report.searchPlaceholder")}
            className="w-52 rounded-lg border border-subtle bg-surface py-1.5 pl-7 pr-2 text-xs text-ink "
          />
        </div>
      )}

      {show.includes("status") && (
        <StatusPicker
          selected={value.statuses}
          onChange={(statuses) => onChange({ ...value, statuses })}
        />
      )}

      {show.includes("serviceType") && (
        <select
          value={value.serviceType}
          onChange={(e) => onChange({ ...value, serviceType: e.target.value })}
          className={selectClass}
        >
          <option value="">{t("report.allTypes")}</option>
          <option value="Free">{t("value.free")}</option>
          <option value="Charge">{t("value.charge")}</option>
        </select>
      )}

      {show.includes("location") && (
        <select
          value={value.serviceLocation}
          onChange={(e) => onChange({ ...value, serviceLocation: e.target.value })}
          className={selectClass}
        >
          <option value="">{t("report.allLocations")}</option>
          {SERVICE_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {t(location === "OnSite" ? "value.onSite" : "value.companyService")}
            </option>
          ))}
        </select>
      )}

      {show.includes("dateMode") && (
        <select
          value={value.dateMode}
          onChange={(e) =>
            onChange({ ...value, dateMode: e.target.value as ReportDateMode })
          }
          className={selectClass}
          title={t("report.dateModeHint")}
        >
          <option value="standard">{t("report.dateModeLedger")}</option>
          <option value="alwayscreated">{t("report.dateModeIntake")}</option>
        </select>
      )}

      {hasAny && (
        <button
          type="button"
          onClick={() => {
            setSearchText("");
            onChange({ ...EMPTY_FILTERS });
          }}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-ink-secondary hover:bg-sunken "
        >
          <X className="h-3.5 w-3.5" />
          {t("report.clearFilters")}
        </button>
      )}
    </>
  );
}
