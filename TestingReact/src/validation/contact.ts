/**
 * @file validation/contact.ts
 * @description Phone and email format checks.
 *
 * See `stockShortage.ts` for the rules this folder lives by — plain TypeScript,
 * no framework imports, mirrored into the CamID app by `npm run sync:shared`.
 *
 * These regexes were the CamID app's (`services/validator.ts`) and existed
 * nowhere on the web, so a phone number the phone refused was accepted by the
 * desktop and written to the same record. They live here now and both platforms
 * read them.
 */

/** Deliberately permissive: `x@y.z` with no whitespace. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cambodian mobile/landline, with or without the +855 country code. */
const CAMBODIAN_PHONE = /^(\+?855|0)[1-9]\d{7,8}$/;

/** Any plausible international number, for customers who are not in Cambodia. */
const INTERNATIONAL_PHONE = /^\+?\d{8,15}$/;

/**
 * The strings this system writes where a value is absent.
 *
 * `services/api.ts` and the phone's `portalCustomerApi` both normalise a
 * missing phone, contact name or address to an em dash so the TABLE has
 * something to render — and that placeholder is then loaded straight back into
 * the edit form. Treating it as real input made every customer with no phone
 * number permanently unsaveable, with a format error the user could only clear
 * by deleting a character they never typed.
 *
 * `N/A` and friends are here for the same reason: they are what staff type into
 * a free-text column meaning "there isn't one".
 */
const ABSENT = new Set(["", "-", "--", "—", "–", "n/a", "na", "n.a.", "none", "null", "undefined", "."]);

/**
 * Whether a value means "no value" — genuinely empty, or one of the
 * placeholders above.
 *
 * Every OPTIONAL field's format check goes through this first. A required
 * field is a different question and keeps its own `.trim()` test, because
 * `"N/A"` is a bad company name but it is not a *missing* one.
 */
export function isAbsent(value: string | null | undefined): boolean {
  return ABSENT.has(String(value ?? "").trim().toLowerCase());
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL.test(String(email).trim());
}

/**
 * Accepts a Cambodian number in any of the ways staff actually type one —
 * `012 345 678`, `012-345-678`, `+855 12 345 678` — as well as a plain
 * international number. Separators are stripped before matching rather than
 * being written into the pattern, which is why `(012) 345-678` also passes.
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = String(phone).replace(/[\s\-()]/g, "");
  return CAMBODIAN_PHONE.test(cleaned) || INTERNATIONAL_PHONE.test(cleaned);
}
