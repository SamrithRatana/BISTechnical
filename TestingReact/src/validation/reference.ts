/**
 * @file validation/reference.ts
 * @description The backend reference values the rules in this folder compare
 * against.
 *
 * See `stockShortage.ts` for the rules this folder lives by.
 *
 * Both platforms already carry an id-bearing `SERVICE_STATUSES_DB` — the web in
 * `services/types.ts`, the phone in `services/portalDomain.ts` — because both
 * need the ids to build request payloads. Nothing is duplicated here that a
 * rule does not actually read: a status-name list lived here briefly and no
 * rule ever consumed it, which is three copies of one table and no way to tell
 * which was authoritative.
 */

/** The `ServiceTypes` table. A ticket is either free of charge or billed. */
export const SERVICE_TYPE_IDS: Readonly<Record<string, number>> = { Free: 1, Charge: 2 };

/**
 * Whether a ticket is billed, under any of the three ways that is recorded.
 *
 * The id is authoritative, but tickets written by older code carry only the
 * name — and it appears in English and in Khmer, which is why both spellings
 * are checked rather than just the id.
 */
export function isChargeService(serviceType?: string | null, serviceTypeId?: number | null): boolean {
  if (serviceTypeId === SERVICE_TYPE_IDS.Charge) return true;
  const name = String(serviceType ?? "");
  return name.toLowerCase().includes("charge") || name.includes("គិតលុយ");
}
