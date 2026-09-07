import type { TranslationKey } from "@/i18n/translations";
import type { ApiWriteResult } from "@/services/types";

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/**
 * The sentence a taxonomy screen shows for a failed write. Keyed off the
 * API's stable `code`, never off its English `detail` — the detail is only
 * appended where no better sentence exists.
 */
export function taxonomyFailureMessage(result: Extract<ApiWriteResult, { ok: false }>, t: Translate): string {
  switch (result.code) {
    case "duplicate":
      return t("spTax.duplicate");
    case "inUse":
      return t("spTax.inUse", { count: result.count ?? 0 });
    case "network":
      return t("status.offline");
    default:
      return t("spTax.saveFailed", { detail: result.detail ?? "" }).trim();
  }
}
