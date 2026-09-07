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
  partNumber?: string;
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
  /** The machine model this part is linked to; all-zero GUID when none. */
  linkItemId?: string;
  // Classification — null/undefined until someone files the part.
  categoryId?: string | null;
  categoryName?: string | null;
  typeId?: string | null;
  typeName?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  brandLogoUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Spare-part taxonomy (Category → Type, Brand)
// ---------------------------------------------------------------------------

/**
 * What the create / update payloads carry as `classification`. Sending the
 * object at all means "set all three"; omitting it means "leave them alone"
 * (the phone app never sends it). `null` clears a field — never send `""`,
 * which the .NET body binder rejects as an invalid Guid.
 */
export interface SparePartClassification {
  categoryId: string | null;
  typeId: string | null;
  brandId: string | null;
}

export interface SparePartCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** Types under this category. */
  typeCount: number;
  /** Parts filed under this category. */
  partCount: number;
}

export interface SparePartType {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  sortOrder: number;
  partCount: number;
}

export interface SparePartBrand {
  id: string;
  /** Always upper-case; the API normalises and the DB enforces it. */
  name: string;
  logoUrl: string | null;
  partCount: number;
}

/** Field set a taxonomy form submits. `sortOrder` is ignored for brands. */
export interface SparePartTaxonomyInput {
  name: string;
  description?: string | null;
  sortOrder?: number;
  /** Types only. */
  categoryId?: string;
  /** Brands only. */
  logoUrl?: string | null;
}

/**
 * Outcome of a write the UI needs to explain, not just pass/fail. The API
 * answers ProblemDetails with a stable `code` — `duplicate`, `inUse`,
 * `constraint` — and, for "in use", the number of rows still pointing at the
 * record. A screen keys its message off `code`, never off `detail`.
 */
export type ApiWriteResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      status: number;
      code?: "duplicate" | "inUse" | "constraint" | "validation" | "notFound" | "network";
      detail?: string;
      count?: number;
    };

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
  verifiedByPhone?: string;
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
  serviceTypeId?: number;
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
 * Determines whether the spare parts section of a service ticket should be
 * locked (read-only, cannot add, remove or edit spare parts).
 *
 * Locked statuses:
 * - 1: Item Recieved
 * - 10: Inspecting (Note: Status 2 "Inspection" is UNLOCKED and editable!)
 * - 7: Customer Rejected
 * - 8: Unrepairable
 */
export function isSparepartLockedStatus(ticket?: RepairServiceItem | null): boolean {
  if (!ticket) return false;

  const sid = (ticket as any).statusId ?? (ticket as any)._serviceStatusId;
  if (typeof sid === "number") {
    // 1: Item Recieved, 7: Customer Rejected, 8: Unrepairable, 10: Inspecting
    // Note: statusId 2 is "Inspection" which is editable / unlocked!
    if (sid === 1 || sid === 7 || sid === 8 || sid === 10) {
      return true;
    }
  }

  const s = String(ticket.status || "").toLowerCase().trim();
  if (!s) return false;

  // 1: Item Recieved / Received
  if (
    s.includes("item rec") ||
    s.includes("received") ||
    s.includes("recieved") ||
    s.includes("បានទទួល") ||
    s.includes("ទើបទទួល")
  ) {
    return true;
  }

  // 10: Inspecting ONLY (strictly does NOT lock "inspection")
  if (
    s.includes("inspecting") ||
    s.includes("កំពុងពិនិត្យ") ||
    s.includes("កំពុងវិនិច្ឆ័យ")
  ) {
    return true;
  }

  // 7: Customer Rejected
  if (
    s.includes("reject") ||
    s.includes("បដិសេធ")
  ) {
    return true;
  }

  // 8: Unrepairable
  if (
    s.includes("unrepairable") ||
    s.includes("មិនអាចជួសជុល")
  ) {
    return true;
  }

  return false;
}

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
  goodCount?: number;
  criticalCount?: number;
  outOfStockCount?: number;
  totalAll?: number;
}

export interface CustomerTypeItem {
  listId: number;
  type: string;
  description?: string;
  isActive?: boolean;
}

export interface CustomerItem {
  id: string;
  companyName: string;
  contactName?: string;
  phoneNumber?: string;
  address?: string;
  customerType?: string;
  customerTypeListId?: number | null;
  isActive?: boolean;
}

export interface ItemModel {
  id: string;
  itemName: string;
  serialNumber?: string;
  itemType?: string;
}

/**
 * The dashboard stat tiles, as returned by
 * `GET /api/proxy/technicalservices/dashboard-stats` in a single round trip.
 * Mirrors the C# `DashboardStats` record in
 * `src/APIs/TechnicalService.API/Apis/PaginationModels.cs`.
 */
export interface DashboardStats {
  /** Tickets whose serviceDate is today. */
  todayCount: number;
  /** Tickets currently in status "Item Recieved" (the DB's spelling). */
  receivedCount: number;
  /** Tickets currently in status "Awaiting Customer Confirm". */
  waitingCustomerCount: number;
  /** Tickets currently in status "Awaiting Sparepart". */
  waitingSpareCount: number;
  /** Tickets currently in status "Finished", all time. */
  finishedCount: number;
  /** Tickets whose finishedDate falls in the current calendar month. */
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
