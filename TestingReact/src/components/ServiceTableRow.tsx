"use client";

/**
 * @file ServiceTableRow.tsx
 * @description One ticket row, and the per-row controls only it uses.
 *
 * Split out of `ServiceTable` so the row can be `React.memo`'d. Previously
 * every row was inline JSX inside `items.map`, so a single keystroke in the
 * search box re-rendered and reconciled every loaded row (up to the 2,000-row
 * cap in `useInfiniteList`) across nine cells each — including a
 * `RenderStatusSelect` per row — before the 300ms debounce had even fired the
 * request. That is the same cost class the spare-parts table hit: this repo
 * measured windowing alone REGRESSING scroll there until the row was memoised
 * (16.3% of frames >32ms → 3.7%), which is why the fix is memoisation and not
 * only virtualization.
 *
 * **Memo is defeated by a closure.** Every handler here takes the row as an
 * ARGUMENT and must arrive as a stable `useCallback` identity from the parent;
 * an inline `() => doThing(row)` prop creates a new function per render and
 * silently turns this back into the unmemoised version. Same rule the
 * spare-parts `PartRow` documents.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Eye, Edit3, Printer, Trash2, ShieldCheck } from "lucide-react";
import { RepairServiceItem } from "@/services/api";
import { getActionUserForStatus } from "@/services/types";
import HighlightText from "./HighlightText";
import { useI18n } from "@/i18n/LanguageProvider";
import { translatePriority, translateStatus } from "@/i18n/statusLabel";
import { transitionGuard } from "@/validation";

const getStatusBadge = (status: string) => {
  const s = status?.toUpperCase() || "";
  if (s === "FINISHED")
    return "bg-success-soft text-success-fg ";
  if (s.includes("AWAITING CUSTOMER"))
    return "bg-warning-soft text-warning-fg ";
  if (s.includes("AWAITING SPAREPART") || s.includes("SENT SPAREPARTS"))
    return "bg-info-soft text-info-fg ";
  if (s.includes("THIRD-PARTY") || s.includes("THIRD PARTY"))
    return "bg-accent-soft text-accent ";
  if (s.includes("REJECTED"))
    return "bg-danger-soft text-danger-fg ";
  if (s.includes("UNREPAIRABLE"))
    return "bg-warning-soft text-warning-fg ";
  if (s.includes("REPAIRING"))
    return "bg-info-soft text-info-fg ";
  return "bg-sunken text-ink ";
};

const getPriorityBadge = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case "HIGH":
      return "bg-danger-soft text-danger-fg border-danger ";
    case "LOW":
      return "bg-success-soft text-success-fg border-success ";
    default:
      return "bg-warning-soft text-warning-fg border-warning ";
  }
};

function RenderStatusSelect({
  row,
  effectiveFilter,
  onStatusChange,
  disableStatusDropdown,
}: {
  row: RepairServiceItem;
  effectiveFilter: string;
  onStatusChange: (item: RepairServiceItem, newStatus: string) => void;
  disableStatusDropdown?: boolean;
}) {
  const { t } = useI18n();
  const status = row.status || "RECEIVED";
  const normFilter = (effectiveFilter || "").toUpperCase();

  // If status dropdown is disabled on this page/tab (e.g. Inspection page where status change is not technical's role)
  if (disableStatusDropdown) {
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-bold tracking-tight ${getStatusBadge(status)}`}>
        {translateStatus(status, t)}
      </span>
    );
  }

  const selectCls =
    "px-3 py-1 text-[11px] font-semibold rounded-full border outline-none cursor-pointer text-center font-sans tracking-tight shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform,filter]";
  // The <option> palette is fixed regardless of which coloured <select> the
  // option sits in, so it's hoisted rather than repeated on all ~15 of them.
  const optionCls = "bg-surface text-ink ";

  // 1. Received / Item Recieved tab / page
  if (
    normFilter.includes("RECEIVED") ||
    normFilter.includes("RECIEVED") ||
    status === "Item Recieved" ||
    status === "Received"
  ) {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-sunken text-ink border-prominent `}
      >
        <option value={status} hidden>
          {t("transition.itemReceived")}
        </option>
        <option value="Inspecting" className={optionCls}>
          {t("transition.sendToInspect")}
        </option>
      </select>
    );
  }

  // 2. Inspecting tab / page
  if (normFilter === "INSPECTING" || status === "Inspecting") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        /* `accent-soft-fg`, not `accent-fg`. The two are not interchangeable:
           `accent-fg` is the colour that sits on the SOLID accent (white in
           light, near-black in dark), so pairing it with the soft tint gave
           white-on-pale-green at 1.14:1 in light and 1.29:1 in dark — text
           that was there and could not be read, in both themes. */
        className={`${selectCls} bg-accent-soft text-accent-soft-fg border-accent `}
      >
        <option value="Inspecting" hidden>
          {t("transition.inspecting")}
        </option>
        <option value="Inspection" className={optionCls}>
          {t("transition.inspectionDone")}
        </option>
        <option value="Awaiting Sparepart" className={optionCls}>
          {t("transition.sendToStock")}
        </option>
        <option value="Awaiting Customer Confirm" className={optionCls}>
          {t("transition.sendToSales")}
        </option>
      </select>
    );
  }

  // 3. Awaiting Sparepart tab / page
  if (normFilter.includes("AWAITING SPAREPART") || status === "Awaiting Sparepart") {
    const isFree =
      String(row.serviceType || "").trim().toLowerCase() === "free" ||
      String(row.serviceType || "").trim() === "1" ||
      (row as unknown as { serviceTypeId?: number }).serviceTypeId === 1 ||
      (row as unknown as { ServiceTypeId?: number }).ServiceTypeId === 1;

    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-info-soft text-info-fg border-info `}
      >
        <option value="Awaiting Sparepart" hidden>
          {t("transition.awaitingSparePart")}
        </option>
        <option value="Awaiting Customer Confirm" className={optionCls}>
          {t("transition.sendToSales")}
        </option>
        {isFree && (
          <option value="Sent Spareparts" className={optionCls}>
            {t("transition.sendSparesToTechFree")}
          </option>
        )}
      </select>
    );
  }

  // 4. Awaiting Customer Confirm tab / page
  if (normFilter.includes("AWAITING CUSTOMER CONFIRM") || status === "Awaiting Customer Confirm") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-warning-soft text-warning-fg border-warning `}
      >
        <option value="Awaiting Customer Confirm" hidden>
          {t("transition.awaitingCustomer")}
        </option>
        <option value="Sale Confirmed" className={optionCls}>
          {t("transition.repairable")}
        </option>
        <option value="Customer Rejected" className={optionCls}>
          {t("transition.customerRejected")}
        </option>
        <option value="Unrepairable" className={optionCls}>
          {t("transition.unrepairable")}
        </option>
      </select>
    );
  }

  // 5. Inspection tab / page
  if (normFilter.includes("INSPECTION") || status === "Inspection") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-info-soft text-info-fg border-info `}
      >
        <option value="Inspection" hidden>
          {t("transition.inspectionDone")}
        </option>
        <option value="Awaiting Sparepart" className={optionCls}>
          {t("transition.sendToStock")}
        </option>
        <option value="Awaiting Customer Confirm" className={optionCls}>
          {t("transition.sendToSales")}
        </option>
      </select>
    );
  }

  // 6. Sale Confirmed tab / page
  if (normFilter.includes("SALE CONFIRMED") || status === "Sale Confirmed") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-success-soft text-success-fg border-success `}
      >
        <option value="Sale Confirmed" hidden>
          {t("transition.repairable")}
        </option>
        <option value="Sent Spareparts" className={optionCls}>
          {t("transition.sendSparesToTech")}
        </option>
      </select>
    );
  }

  // 7. Repairing / Sent Spareparts
  if (
    normFilter.includes("REPAIRING") ||
    normFilter.includes("SENT SPAREPARTS") ||
    status === "Sent Spareparts" ||
    status === "Repairing"
  ) {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-accent-soft text-accent border-accent `}
      >
        <option value="Sent Spareparts" hidden>
          {t("transition.sparesSent")}
        </option>
        <option value="Inspecting" className={optionCls}>
          {t("transition.adjustSparesAgain")}
        </option>
        <option value="Finished" className={optionCls}>
          {t("transition.repairDone")}
        </option>
        <option value="Unrepairable" className={optionCls}>
          {t("transition.unrepairable")}
        </option>
        <option value="Repair by Third-Party" className={optionCls}>
          {t("transition.sendToThirdParty")}
        </option>
      </select>
    );
  }

  // Static badge for other statuses
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-bold tracking-tight ${getStatusBadge(status)}`}>
      {translateStatus(status, t)}
    </span>
  );
}

/** Shared cell padding — one string rather than nine copies of the same list. */
const CELL = "py-2 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3";

export interface TicketRowProps {
  row: RepairServiceItem;
  /**
   * The DEBOUNCED search term, not the raw input value. Highlighting off the
   * raw value re-rendered every row on every keystroke to mark text that the
   * rows behind it had not been re-fetched for yet.
   */
  query: string;
  effectiveFilter: string;
  requireApproval?: boolean;
  disableStatusDropdown?: boolean;
  onView: (row: RepairServiceItem) => void;
  onEdit: (row: RepairServiceItem) => void;
  onPrint: (row: RepairServiceItem) => void;
  onDelete: (row: RepairServiceItem) => void;
  onApprove: (row: RepairServiceItem) => void;
  onStatusChange: (item: RepairServiceItem, newStatus: string) => void;
  isSelected?: boolean;
  onSelectRow?: (row: RepairServiceItem) => void;
  visibleColumns?: Record<string, boolean>;
  isRibbonMode?: boolean;
}

function TicketRowImpl({
  row,
  query,
  effectiveFilter,
  requireApproval,
  disableStatusDropdown,
  onView,
  onEdit,
  onPrint,
  onDelete,
  onApprove,
  onStatusChange,
  isSelected,
  onSelectRow,
  visibleColumns,
  isRibbonMode,
}: TicketRowProps) {
  const { t, lang } = useI18n();

  const serviceDateLabel = React.useMemo(() => {
    if (!row.serviceDate) return "N/A";
    const d = new Date(row.serviceDate);
    return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }, [row.serviceDate]);

  const parts = row.sparePartItems || row.sparepartItems || [];
  const approvalRefusal = requireApproval
    ? transitionGuard(
        {
          status: row.status,
          serviceType: row.serviceType,
          serviceTypeId: row.serviceTypeId,
          sparePartCount: parts.length,
          reportNo: row.reportNo,
        },
        "Repairing"
      )
    : null;

  const showCol = (colKey: string) => !visibleColumns || visibleColumns[colKey] !== false;

  return (
    <tr
      onClick={() => {
        if (isRibbonMode && onSelectRow) {
          onSelectRow(row);
        } else {
          onView(row);
        }
      }}
      className={cn(
        "cursor-pointer transition-colors duration-150 ease-out select-none",
        isSelected
          ? "bg-accent-soft/70 dark:bg-accent-soft/30 border-l-2 border-accent"
          : "hover:bg-cushion"
      )}
    >
      {/* Ribbon Checkbox Selection Column */}
      {isRibbonMode && (
        <td
          className="w-9 px-2.5 text-center whitespace-nowrap"
          onClick={(e) => {
            e.stopPropagation();
            onSelectRow?.(row);
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(isSelected)}
            onChange={() => onSelectRow?.(row)}
            className="w-3.5 h-3.5 rounded border-subtle accent-accent cursor-pointer align-middle"
          />
        </td>
      )}

      {/* Ref No (Permanent) */}
      <td className={`${CELL} whitespace-nowrap font-mono font-semibold text-ink`}>
        <HighlightText text={row.reportNo || "N/A"} query={query} />
      </td>

      {/* Received Date */}
      {showCol("receiveDate") && (
        <td className={`${CELL} whitespace-nowrap text-ink-secondary`}>
          {serviceDateLabel}
        </td>
      )}

      {/* Company Name */}
      {showCol("companyName") && (
        <td
          className={`${CELL} font-medium text-ink max-w-[220px] truncate privacy-sensitive`}
          title={row.companyName || "N/A"}
        >
          <HighlightText text={row.companyName || "N/A"} query={query} />
        </td>
      )}

      {/* Item Name / Model */}
      {showCol("itemName") && (
        <td
          className={`${CELL} font-medium text-ink max-w-[240px] truncate`}
          title={row.itemName || "N/A"}
        >
          <HighlightText text={row.itemName || "N/A"} query={query} />
        </td>
      )}

      {/* Serial Number */}
      {showCol("serialNumber") && (
        <td className={`${CELL} whitespace-nowrap`}>
          <code className="px-2 py-0.5 rounded bg-sunken border border-subtle text-[11px] font-mono text-ink privacy-sensitive">
            <HighlightText text={row.serialNumber || "N/A"} query={query} />
          </code>
        </td>
      )}

      {/* Priority */}
      {showCol("priority") && (
        <td className={`${CELL} whitespace-nowrap text-center`}>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getPriorityBadge(
              row.servicePriority || "NORMAL"
            )}`}
          >
            {translatePriority(row.servicePriority || "NORMAL", t)}
          </span>
        </td>
      )}

      {/* Status */}
      {showCol("status") && (
        <td className={`${CELL} whitespace-nowrap text-center`}>
          <RenderStatusSelect
            row={row}
            effectiveFilter={effectiveFilter}
            onStatusChange={onStatusChange}
            disableStatusDropdown={disableStatusDropdown}
          />
        </td>
      )}

      {/* Receiver */}
      {showCol("receiver") && (
        <td className={`${CELL} whitespace-nowrap text-ink-secondary privacy-sensitive`}>
          <HighlightText text={getActionUserForStatus(row)} query={query} />
        </td>
      )}

      {/* Actions (Permanent) */}
      <td
        className={`${CELL} whitespace-nowrap text-center`}
        onClick={(e) => e.stopPropagation()}
      >
        {isRibbonMode ? (
          /* Enterprise Ribbon View Action Link (Matching Image 4) */
          <div className="flex items-center justify-center gap-1.5">
            {requireApproval && (
              <button
                type="button"
                onClick={() => onApprove(row)}
                className={
                  approvalRefusal
                    ? "inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-warning bg-warning-soft border border-warning/30 hover:bg-warning-soft/80 shadow-xs transition-colors cursor-pointer"
                    : "inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-success hover:bg-success/90 shadow-xs transition-colors cursor-pointer"
                }
                title={approvalRefusal ? approvalRefusal.message : t("nav.approveRepairing")}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{approvalRefusal ? (row.status === "Sale Confirmed" ? "រង់ចាំគ្រឿងបន្លាស់" : t("action.approve")) : t("action.approve")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onView(row)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/40 transition-colors shadow-2xs cursor-pointer"
              title={t("action.viewDetails")}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t("crud.viewDetails")}</span>
            </button>
            <button
              type="button"
              onClick={() => onPrint(row)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-accent hover:bg-accent-soft border border-accent/30 transition-colors shadow-2xs cursor-pointer"
              title={t("action.printTechnicalReport")}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("crud.print")}</span>
            </button>
          </div>
        ) : (
          /* Modern Inline Row Action Buttons (Matching Image 1 & 2) */
          <div className="flex items-center justify-center gap-1">
            {requireApproval && (
              <button
                onClick={() => onApprove(row)}
                className={
                  approvalRefusal
                    ? "inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-warning bg-warning-soft border border-warning/30 hover:bg-warning-soft/80 shadow-sm transition-colors cursor-pointer"
                    : "inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-success hover:bg-success shadow-sm transition-colors cursor-pointer"
                }
                title={approvalRefusal ? approvalRefusal.message : t("nav.approveRepairing")}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {approvalRefusal ? (row.status === "Sale Confirmed" ? "រង់ចាំគ្រឿងបន្លាស់" : t("action.approve")) : t("action.approve")}
              </button>
            )}
            <button
              onClick={() => onView(row)}
              className="p-1.5 rounded-lg text-info hover:bg-accent-soft transition-colors "
              title={t("action.viewDetails")}
            >
              <Eye className="w-4 h-4" />
            </button>
            {((row.status || "").toLowerCase().includes("reciev") || (row.status || "").toLowerCase().includes("receiv")) ? (
              <>
                <button
                  onClick={() => onEdit(row)}
                  className="p-1.5 rounded-lg text-ink-secondary hover:bg-sunken transition-colors "
                  title={t("action.editTicket")}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(row)}
                  className="p-1.5 rounded-lg text-ink-secondary hover:text-danger hover:bg-danger-soft transition-colors "
                  title={t("action.deleteTicket")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={true}
                  className="p-1.5 rounded-lg text-ink-muted/30 opacity-40 cursor-not-allowed"
                  title={lang === "km" ? "មុខងារ CRUD មានតែលើទំព័រ Receive Items ប៉ុណ្ណោះ" : "CRUD is only available on Receive Items"}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={true}
                  className="p-1.5 rounded-lg text-ink-muted/30 opacity-40 cursor-not-allowed"
                  title={lang === "km" ? "មុខងារ CRUD មានតែលើទំព័រ Receive Items ប៉ុណ្ណោះ" : "CRUD is only available on Receive Items"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => onPrint(row)}
              className="p-1.5 rounded-lg text-accent hover:bg-accent-soft transition-colors "
              title={t("action.printTechnicalReport")}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * Rows compare by identity, which is what `useInfiniteList` already gives us:
 * a refresh replaces only the objects it refetched, so untouched rows keep
 * their reference and skip re-rendering entirely.
 *
 * `t` is deliberately read from context inside the row rather than passed as a
 * prop — it is `useCallback`'d on `[lang]` in `LanguageProvider`, so a
 * language switch still re-renders every row, which is correct.
 */
const TicketRow = React.memo(TicketRowImpl);
TicketRow.displayName = "TicketRow";

export default TicketRow;
