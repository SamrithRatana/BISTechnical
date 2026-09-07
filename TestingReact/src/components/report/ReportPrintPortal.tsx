"use client";

/**
 * @file report/ReportPrintPortal.tsx
 * @description An off-screen copy of the report, mounted directly under
 * `<body>`, that exists only so `window.print()` has something correct to
 * print.
 *
 * ── WHY A SEPARATE COPY RATHER THAN PRINTING THE ONE ON SCREEN ────────────
 * The print stylesheet isolates the report with
 * `body > *:not(.rpt-print-root)`, so the printed element has to be a direct
 * child of `<body>`. Anything rendered inside the app is not: the app shell
 * (`.av-page-stage`) sets `transform: translateZ(0)`, which makes it the
 * containing block for every `fixed`/`absolute` descendant, and
 * `overflow: hidden`, which clips them. A report printed from in there came out
 * inset from the top-left with a blank band down the right edge and its
 * signature block cropped off the bottom.
 *
 * Screens that show the report in a page-level overlay (the print preview
 * sidebar) already portal that overlay to `<body>` and need none of this.
 * Screens that show it *inside* the layout — the Templates Settings preview
 * tab — mount this alongside, so their Print button is correct without them
 * having to know any of the above.
 */

import React, { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import ReportSheet from "@/components/report/ReportSheet";
import type {
  ReportTemplateSettings,
  ReportTicketLike,
  ResolvedSparePartRow,
} from "@/report-layout";

/** A browser never gains a `document` part-way through a page's life. */
const subscribeNever = () => () => {};

export interface ReportPrintPortalProps {
  item: ReportTicketLike;
  sparePartRows: ResolvedSparePartRow[];
  settings: ReportTemplateSettings;
  brandLogoSrc?: string;
}

export default function ReportPrintPortal({
  item,
  sparePartRows,
  settings,
  brandLogoSrc,
}: ReportPrintPortalProps) {
  // `createPortal` needs a real `document`, so this must not be part of the
  // server render. Same shape `usePasskeySupport` uses — no setState in an
  // effect, and a `false` server snapshot.
  const isBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!isBrowser) return null;

  return createPortal(
    <div className="rpt-print-root rpt-print-only" aria-hidden>
      <ReportSheet
        item={item}
        sparePartRows={sparePartRows}
        settings={settings}
        isolateForPrint
        brandLogoSrc={brandLogoSrc}
      />
    </div>,
    document.body,
  );
}
