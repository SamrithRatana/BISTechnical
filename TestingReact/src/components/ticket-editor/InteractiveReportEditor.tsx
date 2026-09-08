"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ZoomIn,
  ZoomOut,
  Edit3,
  Lock,
  Check,
  X,
  UserCheck,
  Package,
  Plus,
  Trash2,
  Search,
  ChevronDown,
  Loader2,
  Building2,
  Cpu,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";
import ReportSheet from "@/components/report/ReportSheet";
import { useReportTemplate } from "@/services/reportTemplate";
import { useBrandLogo } from "@/services/brandLogoStore";
import {
  matchSparePartInventory,
  sparePartLineId,
  resolveSparePartRow,
  ticketSparePartLines,
  type ResolvedSparePartRow,
  type ReportTicketLike,
} from "@/report-layout";
import {
  fetchSparePartsInventory,
  fetchSparePartById,
  fetchCustomerCenter,
  type CustomerItem,
  fetchItemsInventory,
  type ItemModel,
} from "@/services/api";
import { fetchUsersList, type UserDto } from "@/services/userService";
import {
  type RepairServiceItem,
  type SparePartItemDetail,
  toBackendLocalDateTime,
  isSparepartLockedStatus,
} from "@/services/types";
import HighlightText from "@/components/HighlightText";
import { getImageUrl } from "@/lib/utils";
import toast from "react-hot-toast";

function toLocalDatetimeValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(val: string): string {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  return toBackendLocalDateTime(d);
}

const CONDITIONS = ["Replace", "Fix", "Free"] as const;

function normalizeCondition(cond?: string): "Fix" | "Replace" | "Free" {
  const c = (cond || "").trim().toLowerCase();
  if (c === "fix") return "Fix";
  if (c === "free") return "Free";
  return "Replace";
}

interface ActiveInlineEdit {
  el: HTMLElement;
  finish: (commit: boolean) => void;
}

type PopoverState =
  | { type: "company"; rect: DOMRect; initialQuery?: string }
  | { type: "item"; rect: DOMRect; initialQuery?: string }
  | { type: "serviceType"; rect: DOMRect }
  | { type: "sparePart"; rowIndex: number; rect: DOMRect; initialQuery?: string }
  | { type: "condition"; rowIndex: number; rect: DOMRect }
  | { type: "date"; dateKey: "dateStart" | "dateFinish"; rect: DOMRect }
  | { type: "signature"; role: "engineer" | "verify"; rect: DOMRect }
  | null;

interface InteractiveReportEditorProps {
  ticket: RepairServiceItem;
  onSelectSection?: (sectionId: string) => void;
  selectedSection?: string | null;
  onUpdateTicket?: (updated: RepairServiceItem) => void;
  readOnly?: boolean;
}

const getTicketParts = (t: RepairServiceItem): SparePartItemDetail[] =>
  (ticketSparePartLines(t as unknown as Record<string, unknown>) as unknown as SparePartItemDetail[]) || [];

export default function InteractiveReportEditor({
  ticket,
  onSelectSection,
  selectedSection,
  onUpdateTicket,
  readOnly = false,
}: InteractiveReportEditorProps) {
  const [zoom, setZoom] = useState<number>(0.85);
  const [sparePartRows, setSparePartRows] = useState<ResolvedSparePartRow[]>([]);
  const template = useReportTemplate();
  const brandLogoSrc = useBrandLogo() ?? undefined;

  // Available users for signatures
  const [availableUsers, setAvailableUsers] = useState<UserDto[]>([]);
  const [inventoryParts, setInventoryParts] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  // Active floating popover anchored directly to the clicked element
  const [activePopover, setActivePopover] = useState<PopoverState>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Active inline text edit on DOM
  const activeEditRef = useRef<ActiveInlineEdit | null>(null);
  const sheetContainerRef = useRef<HTMLDivElement>(null);

  // Keep latest ticket in a ref to eliminate stale closure state clobbering
  const latestTicketRef = useRef(ticket);
  latestTicketRef.current = ticket;

  const emitTicketUpdate = useCallback(
    (updater: Partial<RepairServiceItem> | ((prev: RepairServiceItem) => RepairServiceItem)) => {
      const cur = latestTicketRef.current;
      const next = typeof updater === "function" ? updater(cur) : { ...cur, ...updater };
      latestTicketRef.current = next;
      onUpdateTicket?.(next);
    },
    [onUpdateTicket]
  );


  // Company Search state inside popover
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [matchingCompanies, setMatchingCompanies] = useState<CustomerItem[]>([]);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);

  // Item Search state inside popover
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [matchingItems, setMatchingItems] = useState<ItemModel[]>([]);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  // Spare Part search query & on-demand paginated state inside popover (Enterprise standard: 25 per page)
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [sparePartsList, setSparePartsList] = useState<any[]>([]);
  const [sparePartsTotal, setSparePartsTotal] = useState(0);
  const [isSearchingParts, setIsSearchingParts] = useState(false);
  const [isLoadingMoreParts, setIsLoadingMoreParts] = useState(false);
  const [partsPage, setPartsPage] = useState(1);

  // Signature user search query inside popover
  const [sigSearchQuery, setSigSearchQuery] = useState("");
  const [customSigName, setCustomSigName] = useState("");
  const [customSigPhone, setCustomSigPhone] = useState("");

  // Date picker state inside popover
  const [tempDateValue, setTempDateValue] = useState("");

  const isFinished =
    (typeof ticket.status === "string" && ticket.status.trim().toLowerCase() === "finished") ||
    (ticket as any).statusId === 6 ||
    (ticket as any)._serviceStatusId === 6;

  const isSparepartLocked = isSparepartLockedStatus(ticket);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch users once (Zero full-catalogue upfront load)
  useEffect(() => {
    let isCurrent = true;
    async function initData() {
      try {
        const users = await fetchUsersList();
        if (!isCurrent) return;
        setAvailableUsers(users);
      } catch (err) {
        console.warn("Could not load users:", err);
      }
    }
    void initData();
    return () => {
      isCurrent = false;
    };
  }, []);

  // Resolve spare part rows for preview (on-demand per ticket line without loading full catalogue)
  useEffect(() => {
    let isMounted = true;
    async function resolveParts() {
      try {
        const rawParts = ticketSparePartLines(ticket as unknown as Record<string, unknown>);
        if (rawParts.length === 0) {
          if (isMounted) setSparePartRows([]);
          return;
        }

        const resolvedRows = await Promise.all(
          rawParts.map(async (raw, index) => {
            const lineId = sparePartLineId(raw);
            let match: any = undefined;
            if (lineId && lineId.length > 10) {
              match = (await fetchSparePartById(lineId)) ?? undefined;
            }
            return resolveSparePartRow(raw, match, index);
          })
        );

        if (isMounted) setSparePartRows(resolvedRows);
      } catch (err) {
        console.warn("Could not resolve spare parts for report preview:", err);
      }
    }
    void resolveParts();
    return () => {
      isMounted = false;
    };
  }, [ticket]);

  // Debounced on-demand paginated search for spare parts popover (25 items/batch)
  useEffect(() => {
    if (activePopover?.type !== "sparePart") return;
    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingParts(true);
      try {
        const res = await fetchSparePartsInventory(1, 25, partSearchQuery.trim());
        if (active) {
          setSparePartsList((res.items || []).filter((p) => !p.isDraft));
          setSparePartsTotal(res.totalCount || (res.items || []).length);
          setPartsPage(1);
        }
      } catch (err) {
        console.warn("Error fetching spare parts:", err);
      } finally {
        if (active) setIsSearchingParts(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activePopover?.type, partSearchQuery]);

  const handleSparePartsScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 25) {
      if (!isSearchingParts && !isLoadingMoreParts && sparePartsList.length < sparePartsTotal) {
        setIsLoadingMoreParts(true);
        try {
          const nextPage = partsPage + 1;
          const res = await fetchSparePartsInventory(nextPage, 25, partSearchQuery.trim());
          setSparePartsList((prev) => [...prev, ...((res.items || []).filter((p) => !p.isDraft))]);
          setPartsPage(nextPage);
        } catch (err) {
          console.warn("Failed to load more spare parts:", err);
        } finally {
          setIsLoadingMoreParts(false);
        }
      }
    }
  };

  // Click outside to close popovers
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup active edit if element is disconnected
  useEffect(() => {
    const active = activeEditRef.current;
    if (active && !active.el.isConnected) {
      active.finish(false);
    }
  });

  // Handle company search inside popover
  const handleCompanySearch = async (query: string) => {
    setCompanySearchQuery(query);
    if (!query.trim()) {
      setMatchingCompanies([]);
      return;
    }
    setIsSearchingCompanies(true);
    try {
      const res = await fetchCustomerCenter(1, 30, query.trim());
      setMatchingCompanies(res.items || []);
    } catch {
      // ignore
    } finally {
      setIsSearchingCompanies(false);
    }
  };

  const handleSelectCompany = (comp: CustomerItem) => {
    const rawContact = comp.contactName ?? (comp as any).contactPerson ?? (comp as any).attention ?? "";
    const cleanContact = rawContact && rawContact !== "—" ? rawContact.trim() : "";
    const rawPhone = comp.phoneNumber ?? (comp as any).phone ?? "";
    const cleanPhone = rawPhone && rawPhone !== "—" ? rawPhone.trim() : "";
    const rawAddress = comp.address ?? "";
    const cleanAddress = rawAddress && rawAddress !== "—" ? rawAddress.trim() : "";

    emitTicketUpdate({
      customerId: comp.id,
      companyName: comp.companyName,
      contactName: cleanContact,
      phoneNumber: cleanPhone,
      address: cleanAddress,
    });
    setActivePopover(null);
    toast.success(`បានជ្រើសរើសក្រុមហ៊ុន៖ ${comp.companyName}`);
  };

  // Handle item search inside popover
  const handleItemSearch = async (query: string) => {
    setItemSearchQuery(query);
    if (!query.trim()) {
      setMatchingItems([]);
      return;
    }
    setIsSearchingItems(true);
    try {
      const res = await fetchItemsInventory(1, 30, query.trim());
      setMatchingItems(res.items || []);
    } catch {
      // ignore
    } finally {
      setIsSearchingItems(false);
    }
  };

  const handleSelectItem = (item: ItemModel) => {
    emitTicketUpdate({
      itemId: item.id,
      itemName: item.itemName,
      serialNumber: item.serialNumber ? item.serialNumber.trim() : "",
    });
    setActivePopover(null);
    toast.success(`បានជ្រើសរើសម៉ូដែល៖ ${item.itemName}`);
  };


  const handleSelectPartForRow = (rowIndex: number, invPart: any) => {
    if (isSparepartLocked) return;
    if (activeEditRef.current) {
      activeEditRef.current.finish(true);
    }
    const cur = latestTicketRef.current;
    const existing = [...getTicketParts(cur)];
    const name = invPart.itemName || invPart.name || invPart.description || "Spare Part";
    const model = invPart.useFor || invPart.compatibleModel || cur.itemName || "Universal";
    const partNo = invPart.partNumber || invPart.serialNumber || invPart.code || "—";
    const price = invPart.defaultPrice ?? invPart.price ?? 0;

    const updatedRow: any = {
      ...(existing[rowIndex] || {}),
      id: existing[rowIndex]?.id || "part-" + Date.now(),
      sparePartId: invPart.id,
      sparepartId: invPart.id,
      SparepartId: invPart.id,
      itemName: name,
      description: name,
      useFor: model,
      partNumber: partNo,
      serialNumber: partNo,
      condition: normalizeCondition(existing[rowIndex]?.condition),
      quantity: existing[rowIndex]?.quantity || 1,
      defaultPrice: price,
    };
    existing[rowIndex] = updatedRow;

    emitTicketUpdate({
      sparepartItems: existing,
      sparePartItems: existing,
    });

    setSparePartRows((prev) => {
      const next = [...prev];
      next[rowIndex] = resolveSparePartRow(updatedRow, invPart, rowIndex);
      return next;
    });

    setActivePopover(null);
    toast.success(`បានបញ្ចូលបន្លាស់៖ ${name}`);
  };

  const handleCustomPartDescription = (rowIndex: number, desc: string) => {
    if (isSparepartLocked) return;
    if (activeEditRef.current) {
      activeEditRef.current.finish(true);
    }
    const cur = latestTicketRef.current;
    const existing = [...getTicketParts(cur)];
    const curRow = existing[rowIndex] || {
      id: "part-" + Date.now() + "-" + rowIndex,
      useFor: cur.itemName || "—",
      partNumber: "—",
      quantity: 1,
      condition: "Replace" as const,
      defaultPrice: 0,
      remarks: "",
    };
    const updatedRow: any = {
      ...curRow,
      sparePartId: "00000000-0000-0000-0000-000000000000",
      sparepartId: "00000000-0000-0000-0000-000000000000",
      SparepartId: "00000000-0000-0000-0000-000000000000",
      itemName: desc.trim(),
      description: desc.trim(),
    };
    existing[rowIndex] = updatedRow;

    emitTicketUpdate({
      sparepartItems: existing,
      sparePartItems: existing,
    });

    setSparePartRows((prev) => {
      const next = [...prev];
      next[rowIndex] = resolveSparePartRow(updatedRow, undefined, rowIndex);
      return next;
    });

    setActivePopover(null);
  };

  const handleAddNewSparepart = () => {
    if (isSparepartLocked) {
      toast.error("មិនអាចបន្ថែមគ្រឿងបន្លាស់ក្នុងស្ថានភាពនេះបានទេ (Locked)");
      return;
    }
    if (activeEditRef.current) {
      activeEditRef.current.finish(true);
    }
    const cur = latestTicketRef.current;
    const existing = [...getTicketParts(cur)];
    const newPart: SparePartItemDetail = {
      id: "part-" + Date.now(),
      sparePartId: "00000000-0000-0000-0000-000000000000",
      sparepartId: "00000000-0000-0000-0000-000000000000",
      itemName: "",
      description: "",
      useFor: cur.itemName || "—",
      quantity: 1,
      condition: "Replace",
      defaultPrice: 0,
      partNumber: "—",
    };
    const updated = [...existing, newPart];
    emitTicketUpdate({
      sparepartItems: updated,
      sparePartItems: updated,
    });
    setSparePartRows((prev) => [
      ...prev,
      resolveSparePartRow(newPart, undefined, updated.length - 1),
    ]);
    toast.success("បានបន្ថែមជួរគ្រឿងបន្លាស់ថ្មី");

    // Automatically anchor popover search to the newly created row's description cell
    setTimeout(() => {
      if (!sheetContainerRef.current) return;
      const rows = sheetContainerRef.current.querySelectorAll("tr[data-rpt-part-row]");
      const lastRow = rows[rows.length - 1];
      const descCell = lastRow?.querySelector('td[data-rpt-part-col="description"]') as HTMLElement;
      if (descCell) {
        setPartSearchQuery("");
        setActivePopover({
          type: "sparePart",
          rowIndex: updated.length - 1,
          rect: descCell.getBoundingClientRect(),
          initialQuery: "",
        });
      }
    }, 120);
  };

  const handleRemovePart = (index: number) => {
    if (isSparepartLocked) {
      toast.error("មិនអាចលុបគ្រឿងបន្លាស់ក្នុងស្ថានភាពនេះបានទេ (Locked)");
      return;
    }
    if (activeEditRef.current) {
      activeEditRef.current.finish(true);
    }
    const cur = latestTicketRef.current;
    const existing = [...getTicketParts(cur)];
    existing.splice(index, 1);
    emitTicketUpdate({
      sparepartItems: existing,
      sparePartItems: existing,
    });
    setSparePartRows((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    toast.success("បានលុបគ្រឿងបន្លាស់ចេញពីតារាង");
  };

  // Direct Inline ContentEditable Text Editor Manager
  const startInlineTextEdit = (
    el: HTMLElement,
    initialValue: string,
    onCommit: (newValue: string) => void,
    isSingleLine = false
  ) => {
    if (readOnly) return;
    if (activeEditRef.current) {
      activeEditRef.current.finish(true);
    }

    const rawCurrent = el.innerText.trim();
    if (rawCurrent === "—") {
      el.innerText = "";
    }

    el.contentEditable = "true";
    el.spellcheck = false;
    el.dataset.rptEditing = "true";
    el.focus();

    // Position cursor at end of text
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      // ignore
    }

    let finished = false;
    const finish = (commit: boolean) => {
      if (finished) return;
      finished = true;
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKeyDown);
      el.contentEditable = "false";
      delete el.dataset.rptEditing;
      activeEditRef.current = null;

      if (commit) {
        const val = el.innerText.trim();
        onCommit(val);
      } else {
        el.innerText = initialValue || "—";
      }
    };

    const onBlur = () => finish(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (isSingleLine && e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
    };

    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKeyDown);
    activeEditRef.current = { el, finish };
  };

  // Main Sheet Click Router for In-Place Interactions
  const handleSheetClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const target = e.target as HTMLElement;

    // ── 1. Checkboxes & Dates in Header Boxes ──
    const boxEl = target.closest<HTMLElement>("[data-rpt-box]");
    if (boxEl) {
      const boxKey = boxEl.dataset.rptBox;
      if (boxKey === "onSite") {
        emitTicketUpdate({ serviceLocation: "OnSite" });
        return;
      }
      if (boxKey === "companyService") {
        emitTicketUpdate({ serviceLocation: "CompanyService" });
        return;
      }
      if (boxKey === "contract") {
        emitTicketUpdate({ hasContract: !latestTicketRef.current.hasContract });
        return;
      }
      if (boxKey === "dateStart" || boxKey === "dateFinish" || boxKey === "dateWaiting") {
        const cur = latestTicketRef.current;
        const rect = boxEl.getBoundingClientRect();
        const initialIso = boxKey === "dateFinish" ? cur.finishedDate : cur.serviceDate;
        setTempDateValue(toLocalDatetimeValue(initialIso));
        setActivePopover({
          type: "date",
          dateKey: boxKey === "dateFinish" ? "dateFinish" : "dateStart",
          rect,
        });
        return;
      }
    }

    // ── 2. Customer & Instrument Info Rows ──
    const fieldEl =
      target.closest<HTMLElement>("[data-rpt-field]") ||
      target.closest<HTMLElement>(".rpt-inforow")?.querySelector<HTMLElement>("[data-rpt-field]");
    if (fieldEl) {
      const field = fieldEl.dataset.rptField;
      const rect = fieldEl.getBoundingClientRect();

      if (field === "companyName") {
        const q = ticket.companyName || "";
        setCompanySearchQuery(q);
        void handleCompanySearch(q);
        setActivePopover({
          type: "company",
          rect,
          initialQuery: q,
        });
        return;
      }

      if (field === "itemName") {
        const q = ticket.itemName || "";
        setItemSearchQuery(q);
        void handleItemSearch(q);
        setActivePopover({
          type: "item",
          rect,
          initialQuery: q,
        });
        return;
      }

      if (field === "serialNumber") {
        toast("🔒 លេខកូដម៉ាស៊ីន (Serial Number) ត្រូវបានចាក់សោភ្ជាប់តាម Model ម៉ាស៊ីន (Read-only)", {
          icon: "🔒",
        });
        return;
      }

      if (field === "contactName") {
        toast("🔒 អ្នកទទួលខុសត្រូវ (Attention) ត្រូវបានចាក់សោភ្ជាប់តាមឈ្មោះក្រុមហ៊ុន (Read-only)", {
          icon: "🔒",
        });
        return;
      }

      if (field === "phoneNumber") {
        toast("🔒 លេខទូរស័ព្ទ (Tel) ត្រូវបានចាក់សោភ្ជាប់តាមឈ្មោះក្រុមហ៊ុន (Read-only)", {
          icon: "🔒",
        });
        return;
      }

      if (field === "address") {
        toast("🔒 អាសយដ្ឋាន (Address) ត្រូវបានចាក់សោភ្ជាប់តាមឈ្មោះក្រុមហ៊ុន (Read-only)", {
          icon: "🔒",
        });
        return;
      }

      if (field === "serviceType") {
        setActivePopover({
          type: "serviceType",
          rect,
        });
        return;
      }
    }

    // ── 3. Multiline Problem / Diagnostic / Solution Sections ──
    const bodyEl = target.closest<HTMLElement>("[data-rpt-body]");
    if (bodyEl) {
      const bodyKey = bodyEl.dataset.rptBody;
      let initialVal = "";
      if (bodyKey === "request") initialVal = ticket.customerRequest || "";
      else if (bodyKey === "diagnostic") initialVal = ticket.inspection || "";
      else if (bodyKey === "solution") initialVal = ticket.solution || "";

      startInlineTextEdit(
        bodyEl,
        initialVal,
        (newVal) => {
          if (bodyKey === "request") emitTicketUpdate({ customerRequest: newVal });
          else if (bodyKey === "diagnostic") emitTicketUpdate({ inspection: newVal });
          else if (bodyKey === "solution") emitTicketUpdate({ solution: newVal });
        },
        false
      );
      return;
    }

    // ── 4. Spare Parts Table Add/Del Action or Cells ──
    const delRowBtn = target.closest<HTMLElement>("[data-rpt-del-row]");
    if (delRowBtn) {
      const idx = parseInt(delRowBtn.dataset.rptDelRow || "-1", 10);
      if (idx >= 0) {
        handleRemovePart(idx);
      }
      return;
    }

    const addRowBtn = target.closest<HTMLElement>("[data-rpt-add-row]");
    if (addRowBtn) {
      handleAddNewSparepart();
      return;
    }

    const partCell = target.closest<HTMLElement>("[data-rpt-part-col]");
    const emptyRowEl = target.closest<HTMLElement>("[data-rpt-part-empty]");

    if (partCell) {
      const col = partCell.dataset.rptPartCol;
      const rowEl = partCell.closest<HTMLElement>("[data-rpt-part-row]") || emptyRowEl;
      if (rowEl) {
        const rowIdx = parseInt(rowEl.dataset.rptPartRow || "0", 10);
        const rect = partCell.getBoundingClientRect();

        if (isSparepartLocked) {
          toast("🔒 គ្រឿងបន្លាស់ត្រូវបានចាក់សោសម្រាប់ស្ថានភាពនេះ (Read-only)", { icon: "🔒" });
          return;
        }

        const ensureRowAt = (idx: number): SparePartItemDetail[] => {
          const cur = latestTicketRef.current;
          const parts = [...getTicketParts(cur)];
          if (!parts[idx]) {
            parts[idx] = {
              id: "part-" + Date.now() + "-" + idx,
              sparePartId: "00000000-0000-0000-0000-000000000000",
              sparepartId: "00000000-0000-0000-0000-000000000000",
              itemName: "",
              description: "",
              useFor: cur.itemName || "—",
              partNumber: "—",
              quantity: 1,
              condition: "Replace",
              defaultPrice: 0,
              remarks: "",
            };
          }
          return parts;
        };

        if (col === "no" || col === "index") {
          const parts = ensureRowAt(rowIdx);
          emitTicketUpdate({
            sparepartItems: parts,
            sparePartItems: parts,
          });
          const descCell = rowEl.querySelector<HTMLElement>('[data-rpt-part-col="description"]') || partCell;
          setPartSearchQuery("");
          setActivePopover({
            type: "sparePart",
            rowIndex: rowIdx,
            rect: descCell.getBoundingClientRect(),
            initialQuery: "",
          });
          return;
        }

        if (col === "description") {
          const currentParts = getTicketParts(latestTicketRef.current);
          const q = currentParts?.[rowIdx]?.description || currentParts?.[rowIdx]?.itemName || "";
          setPartSearchQuery(q);
          setActivePopover({
            type: "sparePart",
            rowIndex: rowIdx,
            rect,
            initialQuery: q,
          });
          return;
        }

        if (col === "condition") {
          const parts = ensureRowAt(rowIdx);
          const currentParts = getTicketParts(latestTicketRef.current);
          if (!currentParts?.[rowIdx]) {
            emitTicketUpdate({
              sparepartItems: parts,
              sparePartItems: parts,
            });
          }
          setActivePopover({
            type: "condition",
            rowIndex: rowIdx,
            rect,
          });
          return;
        }

        if (col === "useFor") {
          toast("🔒 ម៉ូដែលប្រើប្រាស់ (Use For) ត្រូវបានចាក់សោភ្ជាប់តាមគ្រឿងបន្លាស់ (Read-only)", {
            icon: "🔒",
          });
          return;
        }

        if (col === "partNo") {
          toast("🔒 លេខកូដបន្លាស់ (Part No) ត្រូវបានចាក់សោភ្ជាប់តាមគ្រឿងបន្លាស់ (Read-only)", {
            icon: "🔒",
          });
          return;
        }

        if (col === "remarks") {
          const currentParts = getTicketParts(latestTicketRef.current);
          const curVal = currentParts?.[rowIdx]?.remarks || "";
          startInlineTextEdit(
            partCell,
            curVal,
            (newVal) => {
              const parts = ensureRowAt(rowIdx);
              parts[rowIdx] = { ...parts[rowIdx], remarks: newVal };
              emitTicketUpdate({
                sparepartItems: parts,
                sparePartItems: parts,
              });
              setSparePartRows((prev) => {
                const next = [...prev];
                if (next[rowIdx]) {
                  next[rowIdx] = { ...next[rowIdx], remarks: newVal };
                }
                return next;
              });
            },
            true
          );
          return;
        }

        if (col === "qty") {
          const currentParts = getTicketParts(latestTicketRef.current);
          const curQty = String(currentParts?.[rowIdx]?.quantity || 1);
          startInlineTextEdit(
            partCell,
            curQty,
            (newVal) => {
              const q = Math.max(1, parseInt(newVal, 10) || 1);
              const parts = ensureRowAt(rowIdx);
              parts[rowIdx] = { ...parts[rowIdx], quantity: q };
              emitTicketUpdate({
                sparepartItems: parts,
                sparePartItems: parts,
              });
              setSparePartRows((prev) => {
                const next = [...prev];
                if (next[rowIdx]) {
                  next[rowIdx] = { ...next[rowIdx], quantity: q };
                }
                return next;
              });
            },
            true
          );
          return;
        }
      }
    } else if (emptyRowEl) {
      if (isSparepartLocked) {
        toast("🔒 គ្រឿងបន្លាស់ត្រូវបានចាក់សោសម្រាប់ស្ថានភាពនេះ (Read-only)", { icon: "🔒" });
        return;
      }
      handleAddNewSparepart();
      return;
    }

    // ── 5. Signatures (Engineer & Verifier) ──
    const sigRoleEl = target.closest<HTMLElement>("[data-rpt-sig-role]");
    if (sigRoleEl) {
      const role = sigRoleEl.dataset.rptSigRole as "engineer" | "verify" | "customer";
      if (role === "engineer" || role === "verify") {
        const rect = sigRoleEl.getBoundingClientRect();
        setSigSearchQuery("");
        setCustomSigName(role === "engineer" ? ticket.repairByName || "" : ticket.verifiedByName || "");
        setCustomSigPhone(role === "engineer" ? ticket.repairByPhone || "" : ticket.verifiedByPhone || "");
        setActivePopover({
          type: "signature",
          role,
          rect,
        });
        return;
      }
    }
  };


  // Calculate Popover Placement coordinates (Flip above if space below is too tight)
  const popoverCoords = useMemo(() => {
    if (!activePopover) return null;
    const rect = activePopover.rect;
    const estHeight =
      activePopover.type === "company" || activePopover.type === "item" || activePopover.type === "sparePart"
        ? 280
        : activePopover.type === "signature"
        ? 300
        : 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < estHeight && spaceAbove > spaceBelow;

    const width =
      activePopover.type === "company" || activePopover.type === "item" || activePopover.type === "sparePart"
        ? Math.min(420, window.innerWidth - 32)
        : activePopover.type === "signature"
        ? 340
        : 260;

    let left = rect.left;
    if (left + width > window.innerWidth - 16) {
      left = window.innerWidth - width - 16;
    }
    if (left < 16) left = 16;

    return {
      top: placeAbove ? undefined : rect.bottom + 6,
      bottom: placeAbove ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width,
      placeAbove,
    };
  }, [activePopover]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-cushion/40 rounded-2xl border border-subtle overflow-hidden">
      {/* ── Direct Inline Editing Toolbar ── */}
      <div className="px-4 py-2.5 bg-surface border-b border-subtle flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Direct Live A4 Report Editor</span>
          </span>
          <span className="text-[11px] text-ink-muted hidden md:inline">
            (ចុចសរសេរផ្ទាល់លើក្រដាស · ចុចធីក Checkbox · ជ្រើសរើសបន្លាស់ / ក្រុមហ៊ុន)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Add Spare Part Button */}
          {!readOnly && !isSparepartLocked && (
            <button
              type="button"
              onClick={handleAddNewSparepart}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl bg-accent-soft text-accent hover:bg-accent hover:text-white border border-accent/20 transition-all shadow-2xs cursor-pointer"
              title="បន្ថែមគ្រឿងបន្លាស់ថ្មីចូលក្នុងតារាងរបាយការណ៍"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ បន្ថែមគ្រឿងបន្លាស់</span>
            </button>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-cushion px-2 py-0.5 rounded-xl border border-subtle">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1 rounded text-ink-muted hover:text-ink transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold text-ink w-11 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
              className="p-1 rounded text-ink-muted hover:text-ink transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Document Canvas with In-Place Interactive Zones ── */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start">
        <div
          ref={sheetContainerRef}
          onClick={handleSheetClick}
          className="interactive-report-sheet relative shadow-2xl rounded-sm transition-transform duration-150 origin-top"
          data-sparepart-locked={isSparepartLocked ? "true" : undefined}
        >
          {/* Base A4 Report Layout */}
          <ReportSheet
            item={ticket as unknown as ReportTicketLike}
            sparePartRows={sparePartRows}
            settings={template}
            zoom={zoom}
            brandLogoSrc={brandLogoSrc}
            interactive={true}
          />
        </div>
      </div>

      {/* ── Floating In-Place Popovers Mounted via Portal ── */}
      {mounted &&
        activePopover &&
        popoverCoords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: popoverCoords.top,
              bottom: popoverCoords.bottom,
              left: popoverCoords.left,
              width: popoverCoords.width,
              zIndex: 99999,
            }}
            className="bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100 flex flex-col"
          >
            {/* Popover 1: Company Autocomplete */}
            {activePopover.type === "company" && (
              <>
                <div className="p-2.5 bg-cushion/90 border-b border-subtle flex items-center justify-between font-semibold text-ink-secondary">
                  <span className="flex items-center gap-1.5 text-xs text-ink font-bold">
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    <span>ជ្រើសរើសក្រុមហ៊ុន ({matchingCompanies.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePopover(null)}
                    className="text-ink-muted hover:text-ink font-bold p-1 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-2.5 border-b border-subtle bg-surface">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={companySearchQuery}
                      onChange={(e) => void handleCompanySearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && companySearchQuery.trim()) {
                          e.preventDefault();
                          emitTicketUpdate({ companyName: companySearchQuery.trim() });
                          setActivePopover(null);
                        }
                      }}
                      placeholder="វាយឈ្មោះក្រុមហ៊ុនដើម្បីស្វែងរក..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-subtle bg-cushion/30 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {isSearchingCompanies && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent absolute right-2.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-subtle">
                  {matchingCompanies.length === 0 ? (
                    <div className="p-4 text-center text-xs text-ink-muted">
                      {isSearchingCompanies ? (
                        "កំពុងស្វែងរក..."
                      ) : (
                        <>
                          មិនមានក្រុមហ៊ុនឈ្មោះ &ldquo;{companySearchQuery}&rdquo; ទេ។<br />
                          <button
                            type="button"
                            onClick={() => {
                              if (companySearchQuery.trim()) {
                                emitTicketUpdate({ companyName: companySearchQuery.trim() });
                              }
                              setActivePopover(null);
                            }}
                            className="mt-2 px-3 py-1 bg-accent text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            ប្រើឈ្មោះ &ldquo;{companySearchQuery}&rdquo; នេះផ្ទាល់
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    matchingCompanies.slice(0, 30).map((comp) => (
                      <div
                        key={comp.id}
                        onClick={() => handleSelectCompany(comp)}
                        className="p-2.5 hover:bg-accent-soft/40 cursor-pointer flex flex-col gap-0.5 transition-colors"
                      >
                        <div className="font-bold text-xs text-ink">
                          <HighlightText text={comp.companyName} query={companySearchQuery} />
                        </div>
                        <div className="text-[10.5px] text-ink-muted flex items-center gap-2">
                          <span>👤 {comp.contactName || "—"}</span>
                          <span>📞 {comp.phoneNumber || "—"}</span>
                        </div>
                        {comp.address && (
                          <div className="text-[10px] text-ink-muted/80 truncate">
                            📍 {comp.address}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Popover 2: Item Model Autocomplete */}
            {activePopover.type === "item" && (
              <>
                <div className="p-2.5 bg-cushion/90 border-b border-subtle flex items-center justify-between font-semibold text-ink-secondary">
                  <span className="flex items-center gap-1.5 text-xs text-ink font-bold">
                    <Cpu className="w-3.5 h-3.5 text-accent" />
                    <span>ជ្រើសរើសម៉ូដែលម៉ាស៊ីន ({matchingItems.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePopover(null)}
                    className="text-ink-muted hover:text-ink font-bold p-1 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-2.5 border-b border-subtle bg-surface">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={itemSearchQuery}
                      onChange={(e) => void handleItemSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && itemSearchQuery.trim()) {
                          e.preventDefault();
                          emitTicketUpdate({ itemName: itemSearchQuery.trim() });
                          setActivePopover(null);
                        }
                      }}
                      placeholder="វាយឈ្មោះម៉ូដែលផលិតផល..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-subtle bg-cushion/30 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {isSearchingItems && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent absolute right-2.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-subtle">
                  {matchingItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-ink-muted">
                      {isSearchingItems ? (
                        "កំពុងស្វែងរក..."
                      ) : (
                        <>
                          មិនមានម៉ូដែល &ldquo;{itemSearchQuery}&rdquo; ទេ។<br />
                          <button
                            type="button"
                            onClick={() => {
                              if (itemSearchQuery.trim()) {
                                emitTicketUpdate({ itemName: itemSearchQuery.trim() });
                              }
                              setActivePopover(null);
                            }}
                            className="mt-2 px-3 py-1 bg-accent text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            ប្រើឈ្មោះ &ldquo;{itemSearchQuery}&rdquo; នេះផ្ទាល់
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    matchingItems.slice(0, 30).map((itm) => (
                      <div
                        key={itm.id}
                        onClick={() => handleSelectItem(itm)}
                        className="p-2.5 hover:bg-accent-soft/40 cursor-pointer flex flex-col gap-0.5 transition-colors"
                      >
                        <div className="font-bold text-xs text-ink">
                          <HighlightText text={itm.itemName} query={itemSearchQuery} />
                        </div>
                        <div className="text-[10.5px] text-ink-muted flex items-center gap-2">
                          <span>S/N: {itm.serialNumber || "—"}</span>
                          {itm.itemType && <span>Type: {itm.itemType}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Popover 3: Service Type Toggle */}
            {activePopover.type === "serviceType" && (
              <div className="p-3 space-y-2">
                <div className="font-bold text-xs text-ink mb-1">ជ្រើសរើសប្រភេទសេវាកម្ម (Type of Service)</div>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      emitTicketUpdate({
                        serviceType: "Free",
                        serviceTypeId: 1,
                      });
                      setActivePopover(null);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-all border ${
                      (ticket.serviceType || "").toLowerCase() === "free"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-surface hover:bg-cushion text-ink border-subtle"
                    }`}
                  >
                    <span>Free (ជួសជុលមិនគិតលុយ)</span>
                    {(ticket.serviceType || "").toLowerCase() === "free" && <Check className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      emitTicketUpdate({
                        serviceType: "Charge",
                        serviceTypeId: 2,
                      });
                      setActivePopover(null);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-all border ${
                      (ticket.serviceType || "").toLowerCase() === "charge"
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "bg-surface hover:bg-cushion text-ink border-subtle"
                    }`}
                  >
                    <span>Charge (ជួសជុលគិតលុយ)</span>
                    {(ticket.serviceType || "").toLowerCase() === "charge" && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Popover 4: Spare Part Autocomplete (On-demand paginated scroll list - Enterprise standard) */}
            {activePopover.type === "sparePart" && (
              <>
                <div className="p-2.5 bg-cushion/90 border-b border-subtle flex items-center justify-between font-semibold text-ink-secondary">
                  <span className="flex items-center gap-1.5 text-xs text-ink font-bold">
                    <Package className="w-3.5 h-3.5 text-accent" />
                    <span>រើសគ្រឿងបន្លាស់ ({sparePartsTotal})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePopover(null)}
                    className="text-ink-muted hover:text-ink font-bold p-1 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-2.5 border-b border-subtle bg-surface">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={partSearchQuery}
                      onChange={(e) => setPartSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && partSearchQuery.trim()) {
                          e.preventDefault();
                          handleCustomPartDescription(activePopover.rowIndex, partSearchQuery);
                        }
                      }}
                      placeholder="ស្វែងរកឈ្មោះបន្លាស់ / Code / ម៉ូដែល..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-subtle bg-cushion/30 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {isSearchingParts && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent absolute right-2.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                <div
                  onScroll={handleSparePartsScroll}
                  className="max-h-60 overflow-y-auto divide-y divide-subtle"
                >
                  {isSearchingParts && sparePartsList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-ink-muted flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <span>កំពុងស្វែងរក...</span>
                    </div>
                  ) : sparePartsList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-ink-muted">
                      រកមិនឃើញគ្រឿងបន្លាស់ត្រូវគ្នានឹង &ldquo;{partSearchQuery}&rdquo; ទេ។<br />
                      <button
                        type="button"
                        onClick={() => handleCustomPartDescription(activePopover.rowIndex, partSearchQuery)}
                        className="mt-2 px-3 py-1 bg-accent text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        ប្រើឈ្មោះ &ldquo;{partSearchQuery}&rdquo; នេះផ្ទាល់
                      </button>
                    </div>
                  ) : (
                    <>
                      {sparePartsList.map((invPart) => {
                        const stockQty = invPart.quantity ?? 0;
                        const partName = invPart.itemName || invPart.name || invPart.description || "Spare Part";
                        const partCode = invPart.partNumber || invPart.serialNumber || invPart.code || "—";
                        const partModel = invPart.useFor || invPart.compatibleModel || "Universal";

                        return (
                          <div
                            key={invPart.id}
                            onClick={() => handleSelectPartForRow(activePopover.rowIndex, invPart)}
                            className="p-2.5 hover:bg-accent-soft/40 cursor-pointer flex items-center gap-3 transition-colors"
                          >
                            {invPart.pictureUrl ? (
                              <img
                                src={getImageUrl(invPart.pictureUrl)}
                                alt=""
                                className="w-8 h-8 rounded-lg object-cover border border-subtle shrink-0 bg-white"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-cushion border border-subtle flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-ink-muted" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs text-ink truncate">
                                <HighlightText text={partName} query={partSearchQuery} />
                              </div>
                              <div className="text-[10.5px] text-ink-muted truncate">
                                Code: <HighlightText text={partCode} query={partSearchQuery} /> · For: <HighlightText text={partModel} query={partSearchQuery} />
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                stockQty <= 0
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : stockQty <= 2
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              }`}
                            >
                              {stockQty <= 0 ? "Out" : `${stockQty} In`}
                            </span>
                          </div>
                        );
                      })}
                      {isLoadingMoreParts && (
                        <div className="p-2.5 text-center text-xs text-ink-muted flex items-center justify-center gap-1.5 bg-cushion/40">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                          <span>កំពុងទាញទិន្នន័យបន្ថែម...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Popover 5: Spare Part Condition Popover */}
            {activePopover.type === "condition" && (
              <div className="p-2.5 space-y-1.5">
                <div className="font-bold text-xs text-ink mb-1">Condition (ស្ថានភាពបន្លាស់)</div>
                {CONDITIONS.map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => {
                      const cur = latestTicketRef.current;
                      const parts = [...getTicketParts(cur)];
                      const curPart = parts[activePopover.rowIndex] || {
                        id: "part-" + Date.now(),
                        sparePartId: "00000000-0000-0000-0000-000000000000",
                        sparepartId: "00000000-0000-0000-0000-000000000000",
                        SparepartId: "00000000-0000-0000-0000-000000000000",
                        itemName: "",
                        description: "",
                        useFor: cur.itemName || "—",
                        partNumber: "—",
                        quantity: 1,
                        defaultPrice: 0,
                        remarks: "",
                      };
                      parts[activePopover.rowIndex] = {
                        ...curPart,
                        condition: cond,
                      };
                      emitTicketUpdate({
                        sparepartItems: parts,
                        sparePartItems: parts,
                      });
                      setSparePartRows((prev) => {
                        const next = [...prev];
                        if (next[activePopover.rowIndex]) {
                          next[activePopover.rowIndex] = {
                            ...next[activePopover.rowIndex],
                            condition: cond,
                          };
                        }
                        return next;
                      });
                      setActivePopover(null);
                    }}
                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-accent hover:text-white transition-all text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>{cond}</span>
                    {getTicketParts(latestTicketRef.current)?.[activePopover.rowIndex]?.condition === cond && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Popover 6: Date Picker Popover */}
            {activePopover.type === "date" && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-subtle pb-1.5">
                  <span className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>
                      {activePopover.dateKey === "dateFinish" ? "Date Finish (កាលបរិច្ឆេទបញ្ចប់)" : "Date Start (កាលបរិច្ឆេទចាប់ផ្តើម)"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePopover(null)}
                    className="text-ink-muted hover:text-ink font-bold p-1 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <input
                    type="datetime-local"
                    value={tempDateValue}
                    onChange={(e) => setTempDateValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-subtle bg-cushion text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (activePopover.dateKey === "dateFinish") {
                        emitTicketUpdate({ finishedDate: undefined });
                      } else {
                        emitTicketUpdate({ serviceDate: "" });
                      }
                      setActivePopover(null);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg text-ink-muted hover:text-ink border border-subtle cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const backendVal = fromLocalDatetimeValue(tempDateValue);
                      if (activePopover.dateKey === "dateFinish") {
                        emitTicketUpdate({ finishedDate: backendVal });
                      } else {
                        emitTicketUpdate({ serviceDate: backendVal });
                      }
                      setActivePopover(null);
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-accent text-white hover:bg-accent/90 cursor-pointer shadow-soft-sm"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Popover 7: Signatures User Picker */}
            {activePopover.type === "signature" && (
              <div className="flex flex-col">
                <div className="p-2.5 bg-cushion/90 border-b border-subtle flex items-center justify-between font-semibold text-ink-secondary">
                  <span className="flex items-center gap-1.5 text-xs text-ink font-bold">
                    <UserCheck className="w-3.5 h-3.5 text-accent" />
                    <span>
                      {activePopover.role === "engineer" ? "ជ្រើសរើសវិស្វករ (Engineer)" : "ជ្រើសរើសអ្នកផ្ទៀងផ្ទាត់ (Verifier)"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePopover(null)}
                    className="text-ink-muted hover:text-ink font-bold p-1 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-2.5 border-b border-subtle bg-surface">
                  <input
                    type="text"
                    value={sigSearchQuery}
                    onChange={(e) => setSigSearchQuery(e.target.value)}
                    placeholder="ស្វែងរកតាមឈ្មោះបុគ្គលិក..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-subtle bg-cushion/30 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-subtle">
                  {availableUsers
                    .filter((u) => {
                      if (!sigSearchQuery.trim()) return true;
                      const q = sigSearchQuery.toLowerCase();
                      const name = `${u.firstName || ""} ${u.lastName || ""} ${u.userName || ""}`.toLowerCase();
                      return name.includes(q);
                    })
                    .map((user) => {
                      const fullName = user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.userName;
                      return (
                        <div
                          key={user.id}
                          onClick={() => {
                            if (activePopover.role === "engineer") {
                              emitTicketUpdate({
                                repairBy: user.id,
                                repairByName: fullName,
                                repairByPhone: user.phoneNumber || latestTicketRef.current.repairByPhone || "",
                              });
                            } else {
                              emitTicketUpdate({
                                verifiedBy: user.id,
                                verifiedByName: fullName,
                                verifiedByPhone: user.phoneNumber || latestTicketRef.current.verifiedByPhone || "",
                              });
                            }
                            setActivePopover(null);
                            toast.success(`បានជ្រើសរើស៖ ${fullName}`);
                          }}
                          className="p-2 hover:bg-accent-soft/40 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="font-bold text-xs text-ink">{fullName}</div>
                            <div className="text-[10px] text-ink-muted">📞 {user.phoneNumber || "គ្មានលេខទូរស័ព្ទ"}</div>
                          </div>
                          <span className="text-[10px] text-ink-muted">{user.roles?.join(", ") || "Staff"}</span>
                        </div>
                      );
                    })}
                </div>

                <div className="p-2.5 border-t border-subtle bg-cushion/40 space-y-2">
                  <div className="text-[11px] font-bold text-ink">ឬ វាយបញ្ចូលឈ្មោះផ្ទាល់ខ្លួន៖</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="ឈ្មោះ"
                      value={customSigName}
                      onChange={(e) => setCustomSigName(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-subtle bg-surface text-ink"
                    />
                    <input
                      type="text"
                      placeholder="លេខទូរស័ព្ទ"
                      value={customSigPhone}
                      onChange={(e) => setCustomSigPhone(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-subtle bg-surface text-ink"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (activePopover.role === "engineer") {
                        emitTicketUpdate({
                          repairByName: customSigName.trim(),
                          repairByPhone: customSigPhone.trim(),
                        });
                      } else {
                        emitTicketUpdate({
                          verifiedByName: customSigName.trim(),
                          verifiedByPhone: customSigPhone.trim(),
                        });
                      }
                      setActivePopover(null);
                    }}
                    className="w-full py-1 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 cursor-pointer"
                  >
                    អនុវត្ត
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* ── Scoped Interactive Styles for Direct In-Place Editing on Sheet ── */}
      <style>{`
        /* Clickable and Hover-interactive affordances */
        .interactive-report-sheet [data-rpt-box="onSite"],
        .interactive-report-sheet [data-rpt-box="companyService"],
        .interactive-report-sheet [data-rpt-box="contract"],
        .interactive-report-sheet [data-rpt-box="dateStart"],
        .interactive-report-sheet [data-rpt-box="dateFinish"],
        .interactive-report-sheet [data-rpt-box="dateWaiting"],
        .interactive-report-sheet [data-rpt-field="companyName"],
        .interactive-report-sheet [data-rpt-field="itemName"],
        .interactive-report-sheet [data-rpt-field="serviceType"],
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="companyName"]),
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="itemName"]),
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="serviceType"]),
        .interactive-report-sheet [data-rpt-body],
        .interactive-report-sheet [data-rpt-sig-role],
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col] {
          cursor: pointer;
          position: relative;
          transition: outline 0.12s ease, background-color 0.12s ease;
          border-radius: 3px;
        }

        /* Text editable fields use text cursor */
        .interactive-report-sheet [data-rpt-body],
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="qty"],
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="remarks"] {
          cursor: text !important;
        }

        /* Locked fields (Serial Number, Attention, Tel, Address, Use For, Part No) */
        .interactive-report-sheet [data-rpt-field="serialNumber"],
        .interactive-report-sheet [data-rpt-field="contactName"],
        .interactive-report-sheet [data-rpt-field="phoneNumber"],
        .interactive-report-sheet [data-rpt-field="address"],
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="useFor"],
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="partNo"],
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="serialNumber"]),
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="contactName"]),
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="phoneNumber"]),
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="address"]) {
          cursor: not-allowed !important;
          position: relative;
        }

        /* Hover outline for editable fields */
        .interactive-report-sheet [data-rpt-box="onSite"]:hover,
        .interactive-report-sheet [data-rpt-box="companyService"]:hover,
        .interactive-report-sheet [data-rpt-box="contract"]:hover,
        .interactive-report-sheet [data-rpt-box="dateStart"]:hover,
        .interactive-report-sheet [data-rpt-box="dateFinish"]:hover,
        .interactive-report-sheet [data-rpt-box="dateWaiting"]:hover,
        .interactive-report-sheet [data-rpt-field="companyName"]:hover,
        .interactive-report-sheet [data-rpt-field="itemName"]:hover,
        .interactive-report-sheet [data-rpt-field="serviceType"]:hover,
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="companyName"]):hover,
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="itemName"]):hover,
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="serviceType"]):hover,
        .interactive-report-sheet [data-rpt-body]:hover,
        .interactive-report-sheet [data-rpt-sig-role]:hover,
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="description"]:hover,
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="qty"]:hover,
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="condition"]:hover,
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="remarks"]:hover {
          outline: 1.5px dashed #0284c7 !important;
          outline-offset: 2px !important;
          background-color: rgba(2, 132, 199, 0.05) !important;
        }

        /* Hover outline for locked fields */
        .interactive-report-sheet [data-rpt-field="serialNumber"]:hover,
        .interactive-report-sheet [data-rpt-field="contactName"]:hover,
        .interactive-report-sheet [data-rpt-field="phoneNumber"]:hover,
        .interactive-report-sheet [data-rpt-field="address"]:hover,
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="useFor"]:hover,
        .interactive-report-sheet tr[data-rpt-part-row] td[data-rpt-part-col="partNo"]:hover,
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="serialNumber"]):hover,
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="contactName"]):hover,
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="phoneNumber"]):hover,
        .interactive-report-sheet .rpt-inforow:has([data-rpt-field="address"]):hover {
          outline: 1.5px dashed #94a3b8 !important;
          outline-offset: -1px !important;
          background-color: rgba(148, 163, 184, 0.08) !important;
        }

        /* Active in-place editing style */
        .interactive-report-sheet [data-rpt-editing="true"] {
          outline: 2px solid #0284c7 !important;
          outline-offset: 2px !important;
          background-color: rgba(2, 132, 199, 0.08) !important;
        }

        /* Empty spare part null row styling */
        .interactive-report-sheet tr[data-rpt-part-empty="true"] td {
          cursor: pointer;
        }
        .interactive-report-sheet tr[data-rpt-part-empty="true"]:hover {
          outline: 1.5px dashed #0284c7 !important;
          outline-offset: -1px !important;
          background-color: rgba(2, 132, 199, 0.05) !important;
        }

        /* Action column and (x) delete button on each row */
        .interactive-report-sheet .rpt-col-action {
          width: 28px !important;
          text-align: center !important;
          vertical-align: middle !important;
          padding: 2px !important;
        }
        .interactive-report-sheet .rpt-row-del-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          border: 1px solid #fca5a5;
          background-color: #fef2f2;
          color: #ef4444;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .interactive-report-sheet .rpt-row-del-btn:hover {
          background-color: #ef4444 !important;
          color: #ffffff !important;
          border-color: #ef4444 !important;
          transform: scale(1.15);
        }

        /* Add Row button at bottom of spare parts table */
        .interactive-report-sheet [data-rpt-add-row="true"] {
          cursor: pointer;
          background: rgba(2, 132, 199, 0.03);
          transition: all 0.15s ease;
        }
        .interactive-report-sheet [data-rpt-add-row="true"]:hover {
          background-color: rgba(2, 132, 199, 0.1) !important;
          outline: 1.5px dashed #0284c7 !important;
        }
        .interactive-report-sheet .rpt-add-row-cell {
          text-align: center;
          padding: 6px 12px !important;
          border-top: 1px dashed #cbd5e1;
        }
        .interactive-report-sheet .rpt-add-row-inner {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #0284c7;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.01em;
          user-select: none;
        }

        /* When spare parts are locked */
        .interactive-report-sheet[data-sparepart-locked="true"] .rpt-col-action,
        .interactive-report-sheet[data-sparepart-locked="true"] [data-rpt-add-row="true"] {
          display: none !important;
        }
        .interactive-report-sheet[data-sparepart-locked="true"] tr[data-rpt-part-row] td {
          cursor: not-allowed !important;
        }
      `}</style>
    </div>
  );
}
