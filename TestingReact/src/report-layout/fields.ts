/**
 * @file report-layout/fields.ts
 * @description Which RepairServices fields the designer can bind to a printed
 * slot, and how a ticket's "current status" date is resolved.
 *
 * See `types.ts` for why this folder has no framework imports.
 */

import { asRecord, type ReportTicketLike, type TicketFieldDef } from "./types";

export const TICKET_FIELDS: TicketFieldDef[] = [
  // ── 1. Services & Ticket Core ──
  { key: "reportNo", type: "text", group: "ticket" },
  { key: "status", type: "text", group: "ticket" },
  { key: "serviceType", type: "text", group: "ticket" },
  { key: "servicePriority", type: "text", group: "ticket" },
  { key: "serviceLocation", type: "text", group: "ticket" },
  { key: "hasContract", type: "boolean", group: "ticket" },
  { key: "isThirdPartyRepair", type: "boolean", group: "ticket" },
  { key: "daysTaken", type: "number", group: "ticket" },
  { key: "customerRequest", type: "text", group: "ticket" },
  { key: "inspection", type: "text", group: "ticket" },
  { key: "solution", type: "text", group: "ticket" },
  { key: "id", type: "text", group: "ticket" },
  { key: "statusId", type: "number", group: "ticket" },
  { key: "serviceTypeId", type: "number", group: "ticket" },
  { key: "servicePriorityId", type: "number", group: "ticket" },
  { key: "telegramMessageId", type: "number", group: "ticket" },

  // ── 2. SparepartItems & Spare Parts ──
  { key: "sparePartsSummary", type: "text", group: "spareparts" },
  { key: "sparePartsCount", type: "number", group: "spareparts" },
  { key: "sparePartsTotalCost", type: "number", group: "spareparts" },
  { key: "sparePartsRemarks", type: "text", group: "spareparts" },
  { key: "isHoldStatus", type: "boolean", group: "spareparts" },
  { key: "remarksUpdatedAt", type: "date", group: "spareparts" },
  { key: "sparePartId", type: "text", group: "spareparts" },

  // ── 3. Customer & Contact ──
  { key: "companyName", type: "text", group: "customer" },
  { key: "contactName", type: "text", group: "customer" },
  { key: "phoneNumber", type: "text", group: "customer" },
  { key: "address", type: "text", group: "customer" },
  { key: "customerId", type: "text", group: "customer" },

  // ── 4. Machine & Equipment ──
  { key: "itemName", type: "text", group: "machine" },
  { key: "serialNumber", type: "text", group: "machine" },
  { key: "itemId", type: "text", group: "machine" },

  // ── 5. Lifecycle & Audit Dates ──
  { key: "serviceDate", type: "date", group: "dates" },
  { key: "inspectDate", type: "date", group: "dates" },
  { key: "inspectingDate", type: "date", group: "dates" },
  { key: "awaitingSparepartDate", type: "date", group: "dates" },
  { key: "awaitingCustomerConfirmDate", type: "date", group: "dates" },
  { key: "saleConfirmedDate", type: "date", group: "dates" },
  { key: "sentSparepartsDate", type: "date", group: "dates" },
  { key: "repairDate", type: "date", group: "dates" },
  { key: "thirdPartyRepairDate", type: "date", group: "dates" },
  { key: "finishedDate", type: "date", group: "dates" },
  { key: "customerRejectedDate", type: "date", group: "dates" },
  { key: "unrepairableDate", type: "date", group: "dates" },

  // ── 6. People, Handlers & Users ──
  { key: "createdByName", type: "text", group: "people" },
  { key: "createdByPhone", type: "text", group: "people" },
  { key: "inspectByName", type: "text", group: "people" },
  { key: "setAwaitingSparepartByName", type: "text", group: "people" },
  { key: "setAwaitingCustomerConfirmByName", type: "text", group: "people" },
  { key: "setSaleConfirmedByName", type: "text", group: "people" },
  { key: "setSentSparepartsByName", type: "text", group: "people" },
  { key: "repairByName", type: "text", group: "people" },
  { key: "repairByPhone", type: "text", group: "people" },
  { key: "verifiedByName", type: "text", group: "people" },
  { key: "thirdPartyRepairByName", type: "text", group: "people" },
  { key: "setCustomerRejectedByName", type: "text", group: "people" },
  { key: "setUnrepairableByName", type: "text", group: "people" },
  { key: "createBy", type: "text", group: "people" },
  { key: "inspectBy", type: "text", group: "people" },
  { key: "inspectingBy", type: "text", group: "people" },
  { key: "setAwaitingSparepartBy", type: "text", group: "people" },
  { key: "setAwaitingCustomerConfirmBy", type: "text", group: "people" },
  { key: "setSaleConfirmedBy", type: "text", group: "people" },
  { key: "setSentSparepartsBy", type: "text", group: "people" },
  { key: "repairBy", type: "text", group: "people" },
  { key: "verifiedBy", type: "text", group: "people" },
  { key: "thirdPartyRepairBy", type: "text", group: "people" },
  { key: "setCustomerRejectedBy", type: "text", group: "people" },
  { key: "setUnrepairableBy", type: "text", group: "people" },
];

/** statusId → the date column stamped when the ticket entered that status. */
const STATUS_ID_DATE_FIELD: Record<number, string> = {
  1: "serviceDate",
  2: "inspectDate",
  3: "awaitingCustomerConfirmDate",
  4: "awaitingSparepartDate",
  5: "repairDate",
  6: "finishedDate",
  7: "customerRejectedDate",
  8: "unrepairableDate",
  9: "thirdPartyRepairDate",
  10: "inspectDate",
  11: "saleConfirmedDate",
  12: "sentSparepartsDate",
};

/** Canonical status name (lowercase) → date field, used when statusId is missing. */
const STATUS_NAME_DATE_FIELD: Record<string, string> = {
  "item recieved": "serviceDate",
  "inspection": "inspectDate",
  "inspecting": "inspectDate",
  "awaiting customer confirm": "awaitingCustomerConfirmDate",
  "awaiting sparepart": "awaitingSparepartDate",
  "repairing": "repairDate",
  "finished": "finishedDate",
  "customer rejected": "customerRejectedDate",
  "unrepairable": "unrepairableDate",
  "repair by third-party": "thirdPartyRepairDate",
  "sale confirmed": "saleConfirmedDate",
  "sent spareparts": "sentSparepartsDate",
};

/**
 * Resolves the date a ticket entered its *current* status — e.g. Inspecting
 * → inspectDate, Repairing → repairDate. The printed "Date Waiting" row uses
 * it so the report reflects how far the ticket has actually progressed
 * instead of always showing (or hiding) the finish date. Falls back to
 * serviceDate (receive date) when the status-specific column has not been
 * stamped yet, or the status is unrecognised.
 */
export function getReportStatusDate(item?: ReportTicketLike | null): string | undefined {
  if (!item) return undefined;

  const byId = typeof item.statusId === "number" ? STATUS_ID_DATE_FIELD[item.statusId] : undefined;
  const field = byId ?? STATUS_NAME_DATE_FIELD[String(item.status ?? "").toLowerCase().trim()];

  const value = field ? asRecord(item)[field] : undefined;
  return (typeof value === "string" && value) || item.serviceDate || undefined;
}

/**
 * Whole days between the ticket's service date and its finish date (or today
 * while it is still open). Rejected and unrepairable tickets have no
 * meaningful duration and return null.
 */
export function calculateReportDaysTaken(item?: ReportTicketLike | null): number | null {
  if (!item || !item.serviceDate) return item?.daysTaken ?? null;

  const statusUpper = String(item.status ?? "").toUpperCase();
  if (
    item.statusId === 7 ||
    item.statusId === 8 ||
    statusUpper.includes("REJECT") ||
    statusUpper.includes("UNREPAIRABLE")
  ) {
    return null;
  }

  try {
    const start = new Date(item.serviceDate);
    start.setHours(0, 0, 0, 0);

    const end = item.finishedDate ? new Date(item.finishedDate) : new Date();
    end.setHours(0, 0, 0, 0);

    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
  } catch {
    return item.daysTaken ?? null;
  }
}
