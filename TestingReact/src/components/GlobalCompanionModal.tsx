"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import LazyMountBoundary from "@/components/LazyMountBoundary";
import { useCompanionScanner } from "@/context/CompanionScannerContext";

/**
 * Loaded on demand, not with the layout.
 *
 * This component is mounted by `app/layout.tsx`, so anything it imports
 * statically lands in the chunk every route downloads before it can paint —
 * and `CompanionScannerModal` reaches the `qrcode` package through
 * `QRCodeSvg`. That is a barcode-pairing dialog most sessions never open,
 * paid for on all 55 routes.
 *
 * ── The gate is load-bearing, not an optimisation ───────────────────────────
 *
 * It must not render the dynamic component during hydration. `sessionId` comes
 * from `useState(() => getOrCreateSessionId())`, which returns `""` on the
 * server and a real id in the browser — so the server emits nothing here while
 * the client renders a `<Suspense>` boundary, and React reports
 * "Hydration failed because the server rendered HTML didn't match the client".
 * That was reproduced in a browser against this file: with a plain
 * `dynamic(ssr: false)` the mismatch is real, not theoretical, and it makes
 * React throw away and re-render the whole tree on every load.
 *
 * `isPairingModalOpen` is `false` on the server AND on the first client render,
 * so gating on it makes the two agree by construction. The flag latches rather
 * than tracking `open` directly so that closing the dialog does not unmount it
 * — `CompanionScannerModal` hands `open` to a `ModalWrapper` that animates its
 * exit, and an unmount would cut that animation off.
 */
const CompanionScannerModal = dynamic(() => import("./CompanionScannerModal"), {
  ssr: false,
});

export default function GlobalCompanionModal() {
  const {
    isPairingModalOpen,
    closePairingModal,
    sessionId,
  } = useCompanionScanner();

  // Adjusting state during render — React's documented pattern for deriving
  // from a changing input, and deliberately not a `useEffect`: an effect would
  // cost a second render pass and trip this project's `set-state-in-effect`
  // rule.
  const [hasOpened, setHasOpened] = useState(false);
  if (isPairingModalOpen && !hasOpened) setHasOpened(true);

  if (!sessionId || !hasOpened) return null;

  return (
    <LazyMountBoundary label="Companion scanner modal">
      <CompanionScannerModal
        open={isPairingModalOpen}
        onClose={closePairingModal}
        title="Link Mobile Scanner Gun"
      />
    </LazyMountBoundary>
  );
}
