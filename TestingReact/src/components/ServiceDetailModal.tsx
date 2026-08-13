"use client";

import React, { useState, useEffect, useRef } from "react";
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
  invalidateCachePrefix,
} from "@/services/api";
import {
  calculateDaysTaken,
  toBackendLocalDateTime,
  formatTime24HourWithAmPm,
  SERVICE_PRIORITIES,
  getServicePriorityId,
  normaliseServicePriority,
} from "@/services/types";
import { fetchUserMap, resolveUserNameSync, getCurrentUserGuid } from "@/services/userService";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import {
  translatePriority,
  translateServiceLocation,
  translateServiceType,
  translateStatus,
} from "@/i18n/statusLabel";
import {
  X,
  Wrench,
  Save,
  CheckCircle2,
  Building2,
  Phone,
  MapPin,
  User,
  Calendar,
  Clock,
  Package,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Trash2,
} from "lucide-react";
import ModernSelect from "./ModernSelect";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ModalProps {
  item: RepairServiceItem | null;
  onClose: () => void;
  /** default "view" — read-only audit trail; "edit" — form submission */
  mode?: "view" | "edit";
  onSave?: (updatedItem: RepairServiceItem) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    const datePart = date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
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
  if (s === "FINISHED") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  if (s?.includes("AWAITING CUSTOMER")) return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  if (s?.includes("AWAITING SPAREPART") || s?.includes("SENT SPAREPARTS")) return "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";
  if (s?.includes("THIRD-PARTY") || s?.includes("THIRD PARTY")) return "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300";
  if (s?.includes("REJECTED")) return "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
  if (s?.includes("UNREPAIRABLE")) return "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300";
  if (s?.includes("REPAIRING")) return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

// Returns a translation key rather than a finished label: this is a plain
// function, not a component, so it can't call useI18n() itself — the caller
// already has `t` in scope and resolves it at the point of render.
function resolveStockBadge(
  serviceStatus: string,
  condition?: string,
  stockQty = 0
): { labelKey: TranslationKey; bg: string; fg: string } {
  if (serviceStatus === "Sent Spareparts")
    return { labelKey: "stockBadge.allDispatched", bg: "#28a745", fg: "#fff" };
  if (condition === "Fix")
    return { labelKey: "stockBadge.noStockDeduction", bg: "#6f42c1", fg: "#fff" };
  if (stockQty <= 0)
    return { labelKey: "stockBadge.outOfStock", bg: "#dc3545", fg: "#fff" };
  return { labelKey: "stockBadge.inStock", bg: "#28a745", fg: "#fff" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** A single timeline row: label + date + optional "by [user]" */
function TimelineRow({
  label,
  date,
  byName,
  byGuid,
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
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap w-48">
        {label}
      </td>
      <td className="py-2 px-3 text-xs text-slate-800 dark:text-slate-200">
        {formatted}
        {isRealName(resolvedName) && (
          <span className="ml-2 text-slate-400 dark:text-slate-500 font-medium">
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
        className="py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 border-t border-b border-slate-200 dark:border-slate-700"
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
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap w-48">
        {label}
      </td>
      <td className="py-2 px-3 text-xs text-slate-800 dark:text-slate-200">{value}</td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW MODE — matches RepairServiceViewDialog.razor exactly
// ─────────────────────────────────────────────────────────────────────────────
function ViewContent({ item }: { item: RepairServiceItem }) {
  const { t } = useI18n();
  // The API serialises the backend's `SparepartItems` property as camelCase
  // `sparepartItems` (lowercase p), not `sparePartItems` — every other spare
  // -part reader in this app (ServiceTable, ApproveRepairDialog,
  // InspectItemDialog, PrintPreviewSidebar) already checks both casings.
  // This view previously checked only `sparePartItems`, which never exists,
  // so the spare-parts table silently never rendered.
  const spareParts = item.sparePartItems ?? item.sparepartItems ?? [];
  const totalQty = spareParts.reduce((s, p) => s + p.quantity, 0);
  const grandTotal = spareParts.reduce(
    (s, p) => s + (p.defaultPrice ?? 0) * p.quantity,
    0
  );

  return (
    <div className="overflow-y-auto flex-1 p-6">
      {/* ── Audit Timeline table ── */}
      <table className="w-full mb-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <tbody>
          <InfoRow label={t("field.refNo")} value={item.reportNo} />
          <TimelineRow label={t("detail.tlReceived")} date={item.serviceDate} byName={item.createdByName} byGuid={item.createBy || item.userId} />
          <TimelineRow label={t("detail.tlInspection")} date={item.inspectDate} byName={item.inspectByName} byGuid={item.inspectBy || item.inspectingBy} />
          <TimelineRow label={t("detail.tlAwaitingSpare")} date={item.awaitingSparepartDate} byName={item.setAwaitingSparepartByName} byGuid={item.setAwaitingSparepartBy} />
          <TimelineRow label={t("detail.tlAwaitCustomer")} date={item.awaitingCustomerConfirmDate} byName={item.setAwaitingCustomerConfirmByName} byGuid={item.setAwaitingCustomerConfirmBy} />
          <TimelineRow label={t("detail.tlSaleConfirmed")} date={item.saleConfirmedDate} byName={item.setSaleConfirmedByName} byGuid={item.setSaleConfirmedBy} />
          <TimelineRow label={t("detail.tlSentSpareparts")} date={item.sentSparepartsDate} byName={item.setSentSparepartsByName} byGuid={item.setSentSparepartsBy} />
          <TimelineRow label={t("detail.tlApproveRepair")} date={item.repairDate} byName={item.repairByName} byGuid={item.repairBy} />
          <TimelineRow label={t("detail.tlThirdParty")} date={item.thirdPartyRepairDate} byName={item.thirdPartyRepairByName} byGuid={item.thirdPartyRepairBy} />
          <TimelineRow label={t("detail.tlFinished")} date={item.finishedDate} byName={item.verifiedByName || item.repairByName} byGuid={item.verifiedBy || item.repairBy} />
          <TimelineRow label={t("detail.tlRejected")} date={item.customerRejectedDate} byName={item.setCustomerRejectedByName} byGuid={item.setCustomerRejectedBy} />
          <TimelineRow label={t("detail.tlUnrepairable")} date={item.unrepairableDate} byName={item.setUnrepairableByName} byGuid={item.setUnrepairableBy} />
          {(() => {
            const days = item.daysTaken ?? calculateDaysTaken(item);
            if (days == null) return null;
            return (
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-48">
                  {t("detail.duration")}
                </td>
                <td className="py-2 px-3 text-xs text-slate-800 dark:text-slate-200">
                  {days === 1 ? t("detail.day", { count: days }) : t("detail.days", { count: days })}
                </td>
              </tr>
            );
          })()}

          {/* Customer Info Section */}
          <SectionHeader
            icon={<Building2 className="w-3.5 h-3.5 text-blue-500" />}
            label={t("detail.customerInfo")}
          />
          <InfoRow label={t("field.companyName")} value={item.companyName} />
          <InfoRow label={t("field.address")} value={item.address} />
          <InfoRow label={t("field.contactName")} value={item.contactName} />
          <InfoRow label={t("field.phoneNumber")} value={item.phoneNumber} />

          {/* Machine Info Section */}
          <SectionHeader
            icon={<Package className="w-3.5 h-3.5 text-blue-500" />}
            label={t("detail.machineInfo")}
          />
          <InfoRow label={t("field.itemName")} value={item.itemName} />
          <InfoRow label={t("field.serialNumber")} value={item.serialNumber} />
          <InfoRow label={t("field.customerRequest")} value={item.customerRequest} />
          <InfoRow label={t("field.inspection")} value={item.inspection} />
          <InfoRow label={t("field.solution")} value={item.solution} />

          {/* Repair Status Section */}
          <SectionHeader
            icon={<Wrench className="w-3.5 h-3.5 text-blue-500" />}
            label={t("detail.repairStatus")}
          />
          <InfoRow label={t("field.serviceLocation")} value={translateServiceLocation(item.serviceLocation, t)} />
          <InfoRow label={t("field.serviceType")} value={translateServiceType(item.serviceType, t)} />
          <InfoRow label={t("field.priority")} value={translatePriority(item.servicePriority, t)} />
          {item.status && (
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-48">
                {t("field.status")}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${getStatusBadgeClass(item.status)}`}
                >
                  {translateStatus(item.status, t)}
                </span>
              </td>
            </tr>
          )}
          <tr className="border-b border-slate-100 dark:border-slate-800">
            <td className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-48">
              {t("detail.contract")}
            </td>
            <td className="py-2 px-3 text-xs text-slate-800 dark:text-slate-200">
              {item.hasContract ? t("value.yes") : t("value.no")}
            </td>
          </tr>
          {item.isThirdPartyRepair && (
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-48">
                {t("detail.thirdPartyRepair")}
              </td>
              <td className="py-2 px-3 text-xs text-slate-800 dark:text-slate-200">{t("value.yes")}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Spare Parts Table ── */}
      {spareParts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-blue-500" />
            {t("detail.sparePartDetails")}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-2 py-2 text-center w-10">{t("inspect.colImage")}</th>
                  <th className="px-3 py-2 text-left">{t("field.itemName")}</th>
                  <th className="px-3 py-2 text-left">{t("field.useFor")}</th>
                  <th className="px-2 py-2 text-center w-10">{t("inspect.colQty")}</th>
                  <th className="px-2 py-2 text-center w-20">{t("field.condition")}</th>
                  <th className="px-2 py-2 text-right w-20">{t("field.price")}</th>
                  <th className="px-2 py-2 text-center w-28">{t("field.stock")}</th>
                </tr>
              </thead>
              <tbody>
                {spareParts.map((sp) => {
                  const badge = resolveStockBadge(
                    item.status,
                    sp.condition,
                    sp.stockQuantity
                  );
                  return (
                    <tr key={sp.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-2 py-1.5 text-center">
                        {sp.pictureUrl ? (
                          <img
                            src={sp.pictureUrl}
                            alt="part"
                            className="w-9 h-9 object-cover rounded border border-slate-200 mx-auto"
                          />
                        ) : (
                          <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto">
                            <Package className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td
                        className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 max-w-[130px] truncate"
                        title={sp.itemName}
                      >
                        {sp.itemName || "—"}
                      </td>
                      <td
                        className="px-3 py-1.5 text-slate-500 dark:text-slate-400 max-w-[130px] truncate"
                        title={sp.useFor}
                      >
                        {sp.useFor || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-800 dark:text-slate-200">
                        {sp.quantity}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {sp.condition ? (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-[11px]">
                            {sp.condition}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {sp.defaultPrice != null
                          ? `$${sp.defaultPrice.toFixed(2)}`
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {/* Stock badge with hover tooltip matching old Blazor stock-qty-tooltip */}
                        <span
                          className="group relative inline-block text-[11px] font-bold px-2 py-0.5 rounded-full cursor-default whitespace-nowrap"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {t(badge.labelKey)}
                          {sp.stockQuantity != null && (
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 hidden group-hover:block bg-black/75 text-white text-[10px] rounded px-2 py-0.5 whitespace-nowrap">
                              {t("spec.inStock", { qty: sp.stockQuantity })}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-500 dark:text-slate-400 text-xs">
                    {t("detail.total")}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-800 dark:text-slate-200 text-xs">
                    {totalQty}
                  </td>
                  <td />
                  <td className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400 text-xs whitespace-nowrap">
                    ${grandTotal.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
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
            className="bg-yellow-300 dark:bg-yellow-500/80 text-slate-900 font-bold px-0.5 rounded"
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
  handleSubmit,
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
    "w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none";
  const labelCls = "text-xs font-semibold text-slate-700 dark:text-slate-300";

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
    sentinelRef: companySentinelRef,
  } = useInfiniteList<CustomerItem, HTMLDivElement, HTMLDivElement>({
    fetchPage: (pageNumber, size) => fetchCustomerCenter(pageNumber, size, companyTerm),
    pageSize: 50,
    resetKey: companyTerm,
    getId: (c) => c.id,
    disabled: companyTerm.length < 1,
  });

  const itemTerm = itemSearchQuery.trim();
  const {
    items: itemModels,
    totalCount: totalItems,
    isLoadingMore: itemsLoadingMore,
    reachedEnd: itemsReachedEnd,
    limitReached: itemsLimitReached,
    scrollRootRef: itemScrollRootRef,
    sentinelRef: itemSentinelRef,
  } = useInfiniteList<ItemModel, HTMLDivElement, HTMLDivElement>({
    fetchPage: (pageNumber, size) => fetchItemsInventory(pageNumber, size, itemTerm),
    pageSize: 20,
    resetKey: itemTerm,
    getId: (m) => m.id,
    disabled: itemTerm.length < 1,
  });

  const handleCompanySearch = (val: string) => {
    setFormData({ ...formData, companyName: val, customerId: undefined });
    setCompanySearchQuery(val);
    setShowCompanyDropdown(val.trim().length >= 1);
  };

  const handleSelectCompany = (comp: CustomerItem) => {
    setFormData({
      ...formData,
      customerId: comp.id,
      companyName: comp.companyName,
      phoneNumber: comp.phoneNumber && comp.phoneNumber !== "—" ? comp.phoneNumber : (formData.phoneNumber ?? ""),
      contactName: comp.contactName && comp.contactName !== "—" ? comp.contactName : (formData.contactName ?? ""),
      address: comp.address && comp.address !== "—" ? comp.address : (formData.address ?? ""),
    });
    setShowCompanyDropdown(false);
  };

  // Editing item/serial text after a selection invalidates the previously
  // resolved itemId — clearing it here stops a stale id (pointing at the
  // item the user *used to* have selected) from silently riding along to
  // submit once the visible text no longer matches it.
  const handleItemSearch = (val: string, field: "itemName" | "serialNumber") => {
    setFormData({ ...formData, [field]: val, itemId: undefined });
    setItemSearchQuery(val);
    setShowItemDropdown(val.trim().length >= 1);
  };

  const handleSelectItem = (item: ItemModel) => {
    setFormData({
      ...formData,
      itemId: item.id,
      itemName: item.itemName ?? "",
      serialNumber: item.serialNumber ?? "",
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
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Ticket updated successfully!
          </div>
        )}
        {submitError && (
          <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 rounded-xl text-xs flex items-center gap-2 font-medium">
            <X className="w-4 h-4 shrink-0" />
            {submitError}
          </div>
        )}

      {/* Service Date — kept at the top: it is the ticket's anchor date and
          the field most often corrected on arrival. */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                  handleCompanySearch(formData.companyName);
                }
              }}
              className={inputCls}
              placeholder={t("detail.typeCompany")}
            />
            {showCompanyDropdown && companies.length > 0 && (
              <div
                ref={companyScrollRootRef}
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto text-xs"
              >
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between font-semibold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    {t("detail.foundCompanies", { count: totalCompanies })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCompanyDropdown(false)}
                    className="text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-950/40 p-0.5 rounded text-sm"
                  >
                    ×
                  </button>
                </div>
                {companies.map((comp) => (
                  <div
                    key={comp.id}
                    onClick={() => handleSelectCompany(comp)}
                    className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      <HighlightMatchText text={comp.companyName} query={formData.companyName || ""} />
                    </div>
                    {(comp.address !== "—" || comp.phoneNumber !== "—") && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
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
            <input type="text" value={formData.contactName || ""}
              disabled
              className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500`} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>{t("field.address")}</label>
            <input type="text" value={formData.address || ""}
              disabled
              className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500`} />
          </div>
        </div>
      </div>

      {/* Machine Info */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto text-xs"
              >
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between font-semibold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-500" />
                    {t("detail.foundItems", { count: totalItems })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowItemDropdown(false)}
                    className="text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-950/40 p-0.5 rounded text-sm"
                  >
                    ×
                  </button>
                </div>
                {itemModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => handleSelectItem(model)}
                    className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
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
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl shadow-xl text-xs p-3 space-y-2">
                <p className="text-amber-700 dark:text-amber-400">
                  {t("detail.noItemMatches", { name: formData.itemName ?? "" })}
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewItem}
                  disabled={isCreatingItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {isCreatingItem
                    ? t("detail.creating")
                    : t("detail.createNewItem", { name: formData.itemName ?? "" })}
                </button>
              </div>
            )}
            {formData.itemId && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {t("detail.linkedToItem")}
              </p>
            )}
          </div>
          <div className="space-y-1 relative">
            <label className={labelCls}>{t("field.serialNumber")} *</label>
            <input
              type="text"
              value={formData.serialNumber || ""}
              required
              onChange={(e) => handleItemSearch(e.target.value, "serialNumber")}
              onFocus={() => {
                if ((formData.serialNumber || "").trim().length >= 1) {
                  handleItemSearch(formData.serialNumber, "serialNumber");
                }
              }}
              className={`${inputCls} font-mono`}
              placeholder={t("detail.typeSerial")}
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
            <label className={labelCls}>{t("detail.customerRequestIssue")}</label>
            <textarea rows={2} value={formData.customerRequest || ""}
              onChange={(e) => setFormData({ ...formData, customerRequest: e.target.value })}
              className={inputCls} placeholder={t("detail.issueReported")} />
          </div>
        </div>
      </div>

      {/* Service / Status */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
              // Only the label is translated — `value` stays the backend's
              // own spelling, per the casing note above.
              options={SERVICE_PRIORITIES.map((p) => ({
                value: p.name,
                label: translatePriority(p.name, t),
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
                label: translateServiceLocation(loc, t),
              }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={!!formData.hasContract}
              onChange={(e) => setFormData({ ...formData, hasContract: e.target.checked })}
              className="rounded" />
            {t("detail.hasContract")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={!!formData.isThirdPartyRepair}
              onChange={(e) => setFormData({ ...formData, isThirdPartyRepair: e.target.checked })}
              className="rounded" />
            {t("detail.thirdPartyRepair")}
          </label>
        </div>
      </div>
      </div>

      {/* Actions (Sticky footer) */}
      <div className="sticky bottom-0 z-20 px-6 py-3.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
          {t("action.cancel")}
        </button>
        <button type="submit" disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-60">
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
export default function ServiceDetailModal({ item, onClose, mode = "view", onSave }: ModalProps) {
  // Every hook must run before the `!item` bail-out below — React requires an
  // identical hook order on every render of a component instance.
  const [currentMode, setCurrentMode] = useState<"view" | "edit">(mode);
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
              const catalog = sparePartId ? await fetchSparePartById(sparePartId) : null;
              return {
                ...p,
                id: (p.id as string) ?? "",
                sparePartId: sparePartId ?? "",
                quantity: (p.quantity as number) ?? 0,
                itemName: catalog?.itemName || (p.description as string) || "",
                useFor: catalog?.useFor ?? "",
                pictureUrl: catalog?.pictureUrl ?? "",
                defaultPrice: catalog?.defaultPrice ?? 0,
                stockQuantity: catalog?.quantity ?? 0,
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
    if (!formData.itemId) {
      setSubmitError(t("detail.selectItemFirst"));
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
          isHoldStatus: Boolean(p.isHoldStatus),
        }))
        .filter((p) => Boolean(p.sparepartId));

      if (isNew) {
        // A brand-new ticket only has receive-item info — nothing inspected
        // or repaired yet — so this narrower DTO is the right one here.
        const payload: Record<string, unknown> = {
          customerId: formData.customerId || "00000000-0000-0000-0000-000000000000",
          companyName: formData.companyName || "N/A",
          address: formData.address || "",
          contactName: formData.contactName || "",
          phoneNumber: formData.phoneNumber || "",
          hasContract: Boolean(formData.hasContract),
          serviceDate: formData.serviceDate || toBackendLocalDateTime(),
          reportNo: null,
          serviceLocation: locationEnum,
          servicePriorityId: priorityId,
          itemId: formData.itemId,
          customerRequest:
            formData.customerRequest?.trim() || formData.inspection?.trim() || "Receive Item Service Request",
        };
        if (userGuid) payload.createBy = userGuid;

        const res = await fetch("/api/proxy/receiveitem", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
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
          customerId: formData.customerId || "00000000-0000-0000-0000-000000000000",
          companyName: formData.companyName || "N/A",
          address: formData.address || "",
          contactName: formData.contactName || "",
          phoneNumber: formData.phoneNumber || "",
          itemId: formData.itemId,
          reportNo: formData.reportNo,
          serviceDate: formData.serviceDate || toBackendLocalDateTime(),
          customerRequest:
            formData.customerRequest?.trim() || formData.inspection?.trim() || "Receive Item Service Request",
          inspection: formData.inspection || "",
          solution: formData.solution || "",
          serviceLocation: locationEnum,
          serviceTypeId,
          servicePriorityId: priorityId,
          statusId,
          hasContract: Boolean(formData.hasContract),
          sparepartItems: spareparts,
        };

        const res = await fetch("/api/proxy/technicalservices", {
          method: "PUT",
          headers,
          body: JSON.stringify(servicePayload),
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

      setSaveSuccess(true);
      if (onSave) onSave(savedItem);
      setTimeout(() => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[90vh] my-auto">

        {/* ── Header ── */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {isView ? t("detail.viewTitle") : t("detail.editTitle")}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {item.reportNo || "TICKET"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("detail.receivedPrefix")} {fmtDate(item.serviceDate) ?? "N/A"}
                &nbsp;·&nbsp;
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${getStatusBadgeClass(item.status)}`}>
                  {translateStatus(item.status, t)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle VIEW / EDIT */}
            <button
              type="button"
              onClick={() => setCurrentMode(isView ? "edit" : "view")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
              title={t("action.deleteTicket")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
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
        {showConfirmDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmDelete(false); }}
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("table.deleteTicketTitle")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("table.deleteTicketBody", {
                    ref: item.reportNo ?? "",
                    company: item.companyName ?? "",
                  })}
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
                    if (onSave) onSave({ ...item, id: "" } as any);
                    onClose();
                  }}
                  disabled={isDeleting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all disabled:opacity-60"
                >
                  {isDeleting ? t("table.deleting") : t("table.confirmDelete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
