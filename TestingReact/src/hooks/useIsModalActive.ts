"use client";

/**
 * @file hooks/useIsModalActive.ts
 * @description Hook that reacts whenever any modal or lightbox is opened in the app.
 * Used by Header to smoothly transition from edge-to-edge attached bar to floating
 * island Navbar when viewing a modal, matching Aura Velvet design language.
 */

import { useState, useEffect } from "react";

export interface ModalState {
  isModalActive: boolean;
  isCommandPaletteOpen: boolean;
}

export function useModalState(): ModalState {
  const [state, setState] = useState<ModalState>(() => {
    if (typeof window !== "undefined") {
      const modalCount = window.__av_active_modal_count__ || 0;
      const cpCount = window.__av_active_cp_count__ || 0;
      return {
        isModalActive: modalCount > 0,
        isCommandPaletteOpen: cpCount > 0,
      };
    }
    return { isModalActive: false, isCommandPaletteOpen: false };
  });

  useEffect(() => {
    const handleModalChange = (e: Event) => {
      const customEvent = e as CustomEvent<{
        count: number;
        isOpen: boolean;
        cpCount?: number;
        isCpOpen?: boolean;
      }>;
      const isCpOpen = Boolean(customEvent.detail.isCpOpen);
      setState({
        isModalActive: customEvent.detail.isOpen,
        isCommandPaletteOpen: isCpOpen,
      });
    };
    window.addEventListener("av:modal-change", handleModalChange);
    return () => window.removeEventListener("av:modal-change", handleModalChange);
  }, []);

  return state;
}

export function useIsModalActive(): boolean {
  const { isModalActive, isCommandPaletteOpen } = useModalState();
  // If Command Palette is open, suppress floating Header appearance so only Command Palette is focused
  return isModalActive && !isCommandPaletteOpen;
}
