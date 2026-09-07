/**
 * @file i18n/validationMessage.ts
 * @description Renders a shared validation failure in the user's language.
 *
 * The rules live in `src/validation`, which is mirrored into the CamID app and
 * therefore cannot import this project's `i18n`. It returns a stable
 * `ValidationCode` per failed field; this is the one place that turns a code
 * into a sentence for the web. The phone renders `result.errors` directly.
 */

import type { TranslationKey } from "@/i18n/translations";
import type { ValidationCode, ValidationResult } from "@/validation";

/**
 * Every code maps to a key, and the `Record` is exhaustive — adding a rule to
 * `src/validation/forms.ts` without a translation is a compile error here
 * rather than an untranslated string in front of a user.
 */
const KEYS: Record<ValidationCode, TranslationKey> = {
  companyNameRequired: "validation.companyNameRequired",
  contactNameRequired: "validation.contactNameRequired",
  phoneRequired: "validation.phoneRequired",
  addressRequired: "validation.addressRequired",
  itemNameRequired: "validation.itemNameRequired",
  serialRequired: "validation.serialRequired",
  selectItemFirst: "validation.selectItemFirst",
  partNameRequired: "validation.partNameRequired",
  partNumberRequired: "validation.partNumberRequired",
  quantityNegative: "validation.quantityNegative",
  priceNegative: "validation.priceNegative",
  stockInMin: "validation.stockInMin",
  stockOutMin: "validation.stockOutMin",
  stockOutExceeds: "validation.stockOutExceeds",
  stockOutReasonRequired: "validation.stockOutReasonRequired",
  phoneInvalid: "validation.phoneInvalid",
  emailInvalid: "validation.emailInvalid",
  customerRequestRequired: "validation.customerRequestRequired",
  inspectionRequired: "validation.inspectionRequired",
  partQuantityMin: "validation.partQuantityMin",
  currentPasswordRequired: "validation.currentPasswordRequired",
  passwordTooShort: "validation.passwordTooShort",
  passwordMismatch: "validation.passwordMismatch",
  nameRequired: "validation.nameRequired",
  nameTooLong: "validation.nameTooLong",
  brandNameUppercase: "validation.brandNameUppercase",
  logoUrlInvalid: "validation.logoUrlInvalid",
  typeRequiresCategory: "validation.typeRequiresCategory",
};

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** The translated message for one field, or `null` when that field passed. */
export function validationMessage(
  result: ValidationResult,
  field: string,
  t: Translate,
): string | null {
  const code = result.codes[field];
  if (!code) return null;

  const key = KEYS[code];
  const translated = t(key, result.params[field]);
  // `t` falls back to the key itself when a dictionary entry is missing, so a
  // gap would put "validation.foo" in front of a user rather than an empty
  // string. The shared module's own English sentence is a better last resort.
  // (Unreachable today — `KEYS` is exhaustive and both dictionaries are
  // complete — but the alternative reads as a safety net and is not one.)
  return translated === key ? result.errors[field] : translated;
}

/**
 * The first failure, for a form that reports through a single toast.
 *
 * Field order follows insertion order, which is the order the rules are written
 * in — so the message a user sees first is the one the rule author considered
 * most fundamental (a missing company name before a malformed phone number).
 */
export function firstValidationMessage(result: ValidationResult, t: Translate): string {
  const field = Object.keys(result.codes)[0];
  return field ? (validationMessage(result, field, t) ?? "") : "";
}
