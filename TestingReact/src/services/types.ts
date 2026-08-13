/**
 * @file types.ts
 * @description Shared TypeScript interfaces and constants for the Service
 * Maintenance application. All API-related types live here so other modules
 * can import from a single, stable location.
 */

// ---------------------------------------------------------------------------
// Spare Parts
// ---------------------------------------------------------------------------

/**
 * A spare-part line item attached to a service ticket.
 * Matches the RepairServiceViewDialog SpareParts table columns.
 */
export interface SparePartItemDetail {
  id: string;
  sparePartId: string;
  itemName?: string;
  useFor?: string;
  /**
   * The line's own stored text, distinct from the catalog part's `itemName`.
   * Kept even when a row is enriched from the catalog, because saving a
   * ticket round-trips this value straight back into the Description column.
   */
  description?: string;
  /** How many units were used on this ticket */
  quantity: number;
  /** "Fix" | "New" | "Used" — see Condition ComboBox in InspectItemList.razor */
  condition?: string;
  remarks?: string;
  remarksUpdatedAt?: string;
  // Enriched from SparePartObject lookup:
  pictureUrl?: string;
  defaultPrice?: number;
  stockQuantity?: number;
}

/**
 * A spare part entry from the inventory (SparePartList.razor).
 * All properties use camelCase; the API returns mixed casing which is
 * normalised in the API layer before being stored here.
 */
export interface SparePartItem {
  id: string;
  partNumber?: string;
  serialNumber?: string;
  itemName?: string;
  useFor?: string;
  pictureUrl?: string;
  quantity?: number;
  defaultPrice?: number;
  description?: string;
  /** "In Stock" | "Low Stock" | "Out of Stock" | "CRITICAL" */
  status?: string;
}

// ---------------------------------------------------------------------------
// Service Tickets
// ---------------------------------------------------------------------------

/**
 * A full service/repair ticket as returned by the API.
 * Mirrors the RepairServices C# model.
 */
export interface RepairServiceItem {
  id: string;
  reportNo: string;

  // ── Audit Trail dates (optional — only present once each stage runs) ──────
  /** Receive date — ទទួលម៉ាស៊ីន */
  serviceDate: string;
  /** Inspection date — វិនិច្ឆ័យ */
  inspectDate?: string;
  /** Awaiting Spare date — រង់ចាំគ្រឿងបន្លាស់ */
  awaitingSparepartDate?: string;
  awaitingCustomerConfirmDate?: string;
  saleConfirmedDate?: string;
  /** Sent Spareparts date — បានបញ្ជូនបន្លាស់ */
  sentSparepartsDate?: string;
  /** Repair approved date — អនុម័តជួសជុល */
  repairDate?: string;
  thirdPartyRepairDate?: string;
  /** Finished date — រួចរាល់ */
  finishedDate?: string;
  /** Customer Rejected date — អតិថិជនមិនព្រម */
  customerRejectedDate?: string;
  /** Unrepairable date — ជួសជុលមិនបាន */
  unrepairableDate?: string;
  /** Duration in days — រយះពេល */
  daysTaken?: number;

  // ── "By" user GUIDs and attributions ──────────────────────────────────────
  createBy?: string;
  userId?: string;
  inspectBy?: string;
  inspectingBy?: string;
  setAwaitingCustomerConfirmBy?: string;
  setAwaitingSparepartBy?: string;
  setSaleConfirmedBy?: string;
  setSentSparepartsBy?: string;
  repairBy?: string;
  repairByUserName?: string;
  thirdPartyRepairBy?: string;
  verifiedBy?: string;
  setCustomerRejectedBy?: string;
  setUnrepairableBy?: string;

  createdByName?: string;
  createdByPhone?: string;
  inspectByName?: string;
  setAwaitingSparepartByName?: string;
  setAwaitingCustomerConfirmByName?: string;
  setSaleConfirmedByName?: string;
  setSentSparepartsByName?: string;
  repairByName?: string;
  repairByPhone?: string;
  thirdPartyRepairByName?: string;
  /** Who verified/finished — verifiedBy */
  verifiedByName?: string;
  setCustomerRejectedByName?: string;
  setUnrepairableByName?: string;

  // ── Customer Info ──────────────────────────────────────────────────────────
  customerId?: string;
  companyName: string;
  address: string;
  contactName?: string;
  phoneNumber: string;

  // ── Machine Info ───────────────────────────────────────────────────────────
  // Optional: unset until the user selects (or creates) a real item record —
  // see ServiceDetailModal's submit validation, which requires this before save.
  itemId?: string;
  servicePriorityId?: number;
  itemName: string;
  serialNumber: string;
  customerRequest?: string;
  inspection?: string;
  solution?: string;

  // ── Service / Repair Info ──────────────────────────────────────────────────
  serviceLocation: string;
  serviceType?: string;
  servicePriority: "LOW" | "NORMAL" | "HIGH" | string;
  status: string;
  statusId?: number;
  hasContract?: boolean;
  isThirdPartyRepair?: boolean;

  // ── Spare Parts sub-table ──────────────────────────────────────────────────
  sparePartItems?: SparePartItemDetail[];
  sparepartItems?: SparePartItemDetail[];
}

import { resolveUserNameSync } from "./userService";

/**
 * Computes DaysTaken matching RepairServices.cs C# domain logic:
 *
 * public int? DaysTaken => finishedDate.HasValue
 *   ? (int)(finishedDate.Value.Date - ServiceDate.Date).TotalDays
 *   : (Status == "Customer Rejected" || Status == "Unrepairable")
 *       ? null
 *       : (int)(DateTime.Today - ServiceDate.Date).TotalDays;
 */
export function calculateDaysTaken(item?: RepairServiceItem | null): number | null {
  if (!item || !item.serviceDate) return item?.daysTaken ?? null;

  const statusUpper = (item.status || "").toUpperCase();
  if (
    item.statusId === 7 ||
    item.statusId === 8 ||
    statusUpper.includes("REJECT") ||
    statusUpper.includes("UNREPAIRABLE")
  ) {
    return null;
  }

  try {
    const sDate = new Date(item.serviceDate);
    sDate.setHours(0, 0, 0, 0);

    if (item.finishedDate) {
      const fDate = new Date(item.finishedDate);
      fDate.setHours(0, 0, 0, 0);
      const diffMs = fDate.getTime() - sDate.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - sDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return item.daysTaken ?? null;
  }
}

/**
 * Helper function to retrieve the responsible user name based on ticket status / statusId
 * matching all 12 ServiceStatuses from the C# RepairServices model.
 */
export function getActionUserForStatus(item: RepairServiceItem): string {
  if (!item) return "—";

  const status = item.status?.toLowerCase() || "";
  const statusId = item.statusId;

  const getName = (nameField?: string, guidField?: string) => {
    if (nameField && nameField.trim()) return nameField.trim();
    if (guidField) {
      const resolved = resolveUserNameSync(guidField);
      if (resolved && resolved.trim()) return resolved.trim();
    }
    return "";
  };

  // Status 1: Item Received / Received Inventory / បានទទួលម៉ាស៊ីន
  if (
    statusId === 1 ||
    status.includes("reciev") ||
    status.includes("receiv") ||
    status.includes("ទទួល")
  ) {
    const val = getName(item.createdByName, item.createBy || item.userId);
    if (val) return val;
  }

  // Status 2: Inspection / Inspecting / វិនិច្ឆ័យ
  if (
    statusId === 2 ||
    statusId === 10 ||
    status.includes("inspect") ||
    status.includes("វិនិច្ឆ័យ")
  ) {
    const val = getName(item.inspectByName, item.inspectBy || item.inspectingBy) ||
                getName(item.createdByName, item.createBy || item.userId);
    if (val) return val;
  }

  // Status 3: Awaiting Customer Confirm
  if (
    statusId === 3 ||
    status.includes("awaiting customer") ||
    status.includes("confirm")
  ) {
    const val = getName(item.setAwaitingCustomerConfirmByName, item.setAwaitingCustomerConfirmBy) ||
                getName(item.inspectByName, item.inspectBy);
    if (val) return val;
  }

  // Status 4: Awaiting Sparepart
  if (
    statusId === 4 ||
    status.includes("awaiting sparepart") ||
    status.includes("sparepart")
  ) {
    const val = getName(item.setAwaitingSparepartByName, item.setAwaitingSparepartBy) ||
                getName(item.inspectByName, item.inspectBy);
    if (val) return val;
  }

  // Status 5: Repairing / Approve Repairing
  if (
    statusId === 5 ||
    status.includes("repairing") ||
    status.includes("repair")
  ) {
    const val = getName(item.repairByName || item.repairByUserName, item.repairBy) ||
                getName(item.inspectByName, item.inspectBy);
    if (val) return val;
  }

  // Status 6: Finished
  if (statusId === 6 || status.includes("finish")) {
    const val = getName(item.verifiedByName, item.verifiedBy) ||
                getName(item.repairByName || item.repairByUserName, item.repairBy) ||
                getName(item.createdByName, item.createBy);
    if (val) return val;
  }

  // Status 7: Customer Rejected
  if (statusId === 7 || status.includes("reject")) {
    const val = getName(item.setCustomerRejectedByName, item.setCustomerRejectedBy);
    if (val) return val;
  }

  // Status 8: Unrepairable
  if (statusId === 8 || status.includes("unrepairable")) {
    const val = getName(item.setUnrepairableByName, item.setUnrepairableBy);
    if (val) return val;
  }

  // Status 9: Repair by Third-Party
  if (statusId === 9 || status.includes("third-party") || status.includes("third party")) {
    const val = getName(item.thirdPartyRepairByName, item.thirdPartyRepairBy) ||
                getName(item.repairByName, item.repairBy);
    if (val) return val;
  }

  // Status 11: Sale Confirmed
  if (statusId === 11 || status.includes("sale confirmed") || status.includes("sale")) {
    const val = getName(item.setSaleConfirmedByName, item.setSaleConfirmedBy);
    if (val) return val;
  }

  // Status 12: Sent Spareparts
  if (statusId === 12 || status.includes("sent spareparts")) {
    const val = getName(item.setSentSparepartsByName, item.setSentSparepartsBy);
    if (val) return val;
  }

  // Fallbacks: check all known user fields sequentially
  return (
    getName(item.createdByName, item.createBy || item.userId) ||
    getName(item.inspectByName, item.inspectBy) ||
    getName(item.repairByName || item.repairByUserName, item.repairBy) ||
    getName(item.verifiedByName, item.verifiedBy) ||
    "—"
  );
}

/** statusId → the date field stamped when a ticket entered that status. */
const STATUS_ID_DATE_FIELD: Partial<Record<number, keyof RepairServiceItem>> = {
  1:  "serviceDate",
  2:  "inspectDate",
  3:  "awaitingCustomerConfirmDate",
  4:  "awaitingSparepartDate",
  5:  "repairDate",
  6:  "finishedDate",
  7:  "customerRejectedDate",
  8:  "unrepairableDate",
  9:  "thirdPartyRepairDate",
  10: "inspectDate",
  11: "saleConfirmedDate",
  12: "sentSparepartsDate",
};

/** Canonical status name (lowercase) → date field, used when statusId is missing. */
const STATUS_NAME_DATE_FIELD: Record<string, keyof RepairServiceItem> = {
  "item recieved":              "serviceDate",
  "inspection":                 "inspectDate",
  "inspecting":                 "inspectDate",
  "awaiting customer confirm":  "awaitingCustomerConfirmDate",
  "awaiting sparepart":         "awaitingSparepartDate",
  "repairing":                  "repairDate",
  "finished":                   "finishedDate",
  "customer rejected":          "customerRejectedDate",
  "unrepairable":                "unrepairableDate",
  "repair by third-party":      "thirdPartyRepairDate",
  "sale confirmed":             "saleConfirmedDate",
  "sent spareparts":            "sentSparepartsDate",
};

/**
 * Resolves the date a ticket entered its *current* status — e.g. Inspecting
 * → inspectDate, Repairing → repairDate. Used by the print report's
 * "Date Waiting" row so it reflects how far the ticket has actually
 * progressed instead of always showing (or hiding) the finish date.
 * Falls back to serviceDate (receive date) if the status-specific field
 * hasn't been stamped yet, or the status is unrecognised.
 */
export function getStatusDate(item?: RepairServiceItem | null): string | undefined {
  if (!item) return undefined;

  const field =
    (item.statusId !== undefined ? STATUS_ID_DATE_FIELD[item.statusId] : undefined) ??
    STATUS_NAME_DATE_FIELD[(item.status || "").toLowerCase().trim()];

  const value = field ? (item[field] as string | undefined) : undefined;
  return value || item.serviceDate;
}

// ---------------------------------------------------------------------------
// Reference Data
// ---------------------------------------------------------------------------

/** A status entry from the ServiceStatuses DB table */
export interface ServiceStatusDbItem {
  id: number;
  name: string;
}

/**
 * All service statuses ordered by their database ID.
 * Used to populate the Status dropdown in ServiceDetailModal edit mode.
 */
export const SERVICE_STATUSES_DB: ServiceStatusDbItem[] = [
  { id: 1,  name: "Item Recieved" },
  { id: 2,  name: "Inspection" },
  { id: 3,  name: "Awaiting Customer Confirm" },
  { id: 4,  name: "Awaiting Sparepart" },
  { id: 5,  name: "Repairing" },
  { id: 6,  name: "Finished" },
  { id: 7,  name: "Customer Rejected" },
  { id: 8,  name: "Unrepairable" },
  { id: 9,  name: "Repair by Third-Party" },
  { id: 10, name: "Inspecting" },
  { id: 11, name: "Sale Confirmed" },
  { id: 12, name: "Sent Spareparts" },
];

/**
 * Formats a time as 24-hour digits with an AM/PM label still appended
 * (e.g. "13:17 PM"), matching how this app's users read a timestamp — not a
 * standard clock convention, so there is no Intl option for it and it must
 * be built by hand rather than via toLocaleTimeString.
 */
export function formatTime24HourWithAmPm(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours < 12 ? "AM" : "PM";
  return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
}

/**
 * Service priorities, ids and names exactly as the C# ServicePriority
 * enumeration defines them. The ids are NOT in severity order — Low is 1 and
 * High is 3 — and the API returns the names in title case, so always resolve
 * through here rather than assuming an ordering or a casing.
 */
export const SERVICE_PRIORITIES: { id: number; name: string }[] = [
  { id: 1, name: "Low" },
  { id: 2, name: "Normal" },
  { id: 3, name: "High" },
];

/** Resolves a priority name in any casing to its backend id. */
export function getServicePriorityId(name?: string | null): number | undefined {
  if (!name) return undefined;
  const target = name.trim().toLowerCase();
  return SERVICE_PRIORITIES.find((p) => p.name.toLowerCase() === target)?.id;
}

/** Normalises a priority name in any casing to the backend's spelling. */
export function normaliseServicePriority(name?: string | null): string {
  if (!name) return "Normal";
  const target = name.trim().toLowerCase();
  return SERVICE_PRIORITIES.find((p) => p.name.toLowerCase() === target)?.name ?? "Normal";
}

/**
 * Formats a Date the way this backend stores DateTimes: local Phnom Penh
 * wall-clock, with no timezone marker (`2026-08-12T10:44:00`).
 *
 * The API writes every timestamp as `DateTime.UtcNow.AddHours(7)` and returns
 * it unmarked, so a value sent as UTC (`toISOString()`) lands in the database
 * seven hours behind what the user actually picked, and every reader in this
 * app — which parses unmarked strings as local time — then shows the shifted
 * value. Send times through here instead.
 */
export function toBackendLocalDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Service location options matching the C# Location enum */
export const SERVICE_LOCATIONS = [
  "CompanyService",
  "OnSite",
] as const;

export type ServiceLocation = (typeof SERVICE_LOCATIONS)[number];

// ---------------------------------------------------------------------------
// API Response shapes
// ---------------------------------------------------------------------------

/** Generic paginated response envelope from the backend */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomerItem {
  id: string;
  companyName: string;
  contactName?: string;
  phoneNumber?: string;
  address?: string;
  customerType?: string;
  isActive?: boolean;
}

export interface ItemModel {
  id: string;
  itemName: string;
  serialNumber?: string;
  itemType?: string;
}

export interface DashboardStats {
  todayCount: number;
  receivedCount: number;
  waitingCustomerCount: number;
  waitingSpareCount: number;
  finishedThisMonthCount: number;
}

export interface LoginResponse {
  isSuccess: boolean;
  message?: string;
  token?: string;
  refreshToken?: string;
  user?: {
    id: string;
    userName: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
}
