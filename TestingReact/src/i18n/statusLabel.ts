/**
 * @file statusLabel.ts
 * @description Maps a backend ticket-status string to its translation key.
 *
 * Status values arrive from the API as English prose ("Awaiting Customer
 * Confirm") and are also used as *identity* all over the app — compared in
 * `RenderStatusSelect`, posted back in `updateServiceStatus`, keyed on in
 * `STATUS_EVENT_MAP`. So the raw string must stay untranslated in state and
 * on the wire; only what the user reads goes through here.
 *
 * The lookup is normalised (lowercased, whitespace-collapsed) because the
 * same status reaches the UI spelled several ways: the DB row is the
 * long-standing misspelling "Item Recieved", `getDbStatusMapping` and the
 * page filters use "Received", and older tickets carry "Item Received".
 */

import type { TranslationKey } from "./en";

const STATUS_KEYS: Record<string, TranslationKey> = {
  // Received — three spellings in circulation, one label.
  "item recieved": "status.received",
  "item received": "status.received",
  received: "status.received",

  inspecting: "status.inspecting",
  inspection: "status.inspection",
  "awaiting customer confirm": "status.awaitingCustomerConfirm",
  awaitingcustomerconfirm: "status.awaitingCustomerConfirm",
  "awaiting sparepart": "status.awaitingSparepart",
  awaitingsparepart: "status.awaitingSparepart",
  "sale confirmed": "status.saleConfirmed",
  "sent spareparts": "status.sentSpareparts",
  repairing: "status.repairing",
  finished: "status.finished",
  "customer rejected": "status.customerRejected",
  unrepairable: "status.unrepairable",
  "repair by third-party": "status.thirdParty",
  "repair by third party": "status.thirdParty",
  "third-party": "status.thirdParty",
};

/**
 * Returns the translation key for a status, or null when the status is
 * unrecognised — callers then fall back to showing the raw string rather
 * than a blank cell, so an unmapped status stays diagnosable in the UI.
 */
export function statusTranslationKey(status?: string | null): TranslationKey | null {
  if (!status) return null;
  const normalised = status.trim().toLowerCase().replace(/\s+/g, " ");
  return STATUS_KEYS[normalised] ?? null;
}

/** Convenience wrapper: translate a status, falling back to the raw string. */
export function translateStatus(
  status: string | null | undefined,
  t: (key: TranslationKey) => string
): string {
  const key = statusTranslationKey(status);
  return key ? t(key) : (status ?? "");
}

// Priority reaches the UI in mixed case ("HIGH" from the table's own default,
// "High" from SERVICE_PRIORITIES), so this normalises the same way.
const PRIORITY_KEYS: Record<string, TranslationKey> = {
  low: "value.low",
  normal: "value.normal",
  high: "value.high",
};

/** Translate a service priority, falling back to the raw string. */
export function translatePriority(
  priority: string | null | undefined,
  t: (key: TranslationKey) => string
): string {
  if (!priority) return "";
  const key = PRIORITY_KEYS[priority.trim().toLowerCase()];
  return key ? t(key) : priority;
}

// Service type is the backend's billing flag; location is the C# enum.
const SERVICE_TYPE_KEYS: Record<string, TranslationKey> = {
  free: "value.free",
  charge: "value.charge",
};

const SERVICE_LOCATION_KEYS: Record<string, TranslationKey> = {
  companyservice: "value.companyService",
  "company service": "value.companyService",
  onsite: "value.onSite",
  "on site": "value.onSite",
};

/** Translate a service type (Free/Charge), falling back to the raw string. */
export function translateServiceType(
  serviceType: string | null | undefined,
  t: (key: TranslationKey) => string
): string {
  if (!serviceType) return "";
  const key = SERVICE_TYPE_KEYS[serviceType.trim().toLowerCase()];
  return key ? t(key) : serviceType;
}

/** Translate a service location, falling back to the raw string (always CompanyService or OnSite). */
export function translateServiceLocation(
  location: string | null | undefined,
  t?: (key: TranslationKey) => string
): string {
  if (!location) return "";
  const norm = location.trim().toLowerCase();
  if (norm.includes("onsite") || norm.includes("on-site") || norm.includes("on site") || norm.includes("ក្រៅ") || norm.includes("កន្លែង")) {
    return "OnSite";
  }
  return "CompanyService";
}
