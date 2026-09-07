/**
 * @file validation/taxonomy.ts
 * @description Rules for the spare-part Category / Type / Brand lookups and
 * for the classification fields on a spare part (added 2026-09-05).
 *
 * Same folder rules as the rest of `validation/`: plain TypeScript, no
 * framework imports, mirrored into the CamID app by `npm run sync:shared`.
 * Split out of `forms.ts` so that file stays near the 300-line limit.
 *
 * Uniqueness is deliberately NOT checked here — only the server can see every
 * other row, and it answers 409 `duplicate`.
 */

import { Failures, PORTAL_MESSAGES, type ValidationResult } from "./forms";

/**
 * Column width of `SparepartCategories.Name`, `SparepartTypes.Name` and
 * `SparepartBrands.Name` (`sql/sparepart-taxonomy.sql`). The API rejects
 * longer names with a 400; checking here is what lets the form say so before
 * the round trip.
 */
export const TAXONOMY_NAME_MAX_LENGTH = 100;

/**
 * Column width of the three `Description` columns (same script). Not a
 * validation rule here — the forms cap the textarea with it, and the API
 * enforces it — but defined once so the two widths live beside each other.
 */
export const TAXONOMY_DESCRIPTION_MAX_LENGTH = 500;

const NULL_GUID = "00000000-0000-0000-0000-000000000000";

/**
 * A GUID field that actually names a row — not empty, not the all-zero
 * placeholder an unset `<select>` sends. Shared with `validateSparePart`.
 */
export function isSetId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.trim().length > 0 && id !== NULL_GUID;
}

/** Required, trimmed, capped at the column width. */
function addNameRules(f: Failures, name: string | undefined): void {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    f.add("name", "nameRequired", PORTAL_MESSAGES.nameRequired);
  } else if (trimmed.length > TAXONOMY_NAME_MAX_LENGTH) {
    f.add("name", "nameTooLong", PORTAL_MESSAGES.nameTooLong(TAXONOMY_NAME_MAX_LENGTH), {
      max: String(TAXONOMY_NAME_MAX_LENGTH),
    });
  }
}

/** Spare-part Category name. */
export function validateTaxonomyName(data: { name?: string }): ValidationResult {
  const f = new Failures();
  addNameRules(f, data.name);
  return f.result();
}

/** Spare-part Type — a name inside a category. */
export function validateTaxonomyType(data: { name?: string; categoryId?: string | null }): ValidationResult {
  const f = new Failures();
  addNameRules(f, data.name);
  if (!isSetId(data.categoryId)) {
    f.add("categoryId", "typeRequiresCategory", PORTAL_MESSAGES.typeRequiresCategory);
  }
  return f.result();
}

/**
 * Spare-part Brand — name in capitals (`SparepartTaxonomyRules.NormalizeBrandName`
 * and the `CK_SparepartBrands_Name_Upper` CHECK both enforce this), optional
 * logo as an absolute http(s) URL.
 *
 * The case rule compares against `toUpperCase()`, so scripts without case
 * (Khmer) pass unchanged — the same thing the server does.
 */
export function validateBrand(data: { name?: string; logoUrl?: string | null }): ValidationResult {
  const f = new Failures();
  addNameRules(f, data.name);

  const name = data.name?.trim() ?? "";
  if (name && name.length <= TAXONOMY_NAME_MAX_LENGTH && name !== name.toUpperCase()) {
    f.add("name", "brandNameUppercase", PORTAL_MESSAGES.brandNameUppercase);
  }

  const logo = data.logoUrl?.trim() ?? "";
  if (logo && !isAbsoluteHttpUrl(logo)) {
    f.add("logoUrl", "logoUrlInvalid", PORTAL_MESSAGES.logoUrlInvalid);
  }

  return f.result();
}

/** `http://` or `https://` followed by a host — no `javascript:`, no relative path. */
function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value);
}
