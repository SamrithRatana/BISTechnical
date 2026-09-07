/**
 * @file validation/forms.ts
 * @description Every form rule the two platforms must agree on — ticket intake,
 * customers, item models, spare parts, stock movements and the inspection form.
 *
 * See `stockShortage.ts` for the rules this folder lives by: plain TypeScript,
 * no framework imports, mirrored into the CamID app by `npm run sync:shared`.
 *
 * ── WHY THIS MOVED HERE ───────────────────────────────────────────────────
 * This started life as the phone's `services/portalValidation.ts`, whose own
 * header said it "reproduces" the web's rules. Reproducing a rule is how two
 * copies of it start disagreeing, and they already had: the phone refused a
 * spare part with no serial number and a malformed phone number, the desktop
 * accepted both and wrote them to the same rows. The functions are unchanged;
 * what changed is that there is now one copy and both platforms call it.
 *
 * ── MESSAGES AND CODES ────────────────────────────────────────────────────
 * Every failure carries a `code` as well as a message. The message is English
 * (or Khmer, where the business wording is Khmer) and is what the phone shows
 * directly; the web maps the code to its own `i18n` key so a Khmer desktop user
 * reads Khmer. Neither platform decides WHETHER a field is invalid — only how
 * to say so.
 */

import { isAbsent, isValidEmail, isValidPhone } from "./contact";
import { isSetId } from "./taxonomy";

/** A field name mapped to the reason it was refused. */
export interface ValidationResult {
  isValid: boolean;
  /** Field → human-readable message. What the phone renders. */
  errors: Record<string, string>;
  /** Field → stable code. What the web translates. */
  codes: Record<string, ValidationCode>;
  /**
   * Field → the values interpolated into its message, for the two rules that
   * quote one back (`unrecognisedStatus`, `stockOutExceeds`). A platform that
   * translates needs these, because it renders its own sentence rather than the
   * one in `errors`.
   */
  params: Record<string, Record<string, string>>;
}

/**
 * The stable identity of each rule.
 *
 * A screen keys its translated wording off this, so rephrasing a message never
 * silently breaks a translation lookup, and a new rule without a mapping is a
 * compile error on the platform that translates.
 */
export type ValidationCode =
  | "companyNameRequired"
  | "contactNameRequired"
  | "phoneRequired"
  | "addressRequired"
  | "itemNameRequired"
  | "serialRequired"
  | "selectItemFirst"
  | "partNameRequired"
  | "partNumberRequired"
  | "quantityNegative"
  | "priceNegative"
  | "stockInMin"
  | "stockOutMin"
  | "stockOutExceeds"
  | "stockOutReasonRequired"
  | "phoneInvalid"
  | "emailInvalid"
  | "customerRequestRequired"
  | "inspectionRequired"
  | "partQuantityMin"
  | "currentPasswordRequired"
  | "passwordTooShort"
  | "passwordMismatch"
  | "nameRequired"
  | "nameTooLong"
  | "brandNameUppercase"
  | "logoUrlInvalid"
  | "typeRequiresCategory";

/**
 * The one place a validation message is written.
 *
 * The web relies on the browser's native "Please fill out this field" for
 * `required` inputs, which React Native has no equivalent of — these say the
 * same thing in words, on both platforms.
 */
export const PORTAL_MESSAGES = {
  companyNameRequired: "Company name is required.",
  contactNameRequired: "Contact person is required.",
  phoneRequired: "Phone number is required.",
  addressRequired: "Address is required.",
  itemNameRequired: "Item / model name is required.",
  serialRequired: "Serial number is required.",
  selectItemFirst:
    "Select an item model from the list before saving, so the ticket links to a real machine.",
  partNameRequired: "Component name is required.",
  partNumberRequired: "Part number is required.",
  quantityNegative: "Stock quantity cannot be negative.",
  priceNegative: "Unit price must be 0 or greater.",
  stockInMin: "Stock-in quantity must be at least 1.",
  stockOutMin: "Stock-out quantity must be at least 1.",
  stockOutExceeds: (available: number) => `Only ${available} in stock — reduce the quantity.`,
  stockOutReasonRequired: "State a reason for the stock-out.",
  phoneInvalid: "Enter a valid phone number (e.g. 012 345 678).",
  emailInvalid: "Please enter a valid email address.",
  customerRequestRequired: "Describe the fault or customer request.",
  inspectionRequired: "Inspection and Solution are both required before saving.",
  duplicatePart: (name: string) =>
    `“${name}” is already in the list — adjust its quantity instead of adding it again.`,
  partQuantityMin: "Each spare part line needs a quantity of at least 1.",
  currentPasswordRequired: "Enter your current password.",
  passwordTooShort: (min: number) => `New password must be at least ${min} characters.`,
  passwordMismatch: "The two passwords do not match.",
  nameRequired: "Name cannot be empty.",
  nameTooLong: (max: number) => `Name cannot exceed ${max} characters.`,
  brandNameUppercase: "Brand names are written in capital letters (e.g. HP, CANON).",
  logoUrlInvalid: "Logo must be a full http(s) link.",
  typeRequiresCategory: "Choose a category before choosing a type.",
  cannotApproveCharge: (ref?: string) =>
    `${ref ? ref + ": " : ""}អ្នកមិនអាច អនុម័តបានទេ ព្រោះជា Service Charge ត្រូវបញ្ជូនទៅផ្នែកទីផ្សារ Confirm (Sale Confirmed) ជាមុនសិនទើបអាចអនុម័តបាន`,
  cannotApproveSpareParts: (ref?: string) =>
    `${ref ? ref + ": " : ""}មិនអាចអនុម័តជា 'ជួសជុលបាន' បានទេ ព្រោះ Service នេះជា Charge ដែលមានគ្រឿងបន្លាស់។ ត្រូវរង់ចាំផ្នែកស្តុកបញ្ជូនគ្រឿងបន្លាស់ (Sent Spareparts) ជាមុនសិន`,
  cannotSendSparePartsCharge:
    "មិនអាចបញ្ជូនបានទេ ព្រោះជា Service Charge ត្រូវបញ្ជូនទៅផ្នែកទីផ្សារ Confirm ជាមុនសិន",
  cannotApproveFreeWithSpareParts: (ref?: string) =>
    `${ref ? ref + ": " : ""}មិនអាចអនុម័តជួសជុលបានទេ ព្រោះជា Service Free ដែលមានគ្រឿងបន្លាស់។ ត្រូវរង់ចាំផ្នែកស្តុកបញ្ជូនគ្រឿងបន្លាស់ (Sent Spareparts) ជាមុនសិន`,
} as const;

/**
 * Accumulates failures so a form can show every problem at once, not the first.
 * Exported for the sibling rule files in this folder (`taxonomy.ts`); it is not
 * part of the barrel's public surface.
 */
export class Failures {
  readonly errors: Record<string, string> = {};
  readonly codes: Record<string, ValidationCode> = {};
  readonly params: Record<string, Record<string, string>> = {};

  add(field: string, code: ValidationCode, message: string, params?: Record<string, string>): void {
    // First failure on a field wins. No rule set currently relies on this to
    // arbitrate — where two rules share a field (`validateStockOut`'s quantity)
    // they are mutually exclusive by an explicit `else if`, which is what makes
    // the ordering readable at the call site instead of hiding here. This is a
    // guard against a future second writer, not a mechanism in use; do NOT
    // "simplify" that `else if` into two `if`s on the strength of it.
    if (this.errors[field] !== undefined) return;
    this.errors[field] = message;
    this.codes[field] = code;
    if (params) this.params[field] = params;
  }

  result(): ValidationResult {
    return {
      isValid: Object.keys(this.errors).length === 0,
      errors: this.errors,
      codes: this.codes,
      params: this.params,
    };
  }
}

/**
 * Ticket intake / edit — mirrors `ServiceDetailModal.handleSubmit`.
 *
 * `itemId` is checked because the backend links a ticket to a real Item row via
 * a foreign key: there is no valid "unknown item" value, and sending a
 * fabricated id would either fail server-side or mislink the ticket to the
 * wrong machine.
 */
export function validateTicket(data: {
  companyName?: string;
  contactName?: string;
  phoneNumber?: string;
  address?: string;
  itemName?: string;
  serialNumber?: string;
  itemId?: string;
  /**
   * Skips the `itemId` rule for a form that resolves-or-creates the Item row
   * only after the rest of the fields pass — the CamID intake form does. It is
   * an explicit opt-out rather than a placeholder id, because a fake id passes
   * the rule and makes it permanently unreachable on that screen.
   */
  skipItemId?: boolean;
  customerRequest?: string;
  /**
   * Whether this is a new ticket or an edit of an existing one.
   * Defaults to `"create"`, the stricter of the two.
   */
  mode?: "create" | "edit";
}): ValidationResult {
  const f = new Failures();

  if (!data.companyName?.trim()) f.add("companyName", "companyNameRequired", PORTAL_MESSAGES.companyNameRequired);

  // Contact person, phone number and address are optional (may be empty depending on company).
  // If phone number is filled in, check that its format is valid.
  if (!isAbsent(data.phoneNumber) && !isValidPhone(data.phoneNumber)) {
    f.add("phoneNumber", "phoneInvalid", PORTAL_MESSAGES.phoneInvalid);
  }

  if (!data.itemName?.trim()) f.add("itemName", "itemNameRequired", PORTAL_MESSAGES.itemNameRequired);
  if (!data.serialNumber?.trim()) f.add("serialNumber", "serialRequired", PORTAL_MESSAGES.serialRequired);
  if (!data.skipItemId && !data.itemId?.trim()) {
    f.add("itemId", "selectItemFirst", PORTAL_MESSAGES.selectItemFirst);
  }

  // A ticket booked in with no fault text is unusable to the technician who
  // picks it up, so intake requires it.
  if ((data.mode ?? "create") === "create" && !data.customerRequest?.trim()) {
    f.add("customerRequest", "customerRequestRequired", PORTAL_MESSAGES.customerRequestRequired);
  }

  return f.result();
}

/**
 * Customer create / edit — mirrors `app/customers/page.tsx`.
 *
 * Only `companyName` is required, exactly as on the web. Phone and email are
 * optional; when the user does type one, its format is checked — the web
 * accepted anything, which let an unreachable number reach the record.
 */
export function validatePortalCustomer(data: {
  companyName?: string;
  contactName?: string;
  phoneNumber?: string;
}): ValidationResult {
  const f = new Failures();

  if (!data.companyName?.trim()) f.add("companyName", "companyNameRequired", PORTAL_MESSAGES.companyNameRequired);

  // `isAbsent`, not `.trim()`: both platforms store a missing phone as an em
  // dash so the table has something to draw, and load that straight back into
  // the edit form. See `contact.ts` — reading it as input made every customer
  // with no phone number unsaveable.
  if (!isAbsent(data.phoneNumber) && !isValidPhone(data.phoneNumber)) {
    f.add("phoneNumber", "phoneInvalid", PORTAL_MESSAGES.phoneInvalid);
  }

  return f.result();
}

/** Item model create / edit — mirrors `app/received-inventory/page.tsx`. */
export function validateItemModel(data: { itemName?: string; serialNumber?: string }): ValidationResult {
  const f = new Failures();

  if (!data.itemName?.trim()) f.add("itemName", "itemNameRequired", PORTAL_MESSAGES.itemNameRequired);
  if (!data.serialNumber?.trim()) f.add("serialNumber", "serialRequired", PORTAL_MESSAGES.serialRequired);

  return f.result();
}

/**
 * Spare part create / edit — mirrors the `required` and `min` attributes on
 * `app/spareparts/page.tsx`, and the domain invariants in `Sparepart.cs`
 * (`Quantity cannot be negative`, price never below zero).
 */
export function validateSparePart(data: {
  itemName?: string;
  serialNumber?: string;
  quantity?: number;
  defaultPrice?: number;
  /** Classification selects — optional on both platforms, but a type only means something inside its category. */
  categoryId?: string | null;
  typeId?: string | null;
}): ValidationResult {
  const f = new Failures();

  if (!data.itemName?.trim()) f.add("itemName", "partNameRequired", PORTAL_MESSAGES.partNameRequired);
  if (!data.serialNumber?.trim()) f.add("serialNumber", "partNumberRequired", PORTAL_MESSAGES.partNumberRequired);

  if (data.quantity !== undefined && (!Number.isFinite(data.quantity) || data.quantity < 0)) {
    f.add("quantity", "quantityNegative", PORTAL_MESSAGES.quantityNegative);
  }

  if (data.defaultPrice !== undefined && (!Number.isFinite(data.defaultPrice) || data.defaultPrice < 0)) {
    f.add("defaultPrice", "priceNegative", PORTAL_MESSAGES.priceNegative);
  }

  // Mirrors `Sparepart.SetClassification` ("A spare-part type requires a
  // category") and the API's 400. An all-zero GUID is what an unset <select>
  // sends and counts as absent.
  if (isSetId(data.typeId) && !isSetId(data.categoryId)) {
    f.add("typeId", "typeRequiresCategory", PORTAL_MESSAGES.typeRequiresCategory);
  }

  return f.result();
}

/** Stock-in — the web input is `type=number min=1`. */
export function validateStockIn(data: { quantity?: number }): ValidationResult {
  const f = new Failures();

  if (data.quantity === undefined || !Number.isFinite(data.quantity) || data.quantity < 1) {
    f.add("quantity", "stockInMin", PORTAL_MESSAGES.stockInMin);
  }

  return f.result();
}

/**
 * Manual stock-out — the web input is `type=number min=1 max={currentStock}`
 * with a required reason, and the API repeats both checks
 * (`"Quantity must be greater than 0."`, insufficient-stock rejection).
 */
export function validateStockOut(data: {
  quantity?: number;
  available?: number;
  reason?: string;
}): ValidationResult {
  const f = new Failures();

  if (data.quantity === undefined || !Number.isFinite(data.quantity) || data.quantity < 1) {
    f.add("quantity", "stockOutMin", PORTAL_MESSAGES.stockOutMin);
  } else if (data.available !== undefined && data.quantity > data.available) {
    f.add("quantity", "stockOutExceeds", PORTAL_MESSAGES.stockOutExceeds(data.available), {
      available: String(data.available),
    });
  }

  if (!data.reason?.trim()) {
    f.add("reason", "stockOutReasonRequired", PORTAL_MESSAGES.stockOutReasonRequired);
  }

  return f.result();
}

/**
 * Inspection form — mirrors `InspectItemDialog.handleSave`: Inspection and
 * Solution are both required (trimmed), with the web's exact message on either
 * being empty (`inspect.requiredFields`). Spare parts are explicitly optional,
 * but any line present must carry a positive quantity — the web input clamps to
 * `min=1` on change, which React Native inputs cannot do, so the same floor is
 * checked here.
 */
export function validateInspection(data: {
  inspection?: string;
  solution?: string;
  spareParts?: { quantity?: number }[];
}): ValidationResult {
  const f = new Failures();

  if (!data.inspection?.trim() || !data.solution?.trim()) {
    f.add("inspection", "inspectionRequired", PORTAL_MESSAGES.inspectionRequired);
  }

  if (data.spareParts?.some((line) => !Number.isFinite(line.quantity) || (line.quantity ?? 0) < 1)) {
    f.add("spareParts", "partQuantityMin", PORTAL_MESSAGES.partQuantityMin);
  }

  return f.result();
}

/** How short a new password may be. The web and the phone both used 6. */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Password change — mirrors `app/profile/page.tsx`'s `handleChangePassword`
 * and the CamID Settings tab's `handleSavePassword`, which had drifted in two
 * ways that mattered.
 *
 * `requireCurrent` is the interesting parameter. The phone can change a
 * password through `auth/face/device/reset-password`, where the paired device
 * IS the proof of identity and there is no current password to supply; with no
 * device token it posts to `auth/change-password`, where there is. Making that
 * a parameter is what lets one rule serve both, instead of the phone skipping
 * the check on BOTH paths — which is what it did.
 *
 * The confirmation check was the real defect: the phone tested
 * `if (confirmPassword && newPassword !== confirmPassword)`, so leaving the
 * confirm box empty skipped the check entirely and the mismatch it exists to
 * catch went straight through. An empty confirmation IS a mismatch.
 */
export function validatePasswordChange(data: {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  /** False only when the caller is authorised some other way — see above. */
  requireCurrent?: boolean;
}): ValidationResult {
  const f = new Failures();

  if ((data.requireCurrent ?? true) && !data.currentPassword?.trim()) {
    f.add("currentPassword", "currentPasswordRequired", PORTAL_MESSAGES.currentPasswordRequired);
  }

  if (!data.newPassword || data.newPassword.length < MIN_PASSWORD_LENGTH) {
    f.add("newPassword", "passwordTooShort", PORTAL_MESSAGES.passwordTooShort(MIN_PASSWORD_LENGTH), {
      min: String(MIN_PASSWORD_LENGTH),
    });
  } else if (data.newPassword !== (data.confirmPassword ?? "")) {
    f.add("confirmPassword", "passwordMismatch", PORTAL_MESSAGES.passwordMismatch);
  }

  return f.result();
}

/**
 * Profile edit — the desktop required a non-empty first name, the phone a
 * non-empty full name, and NEITHER checked the email or phone number it then
 * saved to the account.
 *
 * The name is spelled differently on the two screens, so it arrives already
 * resolved rather than being guessed at here.
 */
export function validateProfile(data: {
  /** First name on the desktop, full name on the phone. */
  name?: string;
  email?: string;
  phoneNumber?: string;
}): ValidationResult {
  const f = new Failures();

  if (!data.name?.trim()) f.add("name", "nameRequired", PORTAL_MESSAGES.nameRequired);

  if (!isAbsent(data.email) && !isValidEmail(data.email)) {
    f.add("email", "emailInvalid", PORTAL_MESSAGES.emailInvalid);
  }

  if (!isAbsent(data.phoneNumber) && !isValidPhone(data.phoneNumber)) {
    f.add("phoneNumber", "phoneInvalid", PORTAL_MESSAGES.phoneInvalid);
  }

  return f.result();
}
