"use client";

import React, { useState, useEffect } from "react";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import {
  RepairServiceItem,
  SparePartItemDetail,
  CustomerItem,
  ItemModel,
  SERVICE_STATUSES_DB,
  SERVICE_LOCATIONS,
  fetchCustomerCenter,
  fetchItemsInventory,
  fetchServiceById,
  fetchSparePartById,
  createItem,
  deleteTechnicalService,
  updateSparepartItemRemarks,
  invalidateCachePrefix
} from "@/services/api";
import { toast } from "react-hot-toast";
import { RemarkIndicator } from "@/components/RemarkIndicator";
import {
  calculateDaysTaken,
  toBackendLocalDateTime,
  formatTime24HourWithAmPm,
  SERVICE_PRIORITIES,
  getServicePriorityId,
  normaliseServicePriority
} from "@/services/types";
import { fetchUserMap, resolveUserNameSync, getCurrentUserGuid, getCurrentUserFullName } from "@/services/userService";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import type { ActionValues } from "./ActionBus";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import { firstValidationMessage } from "@/i18n/validationMessage";
import { validateTicket } from "@/validation";
import { sendTelegramNotification, saveServiceTelegramMessage } from "@/services/telegramService";
import { buildTelegramMessage } from "@/services/telegramMessageBuilder";
import { dispatchTelegramNotificationSafe } from "@/services/api";
import { clearListCache } from "@/hooks/useInfiniteList";
import type { TranslationKey } from "@/i18n/translations";
import {
  translatePriority,
  translateServiceLocation,
  translateServiceType,
  translateStatus
} from "@/i18n/statusLabel";
import {
  X,
  Wrench,
  Save,
  CheckCircle2,
  Building2,
  User,
  Calendar,
  Package,
  Edit3,
  Eye,
  Trash2
} from "lucide-react";
import ModernSelect from "./ModernSelect";
import MediaLightbox from "./MediaLightbox";
import { getImageUrl } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ModalProps {
  item: RepairServiceItem | null;
  onClose: () => void;
  /** default "view" — read-only audit trail; "edit" — form submission */
  mode?: "view" | "edit";
  onSave?: (updatedItem: RepairServiceItem) => void;
  /**
   * Field values to type into the edit form on open — the assistant filling it
   * in on the user's behalf. Strictly prefill: the form still has to be
   * submitted by hand, and an item typed in this way still needs picking from
   * the dropdown before it will save, because only that yields a real itemId.
   */
  prefill?: ActionValues;
  /** Custom z-index when opened from nested modals (e.g. AllTicketsSearchModal) */
  zIndex?: number;
}

/**
 * Turns the assistant's string values into the ticket's own field types.
 * Unknown keys are already filtered out upstream by `sanitizeActionValues`;
 * what is left is a per-field parse, skipping anything that doesn't convert so
 * a bad value leaves the form's current one alone rather than blanking it.
 */
function ticketPrefillPatch(values: ActionValues): Partial<RepairServiceItem> {
  const patch: Partial<RepairServiceItem> = {};
  const text = (key: "companyName" | "contactName" | "phoneNumber" | "address" | "itemName" | "serialNumber" | "customerRequest") => {
    const value = values[key];
    if (typeof value === "string" && value.trim()) patch[key] = value.trim();
  };
  text("companyName");
  text("contactName");
  text("phoneNumber");
  text("address");
  text("itemName");
  text("serialNumber");
  text("customerRequest");

  if (values.servicePriority) patch.servicePriority = normaliseServicePriority(values.servicePriority);

  if (values.serviceLocation) {
    const onSite = /site|customer|ក្រៅ/i.test(values.serviceLocation);
    patch.serviceLocation = onSite ? "OnSite" : "CompanyService";
  }

  if (values.serviceDate) {
    const parsed = new Date(values.serviceDate);
    if (!Number.isNaN(parsed.getTime())) patch.serviceDate = toBackendLocalDateTime(parsed);
  }

  const bool = (raw?: string) => (raw === undefined ? undefined : /^(true|yes|1|y)$/i.test(raw.trim()));
  const contract = bool(values.hasContract);
  if (contract !== undefined) patch.hasContract = contract;
  const thirdParty = bool(values.isThirdPartyRepair);
  if (thirdParty !== undefined) patch.isThirdPartyRepair = thirdParty;

  return patch;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null, referenceDate?: string | null): string | null {
  if (!d) return null;
  try {
    let date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;

    // If milestone timestamp was written in UTC without timezone marker (e.g. 07:29 when intake was 14:21),
    // adjust +7 hours to match Cambodia local wall-clock time
    const isUnmarkedIso = !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(d.trim());
    if (isUnmarkedIso && referenceDate && d !== referenceDate) {
      const refDt = new Date(referenceDate);
      if (!Number.isNaN(refDt.getTime())) {
        const diffMs = refDt.getTime() - date.getTime();
        if (diffMs > 2 * 3600 * 1000 && diffMs < 9 * 3600 * 1000) {
          date = new Date(date.getTime() + 7 * 3600 * 1000);
        }
      }
    }

    const datePart = date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return `${datePart} ${formatTime24HourWithAmPm(date)}`;
  } catch {
    return d;
  }
}

/** True when a datetime string carries an explicit zone (`Z` or `±HH:MM`). */
function hasExplicitZone(s: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(s);
}

/**
 * Normalizes a datetime for sending to backend: converts any Z-marked or zoned ISO string
 * to local Phnom Penh wall-clock (YYYY-MM-DDTHH:MM:SS) so SQL Server never stores a UTC instant as local time.
 */
function normalizeServiceDate(val?: string | null): string {
  if (!val) return toBackendLocalDateTime();
  const s = val.trim();
  if (hasExplicitZone(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return toBackendLocalDateTime(d);
    }
  }
  return s;
}

/**
 * Converts a stored datetime into the wall-clock value an
 * <input type="datetime-local"> expects.
 *
 * The API stores and returns local Phnom Penh time with no zone marker, so
 * those digits are used as-is — shifting them would put this field out of
 * step with the ticket tables, which parse the same strings as local time.
 * Older rows written as UTC (with a `Z`) are still converted, so both
 * conventions display correctly.
 */
function toLocalDatetimeValue(value?: string | null): string {
  if (!value) return "";
  const s = value.trim();
  if (!hasExplicitZone(s)) return s.slice(0, 16);

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

/**
 * Inverse of toLocalDatetimeValue: hand the wall-clock digits back unshifted,
 * matching how the backend stores time. Converting to UTC here is what made a
 * ticket saved at 10:44 come back as 03:44.
 */
function fromLocalDatetimeValue(local: string): string {
  if (!local) return "";
  return local.length === 16 ? `${local}:00` : local;
}

function isRealName(name?: string | null) {
  return name && name !== "Unknown" && name !== "Unknown User" && name !== "Loading...";
}

function getStatusBadgeClass(status: string) {
  const s = status?.toUpperCase();
  if (s === "FINISHED") return "bg-success-soft text-success-fg ";
  if (s?.includes("AWAITING CUSTOMER")) return "bg-warning-soft text-warning-fg ";
  if (s?.includes("AWAITING SPAREPART") || s?.includes("SENT SPAREPARTS")) return "bg-info-soft text-info-fg ";
  if (s?.includes("THIRD-PARTY") || s?.includes("THIRD PARTY")) return "bg-accent-soft text-accent ";
  if (s?.includes("REJECTED")) return "bg-danger-soft text-danger-fg ";
  if (s?.includes("UNREPAIRABLE")) return "bg-warning-soft text-warning-fg ";
  if (s?.includes("REPAIRING")) return "bg-info-soft text-info-fg ";
  return "bg-sunken text-ink ";
}

// Returns a translation key rather than a finished label: this is a plain
// function, not a component, so it can't call useI18n() itself — the caller
// already has `t` in scope and resolves it at the point of render.
function resolveStockBadge(
  serviceStatus: string,
  condition?: string,
  stockQty = 0
): { labelKey: TranslationKey; bg: string; fg: string } {
  // Tokens rather than the old Bootstrap hexes (#28a745 / #6f42c1 / #dc3545),
  // so these badges follow the design system instead of sitting a shade off it.
  // The meanings are unchanged: dispatched/in-stock reads as success, "no stock
  // deduction" as an informational state, out-of-stock as danger.
  if (serviceStatus === "Sent Spareparts")
    return { labelKey: "stockBadge.allDispatched", bg: "var(--av-success)", fg: "#fff" };
  if (condition === "Fix")
    return { labelKey: "stockBadge.noStockDeduction", bg: "var(--av-info)", fg: "#fff" };
  if (stockQty <= 0)
    return { labelKey: "stockBadge.outOfStock", bg: "var(--av-danger)", fg: "#fff" };
  return { labelKey: "stockBadge.inStock", bg: "var(--av-success)", fg: "#fff" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** A single timeline row: label + date + optional "by [user]" */
function TimelineRow({
  label,
  date,
  byName,
  byGuid
}: {
  label: string;
  date?: string | null;
  byName?: string | null;
  byGuid?: string | null;
}) {
  const formatted = fmtDate(date);
  if (!formatted) return null;

  const resolvedName = (byName && isRealName(byName))
    ? byName.trim()
    : resolveUserNameSync(byGuid || "");

  return (
    <tr className="border-b border-subtle ">
      <td className="py-2 px-3 text-xs font-semibold text-ink-secondary whitespace-nowrap w-48">
        {label}
      </td>
      <td className="py-2 px-3 text-xs text-ink ">
        {formatted}
        {isRealName(resolvedName) && (
          <span className="ml-2 text-ink-muted font-medium">
            | {resolvedName}
          </span>
        )}
      </td>
    </tr>
  );
}

/** A section header row spanning both columns */
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <tr>
      <td
        colSpan={2}
        className="py-2 px-3 text-xs font-bold text-ink bg-cushion border-t border-b border-subtle "
      >
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </td>
    </tr>
  );
}

/** Simple label + value row */
function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <tr className="border-b border-subtle ">
      <td className="py-2 px-3 text-xs font-semibold text-ink-secondary whitespace-nowrap w-48">
        {label}
      </td>
      <td className="py-2 px-3 text-xs text-ink ">{value}</td>
    </tr>
  );
}

function getPriorityBadgeClass(priority?: string | null): string {
  const p = (priority || "").toUpperCase();
  if (p === "HIGH" || p === "URGENT") return "bg-danger-soft text-danger border-danger/30";
  if (p === "LOW") return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-subtle";
  return "bg-info-soft text-info border-info/30";
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW MODE — Modern Aura Velvet Card & Grid Layout
// ─────────────────────────────────────────────────────────────────────────────
function ViewContent({ item }: { item: RepairServiceItem }) {
  const { t } = useI18n();
  const [previewPart, setPreviewPart] = useState<SparePartItemDetail | null>(null);
  const [partsList, setPartsList] = useState<SparePartItemDetail[]>(() => item.sparePartItems ?? item.sparepartItems ?? []);

  useEffect(() => {
    setPartsList(item.sparePartItems ?? item.sparepartItems ?? []);
  }, [item]);

  const totalQty = partsList.reduce((s, p) => s + p.quantity, 0);
  const grandTotal = partsList.reduce(
    (s, p) => s + (p.defaultPrice ?? 0) * p.quantity,
    0
  );
  const days = item.daysTaken ?? calculateDaysTaken(item);

  const timelineMilestones = [
    { label: t("detail.tlReceived"), date: item.serviceDate, byName: item.createdByName, byGuid: item.createBy || item.userId },
    { label: t("detail.tlInspection"), date: item.inspectDate, byName: item.inspectByName, byGuid: item.inspectBy || item.inspectingBy },
    { label: t("detail.tlAwaitingSpare"), date: item.awaitingSparepartDate, byName: item.setAwaitingSparepartByName, byGuid: item.setAwaitingSparepartBy },
    { label: t("detail.tlAwaitCustomer"), date: item.awaitingCustomerConfirmDate, byName: item.setAwaitingCustomerConfirmByName, byGuid: item.setAwaitingCustomerConfirmBy },
    { label: t("detail.tlSaleConfirmed"), date: item.saleConfirmedDate, byName: item.setSaleConfirmedByName, byGuid: item.setSaleConfirmedBy },
    { label: t("detail.tlSentSpareparts"), date: item.sentSparepartsDate, byName: item.setSentSparepartsByName, byGuid: item.setSentSparepartsBy },
    { label: t("detail.tlApproveRepair"), date: item.repairDate, byName: item.repairByName, byGuid: item.repairBy },
    { label: t("detail.tlThirdParty"), date: item.thirdPartyRepairDate, byName: item.thirdPartyRepairByName, byGuid: item.thirdPartyRepairBy },
    { label: t("detail.tlFinished"), date: item.finishedDate, byName: item.verifiedByName || item.repairByName, byGuid: item.verifiedBy || item.repairBy },
    { label: t("detail.tlRejected"), date: item.customerRejectedDate, byName: item.setCustomerRejectedByName, byGuid: item.setCustomerRejectedBy },
    { label: t("detail.tlUnrepairable"), date: item.unrepairableDate, byName: item.setUnrepairableByName, byGuid: item.setUnrepairableBy },
  ].filter(m => !!m.date);

  return (
    <div className="overflow-y-auto flex-1 p-4 sm:p-5 lg:p-5 xl:p-6 space-y-4">
      {/* ── Top Summary Header Strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-cushion border border-subtle">
        <div className="flex items-center gap-2.5 flex-wrap text-sm">
          {days != null && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface border border-subtle text-ink text-xs sm:text-sm shadow-2xs">
              <span className="font-semibold text-ink-secondary">រយៈពេល:</span>
              <span className="font-bold text-ink">
                {days === 1 ? t("detail.day", { count: days }) : t("detail.days", { count: days })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface border border-subtle shadow-2xs text-xs sm:text-sm">
            <span className="font-semibold text-ink-secondary">ជួសជុលមានកុងត្រា:</span>
            <span className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
              item.hasContract
                ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-bold"
                : "bg-zinc-500/15 text-zinc-500 border border-zinc-500/30"
            }`}>
              {item.hasContract ? "Yes" : "No"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {item.servicePriority && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-surface border border-subtle shadow-2xs">
              <span className="text-xs font-bold text-ink-secondary">
                {t("detail.customerPriorityLabel")}
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getPriorityBadgeClass(item.servicePriority)}`}>
                {translatePriority(item.servicePriority, t)}
              </span>
            </div>
          )}
          {item.status && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-surface border border-subtle shadow-2xs">
              <span className="text-xs font-bold text-ink-secondary">
                {t("detail.repairStatusLabel")}
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${getStatusBadgeClass(item.status)}`}>
                {translateStatus(item.status, t)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Workflow Audit Timeline ── */}
      {timelineMilestones.length > 0 && (
        <div className="p-4 rounded-2xl bg-surface border border-subtle space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-ink text-sm pb-2 border-b border-subtle">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Workflow Timeline &amp; Activity</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {timelineMilestones.map((m, idx) => {
              const formattedDate = fmtDate(m.date, item.serviceDate);
              const resolvedName = (m.byName && isRealName(m.byName))
                ? m.byName.trim()
                : resolveUserNameSync(m.byGuid || "");
              return (
                <div key={idx} className="p-3 rounded-xl bg-cushion/70 border border-subtle flex items-start justify-between gap-2.5">
                  <div>
                    <span className="font-bold text-ink block text-xs sm:text-[13px]">{m.label}</span>
                    <span className="text-xs font-bold text-ink-secondary mt-0.5 block">{formattedDate}</span>
                  </div>
                  {isRealName(resolvedName) && (
                    <span className="text-xs font-bold text-ink bg-surface px-2.5 py-1 rounded-lg border border-subtle shadow-2xs shrink-0 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-accent inline shrink-0" />
                      {resolvedName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2-Column Main Info Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Information Card */}
        <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-subtle text-sm font-bold text-ink">
            <Building2 className="w-4 h-4 text-accent" />
            <span>{t("detail.customerInfo")}</span>
          </div>
          <div className="space-y-2.5 text-xs sm:text-sm">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.companyName")}</span>
              <p className="font-bold text-ink mt-0.5 text-sm sm:text-[14.5px]">{item.companyName || "—"}</p>
            </div>
            {item.address && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.address")}</span>
                <p className="text-ink-secondary mt-0.5 leading-relaxed text-xs sm:text-[13px]">{item.address}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-subtle/60">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.contactName")}</span>
                <p className="font-semibold text-ink mt-0.5 truncate text-xs sm:text-sm">{item.contactName || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.phoneNumber")}</span>
                <p className="font-mono font-bold text-ink mt-0.5 text-xs sm:text-sm">{item.phoneNumber || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Machine & Service Info Card */}
        <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-subtle text-sm font-bold text-ink">
            <Package className="w-4 h-4 text-accent" />
            <span>{t("detail.machineInfo")}</span>
          </div>
          <div className="space-y-2.5 text-xs sm:text-sm">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.itemName")}</span>
              <p className="font-bold text-ink mt-0.5 text-sm sm:text-[14.5px]">{item.itemName || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.serialNumber")}</span>
              <p className="font-mono text-ink mt-0.5 font-bold bg-sunken px-2.5 py-1 rounded-lg border border-subtle inline-block text-xs sm:text-[13px]">{item.serialNumber || "—"}</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-subtle/60">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.serviceLocation")}</span>
                <p className="font-semibold text-ink mt-0.5 text-xs sm:text-sm">{translateServiceLocation(item.serviceLocation, t)}</p>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">{t("field.serviceType")}</span>
                <p className="font-semibold text-ink mt-0.5 text-xs sm:text-sm">{translateServiceType(item.serviceType, t)}</p>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">ជួសជុលមានកុងត្រា</span>
                <span className={`inline-block font-bold mt-0.5 px-2 py-0.5 rounded text-xs ${
                  item.hasContract
                    ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-bold"
                    : "bg-zinc-500/15 text-zinc-500 border border-zinc-500/30"
                }`}>
                  {item.hasContract ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Problem & Diagnostic Notes ── */}
      {(item.customerRequest || item.inspection || item.solution) && (
        <div className="p-4 rounded-2xl bg-cushion/90 border border-subtle space-y-2.5 text-xs sm:text-sm shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-ink text-sm pb-2 border-b border-subtle">
            <Wrench className="w-4 h-4 text-accent" />
            <span>{t("field.customerRequest")} &amp; {t("field.solution")}</span>
          </div>
          {item.customerRequest && (
            <div>
              <span className="text-xs font-bold uppercase text-ink-muted block">{t("field.customerRequest")}:</span>
              <p className="text-ink mt-0.5 text-xs sm:text-sm leading-relaxed">{item.customerRequest}</p>
            </div>
          )}
          {item.inspection && (
            <div>
              <span className="text-xs font-bold uppercase text-ink-muted block">{t("field.inspection")}:</span>
              <p className="text-ink mt-0.5 text-xs sm:text-sm leading-relaxed">{item.inspection}</p>
            </div>
          )}
          {item.solution && (
            <div>
              <span className="text-xs font-bold uppercase text-ink-muted block">{t("field.solution")}:</span>
              <p className="text-success font-bold mt-0.5 text-xs sm:text-sm leading-relaxed">{item.solution}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Spare Parts Table (Modern Smart Table Layout) ── */}
      {partsList.length > 0 && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Wrench className="w-4 h-4 text-accent" />
              <span>{t("detail.sparePartDetails")}</span>
            </h3>
            <span className="text-xs font-bold text-accent bg-accent-soft px-3 py-1 rounded-full border border-accent/20">
              {t("detail.totalPartsSummary", { items: partsList.length, units: totalQty })}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-cushion/90 text-ink-secondary text-xs font-bold uppercase tracking-wider border-b border-subtle">
                    <th className="px-3.5 py-3 text-center w-16">{t("inspect.colImage")}</th>
                    <th className="px-4 py-3 text-left">{t("detail.colPartAndModel")}</th>
                    <th className="px-3.5 py-3 text-center w-20">{t("inspect.colQty")}</th>
                    <th className="px-3.5 py-3 text-center w-32">{t("field.condition")}</th>
                    <th className="px-3.5 py-3 text-right w-28">{t("field.price")}</th>
                    <th className="px-3.5 py-3 text-center w-40">{t("detail.colStockStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle/60">
                  {partsList.map((sp) => {
                    const badge = resolveStockBadge(
                      item.status,
                      sp.condition,
                      sp.stockQuantity
                    );
                    const cond = sp.condition?.toLowerCase();

                    return (
                      <tr key={sp.id} className="hover:bg-cushion/40 transition-colors">
                        {/* 1. Image Thumbnail with preview */}
                        <td className="px-3.5 py-2.5 text-center align-middle">
                          {sp.pictureUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPart(sp)}
                              className="group relative w-11 h-11 rounded-xl overflow-hidden border border-subtle bg-sunken mx-auto block cursor-pointer transition-transform hover:scale-105 shadow-2xs"
                              title="Click to view full image & stock details"
                            >
                              <img
                                src={getImageUrl(sp.pictureUrl)}
                                alt={sp.itemName || "part"}
                                width={44}
                                height={44}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:opacity-90 bg-white"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-4 h-4 text-white drop-shadow" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-sunken border border-subtle flex items-center justify-center mx-auto text-ink-muted">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* 2. Part Name & Model (grouped together) */}
                        <td className="px-4 py-2.5 align-middle">
                          <div className="font-bold text-ink text-sm leading-snug">
                            {sp.itemName || "—"}
                          </div>
                          {sp.useFor && (
                            <div className="text-xs text-ink-muted leading-tight mt-0.5">
                              {sp.useFor}
                            </div>
                          )}
                        </td>

                        {/* 3. Quantity */}
                        <td className="px-3.5 py-2.5 text-center align-middle">
                          <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-lg bg-cushion border border-subtle font-bold text-ink text-xs sm:text-sm shadow-2xs">
                            × {sp.quantity}
                          </span>
                        </td>

                        {/* 4. Condition Badge */}
                        <td className="px-3.5 py-2.5 text-center align-middle">
                          {cond === "replace" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              {sp.condition}
                            </span>
                          ) : cond === "fix" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              {sp.condition}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-sunken text-ink-secondary">
                              {sp.condition || "—"}
                            </span>
                          )}
                        </td>

                        {/* 5. Price */}
                        <td className="px-3.5 py-2.5 text-right align-middle font-mono font-bold text-sm text-success whitespace-nowrap">
                          {sp.defaultPrice != null ? `$${sp.defaultPrice.toFixed(2)}` : <span className="text-ink-muted font-normal">—</span>}
                        </td>

                        {/* 6. Stock Status & Remark */}
                        <td className="px-3.5 py-2.5 text-center align-middle">
                          <div className="inline-flex items-center gap-1.5 justify-center relative">
                            <div className="relative group/stock inline-block">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-2xs cursor-pointer select-none transition-transform hover:scale-105"
                                style={{ background: badge.bg, color: badge.fg }}
                                title={`ចំនួនស្តុកដែលនៅសល់៖ ${sp.stockQuantity ?? 0} គ្រឿង`}
                              >
                                {badge.labelKey === "stockBadge.allDispatched" && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                {badge.labelKey === "stockBadge.noStockDeduction" && <Wrench className="w-3.5 h-3.5 shrink-0" />}
                                {t(badge.labelKey)}
                              </span>

                              {/* Tooltip on Mouse Hover */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-xl bg-slate-900/95 text-white text-xs font-medium whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover/stock:opacity-100 transition-opacity z-50 flex items-center gap-1.5 border border-white/10">
                                <Package className="w-3.5 h-3.5 text-accent" />
                                <span>ស្តុកនៅសល់៖ <strong className="font-mono text-amber-300 font-bold">{sp.stockQuantity ?? 0}</strong> គ្រឿង</span>
                              </div>
                            </div>

                            {/* 💬 Remark Indicator */}
                            <RemarkIndicator
                              sparePartId={sp.id || sp.sparePartId}
                              remarks={sp.remarks}
                              remarksUpdatedAt={sp.remarksUpdatedAt}
                              allowEdit={true}
                              onSave={async (newVal) => {
                                const targetId = sp.id || sp.sparePartId;
                                if (targetId) {
                                  const ok = await updateSparepartItemRemarks(targetId, newVal);
                                  if (ok) {
                                    const updatedParts = partsList.map((p) =>
                                      (p.id === sp.id || p.sparePartId === sp.sparePartId)
                                        ? {
                                            ...p,
                                            remarks: newVal,
                                            remarksUpdatedAt: new Date().toISOString()
                                          }
                                        : p
                                    );
                                    setPartsList(updatedParts);
                                    toast.success("បានកត់សម្គាល់ជោគជ័យ", { position: "bottom-right" });

                                    // 🚀 Update Telegram message in-place with updated remarks!
                                    if (item.id) {
                                      void dispatchTelegramNotificationSafe(
                                        {
                                          ...item,
                                          sparePartItems: updatedParts,
                                          sparepartItems: updatedParts,
                                        },
                                        item.status,
                                        undefined,
                                        true // forceEdit in-place
                                      );
                                    }
                                  } else {
                                    toast.error("មិនអាចកត់សម្គាល់បានទេ", { position: "bottom-right" });
                                  }
                                }
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Summary Footer Strip */}
            <div className="bg-cushion/90 px-4 py-3 border-t border-subtle flex items-center justify-between flex-wrap gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-semibold text-ink-secondary">
                <Package className="w-4 h-4 text-accent" />
                <span>{t("detail.totalPartsSummary", { items: partsList.length, units: totalQty })}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">{t("detail.total")}</span>
                <span className="font-mono font-bold text-sm text-success bg-surface px-3.5 py-1.5 rounded-xl border border-subtle shadow-2xs">
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Lightbox Modal with Full Stock & Status Details ── */}
      {previewPart && (
        <MediaLightbox
          open={Boolean(previewPart)}
          onClose={() => setPreviewPart(null)}
          title={previewPart.itemName || t("detail.sparePartDetails")}
          subtitle={previewPart.useFor || undefined}
          part={previewPart}
        >
          <img
            src={getImageUrl(previewPart.pictureUrl)}
            alt={previewPart.itemName || "part"}
            className="max-h-[70vh] max-w-full object-contain rounded-2xl mx-auto shadow-2xl bg-white"
          />
        </MediaLightbox>
      )}
    </div>
  );
}

function HighlightMatchText({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim() || !text) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-highlight text-highlight-fg font-bold px-0.5 rounded"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT MODE — matches RepairServiceDetailDialog.razor (English labels + form)
// ─────────────────────────────────────────────────────────────────────────────
function EditContent({
  formData,
  setFormData,
  isSaving,
  saveSuccess,
  submitError,
  onClose,
  handleSubmit
}: {
  formData: RepairServiceItem;
  setFormData: (d: RepairServiceItem) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  submitError: string | null;
  onClose: () => void;
  handleSubmit: (e: React.FormEvent) => void;
}) {
  const { t } = useI18n();
  const inputCls =
    "w-full px-3.5 py-2.5 text-xs border border-subtle rounded-xl bg-surface text-ink placeholder-ink-muted focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-colors duration-150";
  const labelCls = "text-xs font-semibold text-ink-secondary";
  const disabledInputCls =
    "w-full px-3.5 py-2.5 text-xs border border-subtle rounded-xl bg-sunken/60 text-ink/75 cursor-not-allowed select-none outline-none";

  // ── Company Autocomplete state ──
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState("");

  // ── Item Autocomplete state ──
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  const companyTerm = companySearchQuery.trim();
  const {
    items: companies,
    totalCount: totalCompanies,
    isLoadingMore: companiesLoadingMore,
    reachedEnd: companiesReachedEnd,
    limitReached: companiesLimitReached,
    scrollRootRef: companyScrollRootRef,
    sentinelRef: companySentinelRef
  } = useInfiniteList<CustomerItem, HTMLDivElement, HTMLDivElement>({
    fetchPage: (pageNumber, size) => fetchCustomerCenter(pageNumber, size, companyTerm),
    pageSize: 50,
    resetKey: companyTerm,
    getId: (c) => c.id,
    disabled: companyTerm.length < 1
  });

  const itemTerm = itemSearchQuery.trim();
  const {
    items: itemModels,
    totalCount: totalItems,
    isLoadingMore: itemsLoadingMore,
    reachedEnd: itemsReachedEnd,
    limitReached: itemsLimitReached,
    scrollRootRef: itemScrollRootRef,
    sentinelRef: itemSentinelRef
  } = useInfiniteList<ItemModel, HTMLDivElement, HTMLDivElement>({
    fetchPage: (pageNumber, size) => fetchItemsInventory(pageNumber, size, itemTerm),
    pageSize: 20,
    resetKey: itemTerm,
    getId: (m) => m.id,
    disabled: itemTerm.length < 1
  });

  const handleCompanySearch = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    const matched = companies.find((c: CustomerItem) => c.companyName.trim().toLowerCase() === trimmed);
    setFormData({
      ...formData,
      companyName: val,
      customerId: matched ? matched.id : (val.trim() === (formData.companyName || "").trim() ? formData.customerId : undefined),
      ...(!val.trim() ? { contactName: "", phoneNumber: "", address: "" } : {})
    });
    setCompanySearchQuery(val);
    setShowCompanyDropdown(val.trim().length >= 1);
  };

  const handleSelectCompany = (comp: CustomerItem) => {
    const rawContact = comp.contactName ?? "";
    const cleanContact = (rawContact && rawContact !== "—") ? rawContact.trim() : "";
    const rawPhone = comp.phoneNumber ?? "";
    const cleanPhone = (rawPhone && rawPhone !== "—") ? rawPhone.trim() : "";
    const rawAddress = comp.address ?? "";
    const cleanAddress = (rawAddress && rawAddress !== "—") ? rawAddress.trim() : "";

    setFormData({
      ...formData,
      customerId: comp.id,
      companyName: comp.companyName,
      phoneNumber: cleanPhone,
      contactName: cleanContact,
      address: cleanAddress
    });
    setShowCompanyDropdown(false);
  };

  // Editing item text after a selection invalidates the previously
  // resolved itemId — clearing it here stops a stale id (pointing at the
  // item the user *used to* have selected) from silently riding along to
  // submit once the visible text no longer matches it.
  const handleItemSearch = (val: string, field: "itemName" | "serialNumber" = "itemName") => {
    setFormData({
      ...formData,
      [field]: val,
      itemId: undefined,
      ...(field === "itemName" && !val.trim() ? { serialNumber: "" } : {})
    });
    setItemSearchQuery(val);
    setShowItemDropdown(val.trim().length >= 1);
  };

  const handleSelectItem = (item: ItemModel) => {
    setFormData({
      ...formData,
      itemId: item.id,
      itemName: item.itemName ?? "",
      serialNumber: item.serialNumber ?? ""
    });
    setShowItemDropdown(false);
  };

  // Registers a brand-new item/model type (e.g. a machine never received
  // before) and selects it — mirrors ReceiveItemList.razor's "Create New
  // Item Type" dialog, which exists precisely because the autocomplete list
  // only covers items already in the system.
  const handleCreateNewItem = async () => {
    const name = (formData.itemName || itemSearchQuery).trim();
    if (!name) return;
    setIsCreatingItem(true);
    try {
      const created = await createItem(name, formData.serialNumber);
      if (created && created.id) {
        handleSelectItem(created);
      }
    } finally {
      setIsCreatingItem(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      // Enter in a single-line input implicitly submits its form. Company
      // Name, Item / Model Name and Serial Number are all search fields with
      // their own result dropdowns, so pressing Enter to "search" instead
      // saved the ticket and closed the modal — while a dropdown was open and
      // the user hadn't picked a row yet. Saving is deliberate here: the Save
      // button below. Textareas keep Enter as a newline, and Enter on the
      // focused Save button still fires its click.
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {saveSuccess && (
          <div className="p-3 bg-success-soft text-success-fg border border-success rounded-xl text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            Ticket updated successfully!
          </div>
        )}
        {submitError && (
          <div className="p-3 bg-danger-soft text-danger-fg border border-danger rounded-xl text-xs flex items-center gap-2 font-medium">
            <X className="w-4 h-4 shrink-0" />
            {submitError}
          </div>
        )}

        {/* ── Top Options: Contract & External Repair (ដូចគំរូ Modal system UI ចាស់) ── */}
        <div className="flex flex-wrap items-center gap-5 p-3 rounded-xl bg-cushion/80 border border-subtle">
          <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!formData.hasContract}
              onChange={(e) => setFormData({ ...formData, hasContract: e.target.checked })}
              className="w-4 h-4 rounded text-accent focus:ring-accent/40 border-subtle cursor-pointer"
            />
            <span>{t("field.serviceWithContract")}</span>
          </label>
          <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!formData.isThirdPartyRepair}
              onChange={(e) => setFormData({ ...formData, isThirdPartyRepair: e.target.checked })}
              className="w-4 h-4 rounded text-accent focus:ring-accent/40 border-subtle cursor-pointer"
            />
            <span>{t("detail.thirdPartyRepair")}</span>
          </label>
        </div>

      {/* Service Date — kept at the top: it is the ticket's anchor date and
          the field most often corrected on arrival. */}
      <div>
        <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {t("detail.serviceDate")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={labelCls}>{t("detail.serviceDateTime")} *</label>
            <input
              type="datetime-local"
              value={toLocalDatetimeValue(formData.serviceDate)}
              onChange={(e) => setFormData({ ...formData, serviceDate: fromLocalDatetimeValue(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div>
        <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> {t("detail.customerInfo")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 relative">
            <label className={labelCls}>{t("field.companyName")} *</label>
            <input
              type="text"
              value={formData.companyName || ""}
              required
              onChange={(e) => handleCompanySearch(e.target.value)}
              onFocus={() => {
                if ((formData.companyName || "").trim().length >= 1) {
                  setCompanySearchQuery(formData.companyName || "");
                  setShowCompanyDropdown(true);
                }
              }}
              className={inputCls}
              placeholder={t("detail.typeCompany")}
            />
            {showCompanyDropdown && companies.length > 0 && (
              <div
                ref={companyScrollRootRef}
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-subtle rounded-xl shadow-xl max-h-60 overflow-y-auto overscroll-contain text-xs"
              >
                <div className="sticky top-0 bg-cushion px-3 py-2 border-b border-subtle flex items-center justify-between font-semibold text-ink-secondary ">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-info" />
                    {t("detail.foundCompanies", { count: totalCompanies })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCompanyDropdown(false)}
                    className="text-danger font-bold hover:bg-danger-soft p-0.5 rounded text-sm"
                  >
                    ×
                  </button>
                </div>
                {companies.map((comp) => (
                  <div
                    key={comp.id}
                    onClick={() => handleSelectCompany(comp)}
                    className="px-3 py-2 border-b border-subtle hover:bg-accent-soft cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-ink ">
                      <HighlightMatchText text={comp.companyName} query={formData.companyName || ""} />
                    </div>
                    {(comp.address !== "—" || comp.phoneNumber !== "—") && (
                      <div className="text-[11px] text-ink-muted truncate">
                        {[
                          comp.contactName !== "—" ? comp.contactName : null,
                          comp.phoneNumber !== "—" ? comp.phoneNumber : null,
                          comp.address !== "—" ? comp.address : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={companySentinelRef} className="px-3 py-2 text-center">
                  <InfiniteScrollStatus
                    isLoadingMore={companiesLoadingMore}
                    reachedEnd={companiesReachedEnd}
                    limitReached={companiesLimitReached}
                    count={companies.length}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className={labelCls}>{t("field.contactName")}</label>
            <input
              type="text"
              value={formData.contactName || ""}
              readOnly
              disabled
              tabIndex={-1}
              className={disabledInputCls}
              placeholder={t("field.contactName")}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>{t("field.phoneNumber")}</label>
            <input
              type="text"
              value={formData.phoneNumber || ""}
              readOnly
              disabled
              tabIndex={-1}
              className={disabledInputCls}
              placeholder="e.g. 012 345 678"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={labelCls}>{t("field.address")}</label>
            <textarea
              rows={2}
              value={formData.address || ""}
              readOnly
              disabled
              tabIndex={-1}
              className={`${disabledInputCls} resize-none`}
              placeholder={t("field.address")}
            />
          </div>
        </div>
      </div>

      {/* Machine Info */}
      <div>
        <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> {t("detail.machineInfo")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1 md:col-span-2 relative">
            <label className={labelCls}>{t("detail.itemModelName")} *</label>
            <input
              type="text"
              value={formData.itemName || ""}
              required
              onChange={(e) => handleItemSearch(e.target.value, "itemName")}
              onFocus={() => {
                if ((formData.itemName || "").trim().length >= 1) {
                  handleItemSearch(formData.itemName, "itemName");
                }
              }}
              className={inputCls}
              placeholder={t("detail.typeItemModel")}
            />
            {showItemDropdown && itemModels.length > 0 && (
              <div
                ref={itemScrollRootRef}
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-subtle rounded-xl shadow-xl max-h-60 overflow-y-auto overscroll-contain text-xs"
              >
                <div className="sticky top-0 bg-cushion px-3 py-2 border-b border-subtle flex items-center justify-between font-semibold text-ink-secondary ">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-success" />
                    {t("detail.foundItems", { count: totalItems })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowItemDropdown(false)}
                    className="text-danger font-bold hover:bg-danger-soft p-0.5 rounded text-sm"
                  >
                    ×
                  </button>
                </div>
                {itemModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => handleSelectItem(model)}
                    className="px-3 py-2 border-b border-subtle hover:bg-success-soft cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-ink ">
                      <HighlightMatchText
                        text={`${model.itemName} | ${model.serialNumber}`}
                        query={formData.itemName || formData.serialNumber || ""}
                      />
                    </div>
                  </div>
                ))}
                <div ref={itemSentinelRef} className="px-3 py-2 text-center">
                  <InfiniteScrollStatus
                    isLoadingMore={itemsLoadingMore}
                    reachedEnd={itemsReachedEnd}
                    limitReached={itemsLimitReached}
                    count={itemModels.length}
                  />
                </div>
              </div>
            )}
            {showItemDropdown && itemModels.length === 0 && (formData.itemName || "").trim().length >= 1 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-warning rounded-xl shadow-xl text-xs p-3 space-y-2">
                <p className="text-warning-fg ">
                  {t("detail.noItemMatches", { name: formData.itemName ?? "" })}
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewItem}
                  disabled={isCreatingItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-success rounded-lg hover:bg-success transition-colors disabled:opacity-60"
                >
                  {isCreatingItem
                    ? t("detail.creating")
                    : t("detail.createNewItem", { name: formData.itemName ?? "" })}
                </button>
              </div>
            )}
            {formData.itemId && (
              <p className="text-[11px] text-success flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {t("detail.linkedToItem")}
              </p>
            )}
          </div>
          <div className="space-y-1 relative">
            <label className={labelCls}>{t("field.serialNumber")} *</label>
            <input
              type="text"
              value={formData.serialNumber || ""}
              readOnly
              disabled
              tabIndex={-1}
              className={`${disabledInputCls} font-mono`}
              placeholder={t("field.serialNumber")}
            />
          </div>
        </div>
        {/* Inspection, Solution and Service Type are intentionally absent:
            they belong to the inspect dialog on the Inspect Item page, which
            owns that step of the workflow. The save below still resends the
            ticket's stored values unchanged, because UpdateRepairService
            overwrites those columns with whatever it receives. */}
        <div className="grid grid-cols-1 gap-3 mt-3">
          <div className="space-y-1">
            <label className={labelCls}>{t("detail.customerRequestIssue")} *</label>
            <textarea
              rows={2}
              value={formData.customerRequest || ""}
              required
              onChange={(e) => setFormData({ ...formData, customerRequest: e.target.value })}
              className={inputCls}
              placeholder={t("detail.issueReported")}
            />
          </div>
        </div>
      </div>

      {/* Service / Status */}
      <div>
        <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" /> {t("detail.serviceStatus")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={labelCls}>{t("field.priority")}</label>
            {/* Values must be the backend's own spelling ("Normal", not
                "NORMAL") — the API returns title case, and an option list in
                a different casing never matches, leaving the ticket's real
                priority invisible and silently reset on save. */}
            <ModernSelect
              value={normaliseServicePriority(formData.servicePriority)}
              onChange={(v) => setFormData({ ...formData, servicePriority: v })}
              options={SERVICE_PRIORITIES.map((p) => ({
                value: p.name,
                label: translatePriority(p.name, t)
              }))}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>{t("field.serviceLocation")}</label>
            <ModernSelect
              value={formData.serviceLocation || "CompanyService"}
              onChange={(v) => setFormData({ ...formData, serviceLocation: v })}
              options={SERVICE_LOCATIONS.map((loc) => ({
                value: loc,
                label: translateServiceLocation(loc, t)
              }))}
            />
          </div>
        </div>
      </div>
      </div>

      {/* Actions (Sticky footer) */}
      <div className="sticky bottom-0 z-20 px-6 py-3.5 flex items-center justify-end gap-3 shrink-0 bg-cushion backdrop-blur border-t border-subtle">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-xs font-semibold rounded-xl transition-colors duration-150 shadow-soft-sm text-ink bg-surface border border-subtle hover:bg-cushion">
          {t("action.cancel")}
        </button>
        <button type="submit" disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl shadow-soft-md transition-colors duration-150 disabled:opacity-60 text-accent-fg bg-accent hover:bg-accent-hover">
          <Save className="w-3.5 h-3.5" />
          {isSaving ? t("action.saving") : t("detail.saveChanges")}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export default function ServiceDetailModal({ item, onClose, mode = "view", onSave, prefill, zIndex }: ModalProps) {
  const later = useSafeTimeout();
  const isReceivedStage =
    !item ||
    item.id.startsWith("new-") ||
    (item.status || "").toLowerCase().includes("reciev") ||
    (item.status || "").toLowerCase().includes("receiv");

  const [currentMode, setCurrentMode] = useState<"view" | "edit">(
    isReceivedStage ? mode : "view"
  );
  const [formData, setFormData] = useState<RepairServiceItem>(
    () => ({ ...(item ?? {}) }) as RepairServiceItem
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [fullItem, setFullItem] = useState<RepairServiceItem | null>(null);
  const [, setForceUpdate] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    if (!isReceivedStage && !item?.id.startsWith("new-")) {
      setCurrentMode("view");
    } else {
      setCurrentMode(mode);
    }
  }, [mode, item, isReceivedStage]);

  useEffect(() => {
    if (item) {
      fetchUserMap().then(() => setForceUpdate((n) => n + 1)).catch(() => {});
    }
  }, [item]);

  // Load the authoritative record for this ticket, exactly as the Blazor
  // edit dialog does (GetRepairServiceByIdAsync). The table row this modal
  // is opened from comes from the paged search endpoint, which is a
  // different projection — inspection/solution/serviceType/spare parts read
  // blank from it, and saving those blanks back is what silently wiped them.
  // The API's Service DTO has no ItemId, so resolve it by serial afterwards
  // (the Blazor dialog's ResolveItemId does the same).
  const itemId = item?.id;
  useEffect(() => {
    if (!itemId || itemId.startsWith("new-")) return;
    let cancelled = false;
    (async () => {
      const full = await fetchServiceById(itemId);
      if (cancelled || !full) return;

      let resolvedItemId = full.itemId;
      if (!resolvedItemId) {
        const serial = (full.serialNumber || "").trim();
        if (serial) {
          try {
            const res = await fetchItemsInventory(1, 5, serial);
            resolvedItemId =
              res.items.find((i) => i.serialNumber?.toLowerCase() === serial.toLowerCase())?.id ??
              res.items[0]?.id;
          } catch {
            // Leave unset — the user can still pick the item from the dropdown.
          }
        }
      }

      // GetServiceAsync's SparepartItems only carries
      // Id/SparepartId/Description/Quantity/Condition/Remarks — ItemName,
      // UseFor, PictureUrl and stock Quantity live on the separate
      // Spareparts catalog table and must be looked up per id (mirrors
      // InspectItemDialog's LoadSelectedSparePartsOnly-style enrichment).
      // Without this, the view dialog's spare-parts table renders rows with
      // a real quantity/condition but a blank name, image and price.
      const rawParts = (full.sparePartItems ?? full.sparepartItems ?? []) as unknown as Array<
        Record<string, unknown>
      >;
      // The raw row is spread through rather than rebuilt field by field:
      // saving this ticket resends these lines verbatim, so fields this view
      // never displays (isHoldStatus, description) must survive the round
      // trip or the save would silently blank them.
      const enrichedParts: SparePartItemDetail[] = rawParts.length
        ? await Promise.all(
            rawParts.map(async (p) => {
              const sparePartId = (p.sparePartId ?? p.sparepartId) as string | undefined;
              const catalog = sparePartId ? await fetchSparePartById(sparePartId, true) : null;
              return {
                ...p,
                id: (p.id as string) ?? "",
                sparePartId: sparePartId ?? "",
                quantity: (p.quantity as number) ?? 0,
                itemName: catalog?.itemName || (p.description as string) || "",
                useFor: catalog?.useFor ?? "",
                pictureUrl: catalog?.pictureUrl ?? "",
                defaultPrice: catalog?.defaultPrice ?? 0,
                stockQuantity: catalog?.quantity ?? 0
              } as SparePartItemDetail;
            })
          )
        : [];

      if (cancelled) return;

      const merged = { ...full, itemId: resolvedItemId ?? full.itemId, sparePartItems: enrichedParts };
      setFullItem(merged);
      setFormData((prev) => ({ ...prev, ...merged }));
    })();
    return () => { cancelled = true; };
  }, [itemId]);

  // Applied after `fullItem` lands, not on mount: the fetch above replaces
  // formData wholesale with the authoritative record, so a prefill written
  // first would be silently overwritten by whatever was already stored.
  // Re-running on `fullItem` puts the user's instruction back on top.
  useEffect(() => {
    if (!prefill) return;
    queueMicrotask(() => {
      setFormData((prev) => ({ ...prev, ...ticketPrefillPatch(prefill) }));
    });
  }, [prefill, fullItem]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // The backend links a ticket to a real Item row via a foreign key —
    // there is no valid "unknown item" value to send. Typing free text
    // without selecting (or creating) a matching item leaves itemId unset;
    // block here with a clear message instead of silently sending a
    // fabricated/placeholder id that would fail server-side or mislink the
    // ticket to the wrong device.
    //
    // That check, and the ones the CamID intake form has always run beside it,
    // now come from `@/validation` — the folder mirrored into the phone — so a
    // ticket this screen accepts is one the phone would accept too. The desktop
    // was previously checking only `itemId`, and would happily save a ticket
    // with no company name, no serial number and an unusable phone number.
    const check = validateTicket({
      companyName: formData.companyName,
      contactName: formData.contactName,
      phoneNumber: formData.phoneNumber,
      address: formData.address,
      itemName: formData.itemName,
      serialNumber: formData.serialNumber,
      itemId: formData.itemId,
      customerRequest: formData.customerRequest,
      mode: formData.id.startsWith("new-") ? "create" : "edit",
    });
    if (!check.isValid) {
      // `selectItemFirst` keeps this screen's own long-standing wording, but
      // only when it is the FIRST failure — special-casing it unconditionally
      // hid a missing serial number behind "select an item first".
      const firstField = Object.keys(check.codes)[0];
      setSubmitError(
        firstField === "itemId" ? t("detail.selectItemFirst") : firstValidationMessage(check, t)
      );
      return;
    }

    setIsSaving(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("jwt_token") : null;
      const userGuid = getCurrentUserGuid();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const isNew = formData.id.startsWith("new-");

      // Resolve the priority through the backend's own table. The previous
      // mapping here was inverted against the C# ServicePriority enumeration
      // (Low = 1, Normal = 2, High = 3), so saving "High" filed the ticket as
      // Normal and "Low" filed it as High.
      const priorityId =
        getServicePriorityId(formData.servicePriority) ??
        (typeof formData.servicePriorityId === "number" && formData.servicePriorityId > 0
          ? formData.servicePriorityId
          : 2); // Normal

      // Map ServiceLocation string to C# Enum ("CompanyService" | "OnSite")
      const loc = (formData.serviceLocation || "").toLowerCase();
      const locationEnum = loc.includes("onsite") || loc.includes("on-site")
        ? "OnSite"
        : "CompanyService";

      // The ticket's spare parts must be round-tripped back on every save:
      // both endpoints below treat the list they receive as the complete set
      // and delete anything missing from it. This form has no spare-parts UI,
      // so it always resends what the ticket already has, unchanged. The API
      // returns these under either casing, hence the double lookup.
      const rawParts = (formData.sparePartItems ?? formData.sparepartItems ?? []) as unknown as Array<
        Record<string, unknown>
      >;
      const spareparts = rawParts
        .map((p) => ({
          sparepartId: (p.sparePartId ?? p.sparepartId) as string | undefined,
          description: (p.description ?? p.itemName ?? p.useFor ?? "") as string,
          quantity: (p.quantity ?? 1) as number,
          condition: ((p.condition as string) || "Replace"),
          isHoldStatus: Boolean(p.isHoldStatus)
        }))
        .filter((p) => Boolean(p.sparepartId));

      // Ensure customerId is resolved if user selected or typed an existing company
      let resolvedCustomerId = formData.customerId;
      if ((!resolvedCustomerId || resolvedCustomerId === "00000000-0000-0000-0000-000000000000") && formData.companyName?.trim()) {
        const companyNameTrimmed = formData.companyName.trim().toLowerCase();
        try {
          const lookup = await fetchCustomerCenter(1, 20, formData.companyName.trim());
          const found = (lookup.items || []).find(
            (c: CustomerItem) => c.companyName.trim().toLowerCase() === companyNameTrimmed
          );
          if (found) resolvedCustomerId = found.id;
        } catch {
          // graceful fallback
        }
      }

      if (isNew) {
        // A brand-new ticket only has receive-item info — nothing inspected
        // or repaired yet — so this narrower DTO is the right one here.
        const payload: Record<string, unknown> = {
          customerId: resolvedCustomerId || "00000000-0000-0000-0000-000000000000",
          companyName: formData.companyName || "N/A",
          address: formData.address || "",
          contactName: formData.contactName || "",
          phoneNumber: formData.phoneNumber || "",
          hasContract: Boolean(formData.hasContract),
          isThirdPartyRepair: Boolean(formData.isThirdPartyRepair),
          serviceDate: normalizeServiceDate(formData.serviceDate),
          reportNo: null,
          serviceLocation: locationEnum,
          servicePriorityId: priorityId,
          itemId: formData.itemId,
          customerRequest:
            formData.customerRequest?.trim() || formData.inspection?.trim() || "Receive Item Service Request"
        };
        if (userGuid) payload.createBy = userGuid;

        const res = await fetch("/api/proxy/receiveitem", {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`Save failed (${res.status}):`, errText);
          setSubmitError(
            t("detail.saveFailed", { status: res.status, detail: errText || t("detail.checkForm") })
          );
          setIsSaving(false);
          return;
        }

        // Fetch newly created record from backend to get its generated ReportNo & ID
        let finalReportNo = formData.reportNo || "";
        let createdServiceId: string | undefined = undefined;
        try {
          const checkRes = await fetch("/api/proxy/technicalservices/search?pageNumber=1&pageSize=1&sortBy=reportNo&sortDescending=true&api-version=1.0", { headers });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const first = checkData?.items?.[0];
            if (first) {
              if (first.reportNo) finalReportNo = first.reportNo;
              if (first.id) createdServiceId = first.id;
            }
          }
        } catch {}

        // Resolve current user display name
        const currentUserName = getCurrentUserFullName();

        const dateStr = formData.serviceDate
          ? new Date(formData.serviceDate).toLocaleDateString("en-GB") + " " + new Date(formData.serviceDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          : new Date().toLocaleDateString("en-GB") + " " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

        const msgHtml = buildTelegramMessage("ItemReceived", {
          reportNo: finalReportNo,
          companyName: formData.companyName || "N/A",
          address: formData.address,
          contactPerson: formData.contactName,
          phoneNumber: formData.phoneNumber,
          serviceDate: dateStr,
          serviceLocation: locationEnum,
          itemName: formData.itemName || "N/A",
          serialNumber: formData.serialNumber || "N/A",
          hasContract: Boolean(formData.hasContract),
          customerRequest: formData.customerRequest || "No",
          receivedByName: currentUserName
        }, false);

        try {
          const sendRes = await sendTelegramNotification("ItemReceived", msgHtml);
          if (sendRes.success && sendRes.messageId && createdServiceId) {
            void saveServiceTelegramMessage(createdServiceId, "ItemReceived", sendRes.messageId);
          }
        } catch (tgErr) {
          console.warn("ItemReceived telegram dispatch failed:", tgErr);
        }
      } else {
        // Editing goes through UpdateRepairServiceCommand.
        //
        // Deliberately NOT calling /inspectitem here, even though the Blazor
        // dialog does: its handler runs SetInspection(), which hardcodes
        // _serviceStatusId = 2, so every save would drag the ticket into
        // "Inspection". Blazor compensates with a third call that re-applies
        // the chosen status, but that switch has no case for "Item Recieved"
        // and no backend endpoint can set a ticket back to it. Editing a
        // ticket's details must never move it along the workflow — status
        // changes belong to the status dropdown and its dedicated endpoints.
        //
        // Inspection, solution and service type are not editable here (the
        // inspect dialog owns them), but they must still be sent: the handler
        // assigns those columns unconditionally, so omitting them would blank
        // out the technician's findings. Values come from the full record
        // loaded when this dialog opened, so they round-trip untouched.
        const serviceTypeId =
          formData.serviceType === "Charge" ? 2 :
          formData.serviceType === "Free"   ? 1 : 0;

        if (serviceTypeId === 0) {
          // Every ticket is created with serviceTypeId 1, so this means the
          // record failed to load rather than that a value needs picking —
          // and there is no field here to fix it in. Refuse rather than send
          // a guess, which would flip a chargeable repair to free.
          setSubmitError(t("detail.serviceTypeUnreadable"));
          setIsSaving(false);
          return;
        }

        // Resend the ticket's CURRENT status so the save leaves it exactly
        // where it is. No silent fallback here: guessing a status id would
        // move the ticket somewhere the user never asked for.
        const statusId =
          SERVICE_STATUSES_DB.find((s) => s.name === formData.status)?.id ??
          formData.statusId;

        if (!statusId) {
          setSubmitError(t("detail.unrecognisedStatus", { status: formData.status ?? "" }));
          setIsSaving(false);
          return;
        }

        const servicePayload = {
          id: formData.id,
          customerId: resolvedCustomerId || "00000000-0000-0000-0000-000000000000",
          companyName: formData.companyName || "N/A",
          address: formData.address || "",
          contactName: formData.contactName || "",
          phoneNumber: formData.phoneNumber || "",
          itemId: formData.itemId,
          reportNo: formData.reportNo,
          serviceDate: normalizeServiceDate(formData.serviceDate),
          customerRequest:
            formData.customerRequest?.trim() || formData.inspection?.trim() || "Receive Item Service Request",
          inspection: formData.inspection || "",
          solution: formData.solution || "",
          serviceLocation: locationEnum,
          serviceTypeId,
          servicePriorityId: priorityId,
          statusId,
          hasContract: Boolean(formData.hasContract),
          isThirdPartyRepair: Boolean(formData.isThirdPartyRepair),
          sparepartItems: spareparts
        };

        const res = await fetch("/api/proxy/technicalservices", {
          method: "PUT",
          headers,
          body: JSON.stringify(servicePayload)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`Save failed (${res.status}):`, errText);
          setSubmitError(
            t("detail.saveFailed", { status: res.status, detail: errText || t("detail.checkForm") })
          );
          setIsSaving(false);
          return;
        }
      }

      const savedItem: RepairServiceItem = formData;

      invalidateCachePrefix("repairservices");
      invalidateCachePrefix("dashboard");

      // Sync/edit telegram notification if an existing ticket is modified (ONLY on real existing tickets in edit mode)
      if (!isNew && currentMode === "edit" && formData.id && !formData.id.startsWith("new-")) {
        void dispatchTelegramNotificationSafe(formData, formData.status || "Item Recieved", undefined, true);
      }

      setSaveSuccess(true);
      if (onSave) onSave(savedItem);
      // Cancelled on unmount: all three of these touch state or the
      // parent, and 600ms is long enough to close the modal by hand.
      later(() => {
        setIsSaving(false);
        setSaveSuccess(false);
        onClose();
      }, 600);
    } catch (err: unknown) {
      console.error("Submit error:", err);
      setSubmitError(err instanceof Error ? err.message : t("detail.networkError"));
      setIsSaving(false);
    }
  };

  const isView = currentMode === "view";
  const modalWrapperClass = "bg-surface border border-subtle shadow-soft-xl text-ink";
  const headerBgClass = "border-b border-subtle bg-cushion";
  const currentItem = fullItem ?? item;
  const currentDays = currentItem?.daysTaken ?? (currentItem ? calculateDaysTaken(currentItem) : null);


  const effectiveZIndex = zIndex ?? 50;

  return (
    <ModalWrapper
      open={!!item}
      onClose={onClose}
      maxWidth="max-w-3xl xl:max-w-4xl"
      zIndex={effectiveZIndex}
      labelledBy="service-detail-title"
    >
      <div className={`w-full overflow-hidden flex flex-col max-h-[var(--av-modal-inner-maxh)] ${modalWrapperClass}`}>

        {/* ── Header ── */}
        <div className={`px-5 py-3 flex items-center justify-between shrink-0 ${headerBgClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-info-soft text-info flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 id="service-detail-title" className="text-sm font-bold text-ink flex items-center gap-2">
                {isView ? t("detail.viewTitle") : t("detail.editTitle")}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-info-soft text-info-fg">
                  {currentItem.reportNo || "TICKET"}
                </span>
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{t("detail.receivedPrefix")} {fmtDate(currentItem.serviceDate) ?? "N/A"}</span>
                <span>·</span>
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${getStatusBadgeClass(currentItem.status)}`}>
                  {translateStatus(currentItem.status, t)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle VIEW / EDIT - only available on intake */}
            {isReceivedStage && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentMode(isView ? "edit" : "view")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-subtle text-ink-secondary hover:bg-sunken transition-colors"
                >
                  {isView ? (
                    <><Edit3 className="w-3.5 h-3.5" /> {t("action.edit")}</>
                  ) : (
                    <><Eye className="w-3.5 h-3.5" /> {t("action.view")}</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-soft transition-colors"
                  title={t("action.deleteTicket")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Content (swaps between VIEW and EDIT) ── */}
        {isView ? (
          <ViewContent item={fullItem ?? item} />
        ) : (
          <EditContent
            formData={formData}
            setFormData={setFormData}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            submitError={submitError}
            onClose={onClose}
            handleSubmit={handleSubmit}
          />
        )}

        {/* Delete Ticket Confirmation Dialog */}
        <ModalWrapper
          open={showConfirmDelete}
          onClose={() => setShowConfirmDelete(false)}
          maxWidth="max-w-md"
          zIndex={effectiveZIndex + 10}
          isAlert
        >
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-ink">{t("table.deleteTicketTitle")}</h3>
              <p className="text-xs text-ink-secondary">
                {t("table.deleteTicketBody", {
                  ref: item.reportNo ?? "",
                  company: item.companyName ?? ""
                })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-subtle">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-xs font-semibold text-ink bg-sunken rounded-xl hover:bg-sunken transition-colors"
              >
                {t("action.cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!item?.id) return;
                  setIsDeleting(true);
                  const ok = await deleteTechnicalService(item.id);
                  setIsDeleting(false);
                  setShowConfirmDelete(false);
                  if (onSave) onSave({ ...item, id: "" });
                  onClose();
                }}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-semibold text-white bg-danger rounded-xl hover:bg-danger shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60"
              >
                {isDeleting ? t("table.deleting") : t("table.confirmDelete")}
              </button>
            </div>
          </div>
        </ModalWrapper>
      </div>
    </ModalWrapper>
  );
}
