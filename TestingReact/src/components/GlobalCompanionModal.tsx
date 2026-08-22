"use client";

import React from "react";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import CompanionScannerModal from "./CompanionScannerModal";

export default function GlobalCompanionModal() {
  const {
    isPairingModalOpen,
    closePairingModal,
    sessionId,
  } = useCompanionScanner();

  if (!sessionId) return null;

  return (
    <CompanionScannerModal
      open={isPairingModalOpen}
      onClose={closePairingModal}
      title="Link Mobile Scanner Gun"
    />
  );
}
