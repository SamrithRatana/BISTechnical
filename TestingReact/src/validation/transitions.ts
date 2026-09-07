/**
 * @file validation/transitions.ts
 * @description The business rules that refuse a workflow move before it is
 * attempted.
 *
 * See `stockShortage.ts` for the rules this folder lives by.
 *
 * ── WHY THIS IS SHARED ────────────────────────────────────────────────────
 * The desktop enforced two of these inside `ApproveRepairDialog.handleApprove`,
 * so they only ran on the one screen that mounts that dialog; the phone had its
 * own copy in `services/portalDomain.transitionGuard`. Same intent, two
 * implementations, and the phone's had grown a third rule the desktop never
 * had. One function now, called from both.
 *
 * This is a PRE-flight, not the authority. The backend still decides, and the
 * stock rule specifically is enforced by a SQL trigger — see `stockPreflight.ts`
 * for that half. What this buys is a refusal that names the reason in the
 * user's own terms instead of after a failed write.
 */

import { isChargeService } from "./reference";
import { PORTAL_MESSAGES } from "./forms";

/** The fields a transition is judged on, under either platform's casing. */
export interface TransitionSubject {
  status?: string;
  serviceType?: string;
  serviceTypeId?: number;
  /** How many spare-part lines the ticket carries. */
  sparePartCount: number;
  reportNo?: string;
}

/** Which rule refused, and the sentence that says so. */
export interface TransitionRefusal {
  code: TransitionCode;
  /** Ready to show. The phone renders this; the web translates the code. */
  message: string;
}

/**
 * The stable identity of each refusal.
 *
 * The web keys its own translated wording off this. Comparing the rendered
 * message instead would silently pick the wrong sentence the first time anyone
 * rephrased one.
 */
export type TransitionCode =
  | "cannotApproveSpareParts"
  | "cannotApproveCharge"
  | "cannotSendSparePartsCharge"
  | "cannotApproveFreeWithSpareParts";

/**
 * The reason a move is refused, or `null` when it may proceed.
 *
 * Enforces the 4 authoritative workflow rules:
 * 1. Charge មាន Sparepart -> បញ្ជូនទៅស្តុក -> បញ្ជូនទៅទីផ្សារ -> បញ្ជូនគ្រឿងបន្លាស់ -> អនុម័តជួសជុល
 * 2. Charge គ្មាន Sparepart -> បញ្ជូនទៅទីផ្សារ -> អនុម័តជួសជុល
 * 3. Free មាន Sparepart -> បញ្ជូនទៅស្តុក -> បញ្ជូនគ្រឿងបន្លាស់ -> អនុម័តជួសជុល
 * 4. Free គ្មាន Sparepart -> វិនិច្ឆ័រួចរាល់ -> អនុម័តជួសជុល
 */
export function transitionGuard(
  record: TransitionSubject,
  targetStatus: string,
): TransitionRefusal | null {
  const status = (record.status || "").trim();
  const target = targetStatus.trim().toLowerCase();
  const isCharge = isChargeService(record.serviceType, record.serviceTypeId);
  const hasParts = record.sparePartCount > 0;
  const ref = record.reportNo;

  if (target === "repairing") {
    // Rule 1: Charge មាន Sparepart -> Must be in "Sent Spareparts"
    if (isCharge && hasParts) {
      if (status !== "Sent Spareparts") {
        return {
          code: "cannotApproveSpareParts",
          message: PORTAL_MESSAGES.cannotApproveSpareParts(ref),
        };
      }
      return null;
    }

    // Rule 2: Charge គ្មាន Sparepart -> Must be in "Sale Confirmed" (or Sent Spareparts)
    if (isCharge && !hasParts) {
      if (status !== "Sale Confirmed" && status !== "Sent Spareparts") {
        return {
          code: "cannotApproveCharge",
          message: PORTAL_MESSAGES.cannotApproveCharge(ref),
        };
      }
      return null;
    }

    // Rule 3: Free មាន Sparepart -> Must be in "Sent Spareparts"
    if (!isCharge && hasParts) {
      if (status !== "Sent Spareparts") {
        return {
          code: "cannotApproveFreeWithSpareParts",
          message: PORTAL_MESSAGES.cannotApproveFreeWithSpareParts(ref),
        };
      }
      return null;
    }

    // Rule 4: Free គ្មាន Sparepart -> Must be in "Inspection" (or Sent Spareparts)
    if (!isCharge && !hasParts) {
      if (status !== "Inspection" && status !== "Sent Spareparts") {
        return {
          code: "cannotApproveCharge",
          message: `${ref ? ref + ": " : ""}មិនទាន់វិនិច្ឆ័យរួចរាល់ (Inspection) នៅឡើយទេ`,
        };
      }
      return null;
    }

    return null;
  }

  // Stock desk cannot dispatch parts for a Charge ticket before sales confirmation:
  if (target === "sent spareparts" && status === "Awaiting Sparepart" && isCharge) {
    return {
      code: "cannotSendSparePartsCharge",
      message: PORTAL_MESSAGES.cannotSendSparePartsCharge,
    };
  }

  return null;
}
