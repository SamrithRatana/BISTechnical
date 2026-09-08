"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageWrapper from "@/components/PageWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  Search,
  Save,
  Trash2,
  Columns,
  FileText,
  Layout,
  Printer,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Loader2,
  RefreshCw,
  X,
  Sparkles,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import TicketFieldsEditor from "@/components/ticket-editor/TicketFieldsEditor";
import InteractiveReportEditor from "@/components/ticket-editor/InteractiveReportEditor";
import {
  type RepairServiceItem,
  SERVICE_PRIORITIES,
  toBackendLocalDateTime,
} from "@/services/types";
import {
  deleteTechnicalService,
  invalidateCachePrefix,
  fetchSparePartsInventory,
  fetchSparePartById,
  fetchCustomerCenter,
  dispatchTelegramNotificationSafe,
  type CustomerItem,
} from "@/services/api";
import { matchSparePartInventory, ticketSparePartLines } from "@/report-layout";
import { fetchUserMap, getCurrentUserFullName } from "@/services/userService";
import {
  buildStockInTelegramMessage,
  buildStockOutTelegramMessage,
} from "@/services/telegramMessageBuilder";
import { sendTelegramNotification } from "@/services/telegramService";
import HighlightText from "@/components/HighlightText";

type ViewMode = "fields" | "report";

// Status ID fallback resolver (strictly preserve original statusId, resolving from status string if needed)
const resolveStatusFallback = (statusStr?: string): number => {
  if (!statusStr) return 1;
  const s = statusStr.toLowerCase();
  if (s.includes("finish") || s.includes("រួចរាល់")) return 6;
  if (s.includes("sent spare") || s.includes("បានបញ្ជូនបន្លាស់")) return 12;
  if (s.includes("sale confirm") || s.includes("បាន confirm")) return 11;
  if (s.includes("inspecting")) return 10;
  if (s.includes("third") || s.includes("party")) return 9;
  if (s.includes("unrepairable") || s.includes("ជួសជុលមិនបាន")) return 8;
  if (s.includes("reject") || s.includes("មិនព្រម")) return 7;
  if (s.includes("repair") || s.includes("ជួសជុល")) return 5;
  if (s.includes("awaiting spare") || s.includes("រង់ចាំគ្រឿងបន្លាស់")) return 4;
  if (s.includes("awaiting customer") || s.includes("រង់ចាំ confirmed")) return 3;
  if (s.includes("inspect") || s.includes("វិនិច្ឆ័យ")) return 2;
  return 1;
};

function ServiceTicketsContent() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const initialReportNo = searchParams.get("reportNo") || "";

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialReportNo);
  const [searchResults, setSearchResults] = useState<RepairServiceItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Active ticket & edits
  const [activeTicket, setActiveTicket] = useState<RepairServiceItem | null>(null);
  const activeTicketRef = useRef<RepairServiceItem | null>(activeTicket);
  activeTicketRef.current = activeTicket;

  const handleUpdateTicket = useCallback(
    (updater: RepairServiceItem | ((prev: RepairServiceItem | null) => RepairServiceItem | null)) => {
      setActiveTicket((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        activeTicketRef.current = next;
        return next;
      });
    },
    []
  );

  const [originalTicket, setOriginalTicket] = useState<RepairServiceItem | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // View mode (Single Full-Screen Responsive: Form or Live Report)
  const [viewMode, setViewMode] = useState<ViewMode>("fields");
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

  // Mode Selection Modal (popup on ticket select)
  const [showModeModal, setShowModeModal] = useState(false);

  // Delete modal confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search tickets on debounce
  const searchTickets = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/proxy/technicalservices/search?searchTerm=${encodeURIComponent(q)}&pageSize=20`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.items || []);
      }
    } catch (err) {
      console.error("Failed to search tickets:", err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 1) {
        void searchTickets(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, searchTickets]);

  // Load specific ticket by ID or auto-search on mount
  const loadTicketById = useCallback(async (id: string, promptModeSelection = true) => {
    setIsLoadingTicket(true);
    try {
      const res = await fetch(`/api/proxy/technicalservices/${id}`);
      if (res.ok) {
        const data = await res.json();
        try {
          const userMap = await fetchUserMap();
          const rUser = data.repairBy ? userMap.get(String(data.repairBy).toLowerCase()) : undefined;
          const vUser = data.verifiedBy ? userMap.get(String(data.verifiedBy).toLowerCase()) : undefined;
          data.repairByName = data.repairByName || (rUser ? (rUser.firstName ? `${rUser.firstName} ${rUser.lastName || ""}`.trim() : rUser.userName) : "");
          data.repairByPhone = data.repairByPhone || rUser?.phoneNumber || "";
          data.verifiedByName = data.verifiedByName || (vUser ? (vUser.firstName ? `${vUser.firstName} ${vUser.lastName || ""}`.trim() : vUser.userName) : "");
          data.verifiedByPhone = data.verifiedByPhone || vUser?.phoneNumber || "";
        } catch {
          // ignore
        }
        // Enrich spare part descriptions from inventory if empty
        const rawParts = data.sparepartItems || data.sparePartItems;
        if (rawParts && Array.isArray(rawParts) && rawParts.length > 0) {
          try {
            const invRes = await fetchSparePartsInventory(1, 500);
            const invItems = invRes.items || [];
            const mappedParts = rawParts.map((p: any) => {
              const match = matchSparePartInventory(p, invItems as unknown as Record<string, unknown>[]);
              if (match) {
                const resolvedName = (match.itemName || match.partName || match.name) as string | undefined;
                const resolvedId =
                  p.sparepartId && p.sparepartId !== "00000000-0000-0000-0000-000000000000"
                    ? p.sparepartId
                    : p.sparePartId && p.sparePartId !== "00000000-0000-0000-0000-000000000000"
                    ? p.sparePartId
                    : match.id;
                return {
                  ...p,
                  sparepartId: resolvedId,
                  sparePartId: resolvedId,
                  SparepartId: resolvedId,
                  description: p.description?.trim() ? p.description : resolvedName || p.description || "Spare Part",
                  itemName: p.itemName?.trim() ? p.itemName : resolvedName || p.itemName || "Spare Part",
                  useFor: p.useFor || match.useFor || match.compatibleModel || "—",
                  partNumber: p.partNumber || match.partNumber || match.serialNumber || "—",
                };
              }
              return p;
            });
            data.sparepartItems = mappedParts;
            data.sparePartItems = mappedParts;
          } catch (partErr) {
            console.warn("Could not enrich spare parts on ticket load:", partErr);
          }
        }

        // Auto-resolve customerId if missing or Guid.Empty
        if (
          (!data.customerId || data.customerId === "00000000-0000-0000-0000-000000000000") &&
          data.companyName?.trim()
        ) {
          try {
            const lookup = await fetchCustomerCenter(1, 10, data.companyName.trim());
            const target = data.companyName.trim().toLowerCase();
            const found =
              (lookup.items || []).find((c: CustomerItem) => c.companyName.trim().toLowerCase() === target) ||
              (lookup.items || []).find((c: CustomerItem) => c.phoneNumber?.trim() && c.phoneNumber.trim() === data.phoneNumber?.trim()) ||
              (lookup.items || [])[0];
            if (found && found.id) {
              data.customerId = found.id;
            }
          } catch {
            // ignore
          }
        }

        const ticketSnapshot = JSON.parse(JSON.stringify(data));
        setActiveTicket(ticketSnapshot);
        setOriginalTicket(JSON.parse(JSON.stringify(data)));
        if (promptModeSelection) {
          setShowModeModal(true);
        }
      } else {
        toast.error("Could not load ticket details.");
      }
    } catch (err) {
      console.error("Error loading ticket:", err);
      toast.error("Network error loading ticket.");
    } finally {
      setIsLoadingTicket(false);
    }
  }, []);

  // If initialReportNo was passed in query param, find and load it
  useEffect(() => {
    if (!initialReportNo) return;
    async function autoLoadInitial() {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/proxy/technicalservices/search?searchTerm=${encodeURIComponent(initialReportNo)}&pageSize=5`);
        if (res.ok) {
          const data = await res.json();
          const items: RepairServiceItem[] = data.items || [];
          const exact = items.find((i) => i.reportNo?.toLowerCase() === initialReportNo.toLowerCase()) || items[0];
          if (exact?.id) {
            void loadTicketById(exact.id, true);
          }
        }
      } catch (err) {
        console.error("Failed to autoload initial report:", err);
      } finally {
        setIsSearching(false);
      }
    }
    void autoLoadInitial();
  }, [initialReportNo, loadTicketById]);

  // Save changes
  const handleSave = async () => {
    // 1. Force blur active element to ensure any in-progress inline text edits (like Solution, Qty, Remarks) commit immediately!
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Yield to allow inline text edit blur handlers to complete and sync into activeTicketRef
    await new Promise((resolve) => setTimeout(resolve, 60));

    const currentTicket = activeTicketRef.current || activeTicket;
    if (!currentTicket) return;
    setIsSaving(true);

    try {
      // Normalize location
      const loc = currentTicket.serviceLocation === "OnSite" ? "OnSite" : "CompanyService";

      // Priority ID: 1 = Low, 2 = Normal, 3 = High
      let prioId = currentTicket.servicePriorityId;
      if (!prioId && currentTicket.servicePriority) {
        const p = currentTicket.servicePriority.toLowerCase();
        prioId = p.includes("high") ? 3 : p.includes("low") ? 1 : 2;
      }
      prioId = prioId || 2;

      // Service Type ID: 1 = Free, 2 = Charge
      let sTypeId = currentTicket.serviceTypeId;
      if (!sTypeId) {
        const isCharge = (currentTicket.serviceType || "").toLowerCase() === "charge";
        sTypeId = isCharge ? 2 : 1;
      }

      const statusId =
        (originalTicket?.statusId && originalTicket.statusId > 0 ? originalTicket.statusId : undefined) ??
        (currentTicket.statusId && currentTicket.statusId > 0 ? currentTicket.statusId : undefined) ??
        resolveStatusFallback(originalTicket?.status || currentTicket.status);

      // Clean spare parts (filter out blank/draft nullable rows)
      // If status is Sent Spareparts (12), Repairing (5), or Finished (6), isHoldStatus is false (live stock deduction/restoration).
      // If status is Inspection (2), Awaiting Customer Confirm (3), Awaiting Sparepart (4), Sale Confirmed (11), etc., isHoldStatus is true (hold, zero stock movements).
      const isHold = !(statusId === 5 || statusId === 6 || statusId === 12);
      const ticketParts = ticketSparePartLines(currentTicket as unknown as Record<string, unknown>);
      const cleanParts = ticketParts
        .filter((p: any) => Boolean((p.description || p.itemName || "").trim()))
        .map((p: any) => {
          const rawCond = (p.condition || "").trim().toLowerCase();
          const cond = rawCond === "fix" ? "Fix" : rawCond === "free" ? "Free" : "Replace";
          const rawId = p.id || p.sparepartItemId || p.lineId;
          const isValidGuid =
            typeof rawId === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
          return {
            id: isValidGuid ? rawId : undefined,
            sparepartId: p.sparePartId || p.sparepartId || "00000000-0000-0000-0000-000000000000",
            description: (p.description || p.itemName || "Spare Part").trim(),
            quantity: Math.max(1, p.quantity || 1),
            condition: cond,
            isHoldStatus: isHold,
            remarks: p.remarks || "",
            remarksUpdatedAt: p.remarksUpdatedAt || null,
          };
        });

      // Compute stock movements if ticket is in live stock status (SentSpareparts, Repairing, Finished)
      const wasLiveStock = !isHold;
      const stockDeltas: {
        partId?: string;
        itemName: string;
        partNumber?: string;
        useFor?: string;
        diff: number; // >0: StockIn (returned), <0: StockOut (deducted)
      }[] = [];

      if (wasLiveStock) {
        const prevParts = (
          (originalTicket?.sparepartItems && originalTicket.sparepartItems.length > 0
            ? originalTicket.sparepartItems
            : (originalTicket as any)?.sparePartItems) || []
        ) as any[];

        const getEffectiveQty = (p: any) => {
          const cond = (p?.condition || "").trim().toLowerCase();
          if (cond === "fix") return 0;
          return Math.max(0, Number(p?.quantity) || 0);
        };

        const getPartKey = (p: any) => {
          const id = p.sparepartId || p.sparePartId;
          if (id && id !== "00000000-0000-0000-0000-000000000000") {
            return `id:${id.toLowerCase()}`;
          }
          const desc = (p.description || p.itemName || "").trim().toLowerCase();
          return `name:${desc}`;
        };

        const prevMap = new Map<string, { partId?: string; itemName: string; partNumber?: string; useFor?: string; qty: number }>();
        for (const p of prevParts) {
          const key = getPartKey(p);
          const q = getEffectiveQty(p);
          const id = p.sparepartId || p.sparePartId;
          const validId = id && id !== "00000000-0000-0000-0000-000000000000" ? id : undefined;
          const name = (p.itemName || p.description || "Spare Part").trim();
          if (!prevMap.has(key)) {
            prevMap.set(key, { partId: validId, itemName: name, partNumber: p.partNumber, useFor: p.useFor, qty: q });
          } else {
            const entry = prevMap.get(key)!;
            entry.qty += q;
            if (!entry.partId && validId) entry.partId = validId;
            if ((!entry.partNumber || entry.partNumber === "—") && p.partNumber) entry.partNumber = p.partNumber;
            if ((!entry.useFor || entry.useFor === "—") && p.useFor) entry.useFor = p.useFor;
          }
        }

        const nextMap = new Map<string, { partId?: string; itemName: string; partNumber?: string; useFor?: string; qty: number }>();
        for (const p of cleanParts as any[]) {
          const key = getPartKey(p);
          const q = getEffectiveQty(p);
          const id = p.sparepartId || p.sparePartId;
          const validId = id && id !== "00000000-0000-0000-0000-000000000000" ? id : undefined;
          const name = (p.itemName || p.description || "Spare Part").trim();
          if (!nextMap.has(key)) {
            nextMap.set(key, { partId: validId, itemName: name, partNumber: p.partNumber, useFor: p.useFor, qty: q });
          } else {
            const entry = nextMap.get(key)!;
            entry.qty += q;
            if (!entry.partId && validId) entry.partId = validId;
            if ((!entry.partNumber || entry.partNumber === "—") && p.partNumber) entry.partNumber = p.partNumber;
            if ((!entry.useFor || entry.useFor === "—") && p.useFor) entry.useFor = p.useFor;
          }
        }

        const allKeys = new Set([...prevMap.keys(), ...nextMap.keys()]);
        for (const k of allKeys) {
          const prev = prevMap.get(k);
          const next = nextMap.get(k);
          const prevQty = prev?.qty || 0;
          const nextQty = next?.qty || 0;
          const diff = prevQty - nextQty; // >0: returned to stock (StockIn), <0: taken from stock (StockOut)
          if (diff !== 0) {
            stockDeltas.push({
              partId: prev?.partId || next?.partId,
              itemName: prev?.itemName || next?.itemName || "Spare Part",
              partNumber: prev?.partNumber || next?.partNumber,
              useFor: prev?.useFor || next?.useFor,
              diff,
            });
          }
        }
      }

      // ServiceDate normalized
      let svcDate = currentTicket.serviceDate;
      if (svcDate && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(svcDate.trim())) {
        const d = new Date(svcDate);
        if (!Number.isNaN(d.getTime())) {
          svcDate = toBackendLocalDateTime(d);
        }
      }

      let finDate = currentTicket.finishedDate;
      if (finDate && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(finDate.trim())) {
        const d = new Date(finDate);
        if (!Number.isNaN(d.getTime())) {
          finDate = toBackendLocalDateTime(d);
        }
      }

      // Auto-resolve Customer ID if missing or Guid.Empty
      let resolvedCustomerId = currentTicket.customerId;
      if (
        (!resolvedCustomerId || resolvedCustomerId === "00000000-0000-0000-0000-000000000000") &&
        currentTicket.companyName?.trim()
      ) {
        try {
          const lookup = await fetchCustomerCenter(1, 20, currentTicket.companyName.trim());
          const target = currentTicket.companyName.trim().toLowerCase();
          const found =
            (lookup.items || []).find((c: CustomerItem) => c.companyName.trim().toLowerCase() === target) ||
            (lookup.items || []).find((c: CustomerItem) => c.phoneNumber?.trim() && c.phoneNumber.trim() === currentTicket.phoneNumber?.trim()) ||
            (lookup.items || [])[0];
          if (found && found.id) {
            resolvedCustomerId = found.id;
          }
        } catch (err) {
          console.warn("Failed to auto-resolve customerId:", err);
        }
      }

      const payload = {
        id: currentTicket.id,
        customerId: resolvedCustomerId || "00000000-0000-0000-0000-000000000000",
        companyName: currentTicket.companyName || "N/A",
        address: currentTicket.address || "",
        contactName: currentTicket.contactName || "",
        phoneNumber: currentTicket.phoneNumber || "",
        itemId: currentTicket.itemId || null,
        itemName: (currentTicket.itemName || "").trim(),
        serialNumber: (currentTicket.serialNumber || "").trim(),
        reportNo: currentTicket.reportNo, // strictly locked
        serviceDate: svcDate,
        finishedDate: finDate || null,
        customerRequest: currentTicket.customerRequest?.trim() || "Service Request",
        inspection: currentTicket.inspection || "",
        solution: currentTicket.solution || "",
        serviceLocation: loc,
        serviceTypeId: sTypeId,
        servicePriorityId: prioId,
        statusId, // strictly locked & accurately resolved
        hasContract: Boolean(currentTicket.hasContract),
        repairBy: currentTicket.repairBy || null,
        verifiedBy: currentTicket.verifiedBy || null,
        sparepartItems: cleanParts,
      };

      const res = await fetch("/api/proxy/technicalservices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t("ticketEditor.savedSuccess"));
        invalidateCachePrefix("repairservices");
        invalidateCachePrefix("dashboard");
        invalidateCachePrefix("spareparts");

        // 🚀 Synchronize Telegram notification for this ticket to reflect the latest report info & spare parts!
        try {
          await dispatchTelegramNotificationSafe(
            {
              ...currentTicket,
              ...payload,
              statusId,
              status: originalTicket?.status || currentTicket.status,
              sparepartItems: cleanParts,
              sparePartItems: cleanParts,
            } as unknown as RepairServiceItem,
            originalTicket?.status || currentTicket.status,
            undefined,
            true // forceEdit in-place
          );
        } catch (tgErr) {
          console.warn("Failed to sync Telegram message:", tgErr);
        }

        // 📦 Alert Telegram for real stock movements (StockIn / StockOut)
        if (stockDeltas.length > 0) {
          const performedBy = getCurrentUserFullName() || "System";
          const reportNo = currentTicket.reportNo || "N/A";
          const companyName = currentTicket.companyName || "";

          for (const delta of stockDeltas) {
            try {
              let currentStock: number | undefined = undefined;
              let partNumber = delta.partNumber || "—";
              let useFor = delta.useFor || "—";
              let itemName = delta.itemName;

              if (delta.partId) {
                const freshPart = await fetchSparePartById(delta.partId, true);
                if (freshPart) {
                  currentStock = freshPart.quantity;
                  if (freshPart.itemName) itemName = freshPart.itemName;
                  if (freshPart.partNumber) partNumber = freshPart.partNumber;
                  if (freshPart.useFor) useFor = freshPart.useFor;
                }
              }

              if (delta.diff > 0) {
                // 🟢 STOCK IN: part was removed or quantity decreased
                const quantityChange = delta.diff;
                const newQuantity = currentStock ?? quantityChange;
                const oldQuantity = currentStock !== undefined ? currentStock - quantityChange : 0;

                const msgHtml = buildStockInTelegramMessage({
                  id: delta.partId,
                  itemName,
                  partNumber,
                  useFor,
                  oldQuantity,
                  quantityChange,
                  newQuantity,
                  performedBy,
                  remarks: `Stock restored: Item removed from service (Report: ${reportNo})`,
                  reportNo,
                  companyName,
                });

                await sendTelegramNotification("StockIn", msgHtml);
              } else if (delta.diff < 0) {
                // 🔴 STOCK OUT: part was added or quantity increased
                const quantityChange = Math.abs(delta.diff);
                const newQuantity = currentStock ?? 0;
                const oldQuantity = currentStock !== undefined ? currentStock + quantityChange : quantityChange;

                const msgHtml = buildStockOutTelegramMessage({
                  id: delta.partId,
                  itemName,
                  partNumber,
                  useFor,
                  oldQuantity,
                  quantityChange,
                  newQuantity,
                  performedBy,
                  remarks: `Stock deducted: Added to service (Report: ${reportNo})`,
                  reportNo,
                  companyName,
                });

                await sendTelegramNotification("StockOut", msgHtml);
              }
            } catch (stockAlertErr) {
              console.warn("Failed to dispatch stock telegram alert:", stockAlertErr);
            }
          }
        }

        // Reload full fresh ticket without re-triggering mode popup
        await loadTicketById(currentTicket.id, false);
      } else {
        const errText = await res.text();
        toast.error(`Save failed: ${errText || res.statusText}`);
      }
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(`Error saving report: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete ticket
  const handleDelete = async () => {
    if (!activeTicket) return;
    if (
      activeTicket.statusId === 6 ||
      activeTicket.status?.toLowerCase().includes("finish") ||
      activeTicket.status?.includes("រួចរាល់")
    ) {
      toast.error(
        lang === "km"
          ? "មិនអាចលុបរបាយការណ៍ដែលជួសជុលរួចរាល់ (Finished) បានទេ"
          : "Cannot delete finished service report."
      );
      setShowDeleteModal(false);
      return;
    }
    setIsDeleting(true);
    try {
      const statusId = activeTicket.statusId || resolveStatusFallback(activeTicket.status);
      const isHold = !(statusId === 5 || statusId === 6 || statusId === 12);
      const wasLiveStock = !isHold;
      const partsToRestore = wasLiveStock
        ? (activeTicket.sparepartItems || []).filter((p: any) => {
            const cond = (p.condition || "").trim().toLowerCase();
            return cond !== "fix" && (p.quantity || 0) > 0;
          })
        : [];

      const ok = await deleteTechnicalService(activeTicket.id);
      if (ok) {
        toast.success(t("ticketEditor.deletedSuccess"));
        invalidateCachePrefix("repairservices");
        invalidateCachePrefix("dashboard");
        invalidateCachePrefix("spareparts");

        if (partsToRestore.length > 0) {
          const performedBy = getCurrentUserFullName() || "System";
          const reportNo = activeTicket.reportNo || "N/A";
          const companyName = activeTicket.companyName || "";

          for (const p of partsToRestore as any[]) {
            try {
              const partId = p.sparepartId || p.sparePartId;
              let currentStock: number | undefined = undefined;
              let partNumber = p.partNumber || "—";
              let useFor = p.useFor || "—";
              let itemName = p.itemName || p.description || "Spare Part";

              if (partId && partId !== "00000000-0000-0000-0000-000000000000") {
                const freshPart = await fetchSparePartById(partId, true);
                if (freshPart) {
                  currentStock = freshPart.quantity;
                  if (freshPart.itemName) itemName = freshPart.itemName;
                  if (freshPart.partNumber) partNumber = freshPart.partNumber;
                  if (freshPart.useFor) useFor = freshPart.useFor;
                }
              }

              const quantityChange = Math.max(1, p.quantity || 1);
              const newQuantity = currentStock ?? quantityChange;
              const oldQuantity = currentStock !== undefined ? currentStock - quantityChange : 0;

              const msgHtml = buildStockInTelegramMessage({
                id: partId,
                itemName,
                partNumber,
                useFor,
                oldQuantity,
                quantityChange,
                newQuantity,
                performedBy,
                remarks: `Stock restored: Ticket deleted (Report: ${reportNo})`,
                reportNo,
                companyName,
              });

              await sendTelegramNotification("StockIn", msgHtml);
            } catch (delAlertErr) {
              console.warn("Failed to dispatch stock in alert on ticket deletion:", delAlertErr);
            }
          }
        }

        setActiveTicket(null);
        setOriginalTicket(null);
        setShowDeleteModal(false);
        setSearchQuery("");
        setSearchResults([]);
      } else {
        toast.error("Failed to delete report. Please try again.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Error deleting report.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageWrapper titleKey="nav.serviceTickets" subtitleKey="sub.serviceTickets">
      <Toaster position="top-right" />

      <div className="flex flex-col h-full space-y-4">
        {/* ── Top Command Bar ── */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface border border-subtle shadow-soft-sm flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("ticketEditor.searchPlaceholder")}
              className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm rounded-xl border border-subtle bg-cushion text-ink focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-ink-muted" />
            )}

            {/* Dropdown search results */}
            {searchResults.length > 0 && !activeTicket && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface border border-subtle rounded-2xl shadow-xl max-h-72 overflow-y-auto divide-y divide-subtle">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      void loadTicketById(item.id, true);
                      setSearchResults([]);
                    }}
                    className="p-3 hover:bg-accent-soft/40 cursor-pointer flex items-center justify-between transition-colors text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold font-mono text-accent">
                          <HighlightText text={item.reportNo} query={searchQuery} />
                        </span>
                        <span className="text-ink font-semibold">
                          <HighlightText text={item.companyName || "N/A"} query={searchQuery} />
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted mt-0.5">
                        <HighlightText text={item.itemName || "Instrument"} query={searchQuery} />
                        {item.serialNumber ? (
                          <> (<HighlightText text={item.serialNumber} query={searchQuery} />)</>
                        ) : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cushion text-ink-secondary border border-subtle">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Ticket Controls */}
          {activeTicket ? (
            <div className="flex items-center flex-wrap gap-2">
              {/* Change/Back to Search button */}
              <button
                type="button"
                onClick={() => {
                  setActiveTicket(null);
                  setOriginalTicket(null);
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cushion text-ink hover:bg-subtle border border-subtle transition-all"
                title="Search another ticket"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Select Another</span>
              </button>

              {/* View Mode Switcher: Form vs Report (Full Screen) */}
              <div className="flex items-center bg-cushion p-1 rounded-xl border border-subtle text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("fields")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    viewMode === "fields"
                      ? "bg-surface text-accent shadow-2xs border border-subtle/60"
                      : "text-ink-muted hover:text-ink"
                  }`}
                  title="Switch to Form Fields Mode"
                >
                  <Layout className="w-3.5 h-3.5" />
                  <span>{t("ticketEditor.editModeField")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("report")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    viewMode === "report"
                      ? "bg-surface text-accent shadow-2xs border border-subtle/60"
                      : "text-ink-muted hover:text-ink"
                  }`}
                  title="Switch to Live A4 Report Mode"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t("ticketEditor.editModeReport")}</span>
                </button>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-accent text-white hover:bg-accent/90 shadow-soft-sm disabled:opacity-60 transition-all"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? t("ticketEditor.saving") : t("ticketEditor.saveChanges")}</span>
              </button>

              {/* Delete Button */}
              {activeTicket.statusId === 6 ||
              activeTicket.status?.toLowerCase().includes("finish") ||
              activeTicket.status?.includes("រួចរាល់") ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-subtle text-ink-muted/50 border border-subtle cursor-not-allowed opacity-60"
                  title={
                    lang === "km"
                      ? "មិនអាចលុបរបាយការណ៍ដែលជួសជុលរួចរាល់ (Finished) បានទេ (អាចកែប្រែបាន)"
                      : "Cannot delete finished service report (Edit only)"
                  }
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("ticketEditor.deleteReport")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-danger-soft text-danger hover:bg-danger/20 border border-danger/20 transition-all"
                  title="Delete this ticket"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("ticketEditor.deleteReport")}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-ink-muted italic">
              {t("ticketEditor.selectTicketFirst")}
            </div>
          )}
        </div>

        {/* ── Main Work Area ── */}
        {isLoadingTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-ink-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-2" />
            <p className="text-xs font-medium">Loading ticket details...</p>
          </div>
        ) : !activeTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-surface rounded-2xl border border-subtle shadow-soft-sm">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-ink mb-1">Service Ticket & Report Editor</h3>
            <p className="text-xs text-ink-muted max-w-md">
              Search by Report Number (e.g. 20260903-1841), Customer Name, or Serial Number above to edit ticket information at ANY stage or delete the report.
            </p>
          </div>
        ) : (
          /* ── Workspace with Selected Ticket (Full Screen Responsive) ── */
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Full-Screen Form Fields View */}
            {viewMode === "fields" && (
              <div className="flex-1 overflow-y-auto pr-1 w-full max-w-5xl mx-auto py-1">
                <TicketFieldsEditor
                  ticket={activeTicket}
                  onChange={handleUpdateTicket}
                  highlightSection={highlightedSection}
                  onSectionFocused={(s) => setHighlightedSection(s)}
                />
              </div>
            )}

            {/* Full-Screen Interactive Report View */}
            {viewMode === "report" && (
              <div className="flex-1 min-h-0 flex flex-col w-full py-1">
                <InteractiveReportEditor
                  ticket={activeTicket}
                  selectedSection={highlightedSection}
                  onSelectSection={(s) => setHighlightedSection(s)}
                  onUpdateTicket={handleUpdateTicket}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && activeTicket && (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-subtle rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-danger">
              <div className="w-10 h-10 rounded-xl bg-danger-soft flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink">{t("ticketEditor.deleteConfirmTitle")}</h4>
                <p className="text-xs font-mono font-bold text-danger mt-0.5">{activeTicket.reportNo}</p>
              </div>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              {t("ticketEditor.deleteConfirmMessage", { reportNo: activeTicket.reportNo })}
            </p>

            <div className="p-3 bg-danger-soft/40 border border-danger/20 rounded-xl text-[11px] text-danger-fg">
              Warning: This report will be permanently deleted from the database, queue views, and all linked records.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-ink bg-cushion hover:bg-subtle border border-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-danger text-white hover:bg-danger/90 shadow-soft-sm disabled:opacity-60"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode Selection Modal (Popup after search/select) ── */}
      {showModeModal && activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-subtle rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-6 animate-scaleUp">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-accent-soft text-accent border border-accent/20 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5" /> ជ្រើសរើសទម្រង់កែសម្រួល (Choose Edit Mode)
                </span>
                <h2 className="text-lg sm:text-xl font-black text-ink tracking-tight">
                  តើអ្នកចង់កែសម្រួលរបាយការណ៍នេះតាមទម្រង់មួយណា?
                </h2>
                <div className="text-xs text-ink-muted mt-1.5 flex flex-wrap items-center gap-2">
                  <span>Report No: <strong className="text-ink font-mono">{activeTicket.reportNo}</strong></span>
                  <span>•</span>
                  <span className="truncate max-w-xs">{activeTicket.companyName || "N/A"}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cushion text-ink-secondary border border-subtle">
                    {activeTicket.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                className="p-1.5 rounded-xl text-ink-muted hover:text-ink hover:bg-cushion transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-ink-secondary">
              សូមជ្រើសរើសទម្រង់មួយ ដើម្បីបង្ហាញពេញអេក្រង់ (Full Screen Responsive Resolution) ងាយស្រួលមើល និងកែសម្រួល៖
            </p>

            {/* 2 Options Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Form Fields */}
              <div
                onClick={() => {
                  setViewMode("fields");
                  setShowModeModal(false);
                }}
                className="group p-5 rounded-2xl border-2 border-subtle hover:border-accent bg-cushion/40 hover:bg-accent-soft/20 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-soft-md"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Layout className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-ink group-hover:text-accent transition-colors">
                    ទម្រង់បែបបទ (Form Fields)
                  </h3>
                  <p className="text-[11px] text-ink-muted mt-1.5 leading-relaxed">
                    កែសម្រួលតាមប្រអប់ Field ពេញអេក្រង់ ងាយស្រួលវាយបញ្ចូល និងស្វែងរកគ្រឿងបន្លាស់។
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[11px] text-ink-secondary">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>បំពេញតាមផ្នែកនីមួយៗ (1 ដល់ 6)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Search & Select ក្រុមហ៊ុន/ម៉ូដែល</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>Full Screen ធំទូលាយ មិនចង្អៀត</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-subtle/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-accent group-hover:underline">
                    ជ្រើសរើសទម្រង់ Form →
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface text-ink-muted border border-subtle">
                    Form Mode
                  </span>
                </div>
              </div>

              {/* Option 2: Live Report */}
              <div
                onClick={() => {
                  setViewMode("report");
                  setShowModeModal(false);
                }}
                className="group p-5 rounded-2xl border-2 border-subtle hover:border-emerald-500 bg-cushion/40 hover:bg-emerald-500/10 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-soft-md"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-ink group-hover:text-emerald-600 transition-colors">
                    ទម្រង់របាយការណ៍ (Live Report)
                  </h3>
                  <p className="text-[11px] text-ink-muted mt-1.5 leading-relaxed">
                    បង្ហាញសន្លឹករបាយការណ៍ A4 ពិតប្រាកដពេញអេក្រង់ និងអាចចុចកែប្រែផ្ទាល់លើក្រដាស A4 បាន។
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[11px] text-ink-secondary">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>ឃើញទម្រង់បោះពុម្ព A4 ជាក់ស្តែង</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>ចុចលើក្រដាស A4 ដើម្បីកែប្រែភ្លាមៗ</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Full Screen ស្រួលផ្ទៀងផ្ទាត់</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-subtle/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 group-hover:underline">
                    ជ្រើសរើសទម្រង់ Report →
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface text-ink-muted border border-subtle">
                    A4 Mode
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-ink-muted text-center italic">
              * អ្នកអាចចុចប្តូរទម្រង់កែសម្រួលនៅខាងលើ Command Bar បានគ្រប់ពេលដោយមិនបាត់បង់ទិន្នន័យឡើយ។
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

export default function ServiceTicketsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-ink-muted">Loading Editor...</div>}>
      <ServiceTicketsContent />
    </Suspense>
  );
}
