"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Lock,
  Building2,
  Cpu,
  FileText,
  Wrench,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  MapPin,
  CheckCircle2,
  Tag,
  ShieldCheck,
  Package,
  UserCheck,
  Search,
  ChevronDown,
  Loader2,
  Clock,
} from "lucide-react";
import {
  type RepairServiceItem,
  type SparePartItemDetail,
  toBackendLocalDateTime,
  isSparepartLockedStatus,
} from "@/services/types";
import {
  fetchSparePartsInventory,
  fetchCustomerCenter,
  type CustomerItem,
  fetchItemsInventory,
  type ItemModel,
} from "@/services/api";
import { fetchUsersList, type UserDto } from "@/services/userService";
import { matchSparePartInventory, ticketSparePartLines } from "@/report-layout";
import { useI18n } from "@/i18n/LanguageProvider";
import HighlightText from "@/components/HighlightText";
import { getImageUrl } from "@/lib/utils";

interface TicketFieldsEditorProps {
  ticket: RepairServiceItem;
  onChange: (updated: RepairServiceItem) => void;
  highlightSection?: string | null;
  onSectionFocused?: (sectionId: string) => void;
}

const getTicketParts = (t: RepairServiceItem): SparePartItemDetail[] =>
  (ticketSparePartLines(t as unknown as Record<string, unknown>) as unknown as SparePartItemDetail[]) || [];

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

const CONDITIONS = ["Fix", "Replace", "Free"] as const;

function normalizeCondition(cond?: string): "Fix" | "Replace" | "Free" {
  const c = (cond || "").trim().toLowerCase();
  if (c === "fix") return "Fix";
  if (c === "free") return "Free";
  return "Replace";
}

export default function TicketFieldsEditor({
  ticket,
  onChange,
  highlightSection,
  onSectionFocused,
}: TicketFieldsEditorProps) {
  const { t } = useI18n();

  // On-demand paginated spare parts for inline adding & autocomplete (Enterprise standard: 25 items/batch)
  const [activeSearchRowIdx, setActiveSearchRowIdx] = useState<number | null>(null);
  const [rowSearchQuery, setRowSearchQuery] = useState("");
  const [sparePartsList, setSparePartsList] = useState<any[]>([]);
  const [sparePartsTotal, setSparePartsTotal] = useState(0);
  const [isSearchingParts, setIsSearchingParts] = useState(false);
  const [isLoadingMoreParts, setIsLoadingMoreParts] = useState(false);
  const [partsPage, setPartsPage] = useState(1);
  const rowDropdownRef = useRef<HTMLDivElement>(null);

  const sectionRefs = {
    header: useRef<HTMLDivElement>(null),
    customer: useRef<HTMLDivElement>(null),
    instrument: useRef<HTMLDivElement>(null),
    request: useRef<HTMLDivElement>(null),
    diagnostic: useRef<HTMLDivElement>(null),
    solution: useRef<HTMLDivElement>(null),
    spareparts: useRef<HTMLDivElement>(null),
    signatures: useRef<HTMLDivElement>(null),
  };

  // Available users for signatures
  const [availableUsers, setAvailableUsers] = useState<UserDto[]>([]);

  // Company autocomplete dropdown state
  const [matchingCompanies, setMatchingCompanies] = useState<CustomerItem[]>([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  // Item model autocomplete dropdown state
  const [matchingItems, setMatchingItems] = useState<ItemModel[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [isSearchingItems, setIsSearchingItems] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const itemDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchUsersList().then(setAvailableUsers);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        companyDropdownRef.current &&
        !companyDropdownRef.current.contains(e.target as Node) &&
        companyInputRef.current &&
        !companyInputRef.current.contains(e.target as Node)
      ) {
        setShowCompanyDropdown(false);
      }
      if (
        itemDropdownRef.current &&
        !itemDropdownRef.current.contains(e.target as Node) &&
        itemInputRef.current &&
        !itemInputRef.current.contains(e.target as Node)
      ) {
        setShowItemDropdown(false);
      }
      if (
        rowDropdownRef.current &&
        !rowDropdownRef.current.contains(e.target as Node)
      ) {
        setActiveSearchRowIdx(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCompanySearch = async (query: string) => {
    updateField("companyName", query);
    if (!query.trim()) {
      setMatchingCompanies([]);
      setShowCompanyDropdown(false);
      return;
    }
    setIsSearchingCompanies(true);
    setShowCompanyDropdown(true);
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
    const rawContact = comp.contactName ?? "";
    const cleanContact = (rawContact && rawContact !== "—") ? rawContact.trim() : "";
    const rawPhone = comp.phoneNumber ?? "";
    const cleanPhone = (rawPhone && rawPhone !== "—") ? rawPhone.trim() : "";
    const rawAddress = comp.address ?? "";
    const cleanAddress = (rawAddress && rawAddress !== "—") ? rawAddress.trim() : "";

    onChange({
      ...ticket,
      customerId: comp.id,
      companyName: comp.companyName,
      contactName: cleanContact,
      phoneNumber: cleanPhone,
      address: cleanAddress,
    });
    setShowCompanyDropdown(false);
  };

  const handleItemSearch = async (query: string) => {
    updateField("itemName", query);
    if (!query.trim()) {
      setMatchingItems([]);
      setShowItemDropdown(false);
      return;
    }
    setIsSearchingItems(true);
    setShowItemDropdown(true);
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
    onChange({
      ...ticket,
      itemId: item.id,
      itemName: item.itemName,
      serialNumber: item.serialNumber || ticket.serialNumber,
    });
    setShowItemDropdown(false);
  };

  useEffect(() => {
    if (highlightSection && sectionRefs[highlightSection as keyof typeof sectionRefs]?.current) {
      const el = sectionRefs[highlightSection as keyof typeof sectionRefs]?.current;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-accent", "ring-offset-2");
      const timer = setTimeout(() => {
        el?.classList.remove("ring-2", "ring-accent", "ring-offset-2");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightSection]);

  // Debounced on-demand paginated search for spare parts row dropdown (25 items/batch)
  useEffect(() => {
    if (activeSearchRowIdx === null) return;
    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingParts(true);
      try {
        const res = await fetchSparePartsInventory(1, 25, rowSearchQuery.trim());
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
  }, [activeSearchRowIdx, rowSearchQuery]);

  const handleSparePartsScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 25) {
      if (!isSearchingParts && !isLoadingMoreParts && sparePartsList.length < sparePartsTotal) {
        setIsLoadingMoreParts(true);
        try {
          const nextPage = partsPage + 1;
          const res = await fetchSparePartsInventory(nextPage, 25, rowSearchQuery.trim());
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

  const isFinished =
    (typeof ticket.status === "string" && ticket.status.trim().toLowerCase() === "finished") ||
    (ticket as any).statusId === 6 ||
    (ticket as any)._serviceStatusId === 6;

  const isSparepartLocked = isSparepartLockedStatus(ticket);

  const updateField = (field: keyof RepairServiceItem, value: any) => {
    onChange({
      ...ticket,
      [field]: value,
    });
  };

  const handleAddNewSparepart = () => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    const lastPart = existingParts[existingParts.length - 1];
    if (lastPart && !(lastPart.description || lastPart.itemName || "").trim()) {
      setActiveSearchRowIdx(existingParts.length - 1);
      setRowSearchQuery("");
      return;
    }

    const newPart: SparePartItemDetail = {
      id: "part-" + Date.now(),
      sparePartId: "00000000-0000-0000-0000-000000000000",
      sparepartId: "00000000-0000-0000-0000-000000000000",
      itemName: "",
      description: "",
      useFor: ticket.itemName || "—",
      quantity: 1,
      condition: "Replace",
      defaultPrice: 0,
      partNumber: "—",
    };
    const updated = [...existingParts, newPart];
    onChange({
      ...ticket,
      sparepartItems: updated,
      sparePartItems: updated,
    });
    setActiveSearchRowIdx(updated.length - 1);
    setRowSearchQuery("");
  };

  const handleSelectPartForRow = (rowIndex: number, invPart: any) => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    const name = invPart.itemName || invPart.name || invPart.description || "Spare Part";
    const model = invPart.useFor || invPart.compatibleModel || ticket.itemName || "Universal";
    const partNo = invPart.partNumber || invPart.serialNumber || invPart.code || "—";
    const price = invPart.defaultPrice ?? invPart.price ?? 0;

    existingParts[rowIndex] = {
      ...existingParts[rowIndex],
      sparePartId: invPart.id,
      sparepartId: invPart.id,
      SparepartId: invPart.id,
      itemName: name,
      description: name,
      useFor: model,
      partNumber: partNo,
      serialNumber: partNo,
      condition: normalizeCondition(existingParts[rowIndex]?.condition),
      quantity: existingParts[rowIndex]?.quantity || 1,
      defaultPrice: price,
    };

    // Auto-append next empty row if this was the last row
    if (rowIndex === existingParts.length - 1) {
      existingParts.push({
        id: "part-" + (Date.now() + 1),
        sparePartId: "00000000-0000-0000-0000-000000000000",
        sparepartId: "00000000-0000-0000-0000-000000000000",
        itemName: "",
        description: "",
        useFor: ticket.itemName || "—",
        quantity: 1,
        condition: "Replace",
        defaultPrice: 0,
        partNumber: "—",
      });
    }

    onChange({
      ...ticket,
      sparepartItems: existingParts,
      sparePartItems: existingParts,
    });
    setActiveSearchRowIdx(null);
  };

  const handleRemovePart = (index: number) => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    existingParts.splice(index, 1);
    onChange({
      ...ticket,
      sparepartItems: existingParts,
      sparePartItems: existingParts,
    });
    if (activeSearchRowIdx === index) {
      setActiveSearchRowIdx(null);
    }
  };

  const handleUpdatePartQty = (index: number, qty: number) => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    if (existingParts[index]) {
      existingParts[index] = {
        ...existingParts[index],
        quantity: Math.max(1, qty),
      };
      onChange({
        ...ticket,
        sparepartItems: existingParts,
        sparePartItems: existingParts,
      });
    }
  };

  const handleUpdatePartCondition = (index: number, condition: string) => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    if (existingParts[index]) {
      existingParts[index] = {
        ...existingParts[index],
        condition,
      };
      onChange({
        ...ticket,
        sparepartItems: existingParts,
        sparePartItems: existingParts,
      });
    }
  };

  const handleUpdatePartDesc = (index: number, description: string) => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    if (existingParts[index]) {
      existingParts[index] = {
        ...existingParts[index],
        description,
        itemName: description,
      };

      onChange({
        ...ticket,
        sparepartItems: existingParts,
        sparePartItems: existingParts,
      });
    }
  };

  const handleUpdatePartModel = (index: number, useFor: string) => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    if (existingParts[index]) {
      existingParts[index] = {
        ...existingParts[index],
        useFor,
      };
      onChange({
        ...ticket,
        sparepartItems: existingParts,
        sparePartItems: existingParts,
      });
    }
  };

  const handleUpdatePartNo = (index: number, partNumber: string) => {
    if (isSparepartLocked) return;
    const existingParts = [...getTicketParts(ticket)];
    if (existingParts[index]) {
      existingParts[index] = {
        ...existingParts[index],
        partNumber,
        serialNumber: partNumber,
      };
      onChange({
        ...ticket,
        sparepartItems: existingParts,
        sparePartItems: existingParts,
      });
    }
  };


  const inputClass =
    "w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-subtle bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-accent transition-all";
  const labelClass = "text-xs font-semibold text-ink-secondary mb-1.5 block";

  const scrollToSection = (key: keyof typeof sectionRefs) => {
    const el = sectionRefs[key]?.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      onSectionFocused?.(key);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Sticky Quick Jump Pills Navigation Bar ── */}
      <div className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md py-2 px-3 rounded-2xl border border-subtle shadow-soft-xs flex items-center gap-2 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => scrollToSection("header")}
          className="px-3 py-1.5 rounded-xl bg-cushion hover:bg-accent-soft/40 hover:text-accent text-ink flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span>កាលបរិច្ឆេទ</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("customer")}
          className="px-3 py-1.5 rounded-xl bg-cushion hover:bg-accent-soft/40 hover:text-accent text-ink flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <Building2 className="w-3.5 h-3.5 text-accent" />
          <span>១. អតិថិជន</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("instrument")}
          className="px-3 py-1.5 rounded-xl bg-cushion hover:bg-accent-soft/40 hover:text-accent text-ink flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <Cpu className="w-3.5 h-3.5 text-accent" />
          <span>២. ម៉ាស៊ីន</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("request")}
          className="px-3 py-1.5 rounded-xl bg-cushion hover:bg-accent-soft/40 hover:text-accent text-ink flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <Wrench className="w-3.5 h-3.5 text-accent" />
          <span>៣. វិនិច្ឆ័យ & ដំណោះស្រាយ</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("spareparts")}
          className="px-3 py-1.5 rounded-xl bg-cushion hover:bg-accent-soft/40 hover:text-accent text-ink flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <Package className="w-3.5 h-3.5 text-accent" />
          <span>៤. គ្រឿងបន្លាស់ ({ticket.sparepartItems?.length || 0})</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("signatures")}
          className="px-3 py-1.5 rounded-xl bg-cushion hover:bg-accent-soft/40 hover:text-accent text-ink flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <UserCheck className="w-3.5 h-3.5 text-accent" />
          <span>៥. ហត្ថលេខា</span>
        </button>
      </div>

      {/* ── Clean Timing & Status Header ── */}
      <div
        ref={sectionRefs.header}
        onClick={() => onSectionFocused?.("header")}
        className="p-5 rounded-2xl bg-surface border border-subtle shadow-soft-sm space-y-4 transition-all"
      >
        {/* Top: Report Capsule & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-bold shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Report Number:</span>
                <span className="text-base font-black text-ink font-mono tracking-tight">{ticket.reportNo || "—"}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cushion text-ink-muted border border-subtle">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-ink-muted">Status:</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
              isFinished
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {ticket.status || "—"}
            </span>
          </div>
        </div>

        {/* Date Start & Date Finish (Side by Side) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Date Start (កាលបរិច្ឆេទចាប់ផ្តើម)
            </label>
            <input
              type="datetime-local"
              value={toLocalDatetimeValue(ticket.serviceDate)}
              onChange={(e) => updateField("serviceDate", fromLocalDatetimeValue(e.target.value))}
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink-secondary block">
                Date Finish (កាលបរិច្ឆេទបញ្ចប់)
              </label>
              {!isFinished && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  <Lock className="w-2.5 h-2.5" /> មិនទាន់ Finished
                </span>
              )}
            </div>
            <input
              type="datetime-local"
              value={toLocalDatetimeValue(ticket.finishedDate)}
              disabled={!isFinished}
              onChange={(e) => updateField("finishedDate", fromLocalDatetimeValue(e.target.value))}
              className={`${inputClass} ${
                !isFinished ? "opacity-60 cursor-not-allowed bg-cushion text-ink-muted select-none" : ""
              }`}
              title={
                !isFinished
                  ? "កាលបរិច្ឆេទបញ្ចប់ (Date Finish) អាចកែបានលុះត្រាតែ Status ស្ថិតក្នុងស្ថានភាព 'Finished'"
                  : "Date Finish"
              }
            />
          </div>
        </div>
      </div>

      {/* ── Section 1: Customer Information ── */}
      <div
        ref={sectionRefs.customer}
        onClick={() => onSectionFocused?.("customer")}
        className="p-5 rounded-2xl bg-surface border border-subtle shadow-soft-sm space-y-4 transition-all"
      >
        <div className="flex items-center justify-between border-b border-subtle pb-3">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" />
            <span>១. ព័ត៌មានអតិថិជន (Customer Information)</span>
          </h3>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink bg-cushion px-2.5 py-1 rounded-xl border border-subtle hover:bg-subtle transition-colors">
            <input
              type="checkbox"
              checked={Boolean(ticket.hasContract)}
              onChange={(e) => updateField("hasContract", e.target.checked)}
              className="rounded text-accent focus:ring-accent w-4 h-4"
            />
            <span>Service with Contract</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className={labelClass}>Company Name (ឈ្មោះក្រុមហ៊ុន) *</label>
            <div className="relative">
              <input
                ref={companyInputRef}
                type="text"
                value={ticket.companyName || ""}
                onChange={(e) => handleCompanySearch(e.target.value)}
                onFocus={() => {
                  if ((ticket.companyName || "").trim().length >= 1) {
                    void handleCompanySearch(ticket.companyName || "");
                  }
                }}
                className={`${inputClass} pr-8`}
                placeholder="Search or select company..."
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
                {isSearchingCompanies ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </div>

            {/* Dropdown Results */}
            {showCompanyDropdown && matchingCompanies.length > 0 && (
              <div
                ref={companyDropdownRef}
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-subtle rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-subtle"
              >
                {matchingCompanies.map((comp) => (
                  <div
                    key={comp.id}
                    onClick={() => handleSelectCompany(comp)}
                    className="p-3 hover:bg-accent-soft/40 cursor-pointer transition-colors text-xs"
                  >
                    <div className="font-bold text-ink flex items-center justify-between">
                      <span>
                        <HighlightText text={comp.companyName} query={ticket.companyName || ""} />
                      </span>
                      {comp.phoneNumber && (
                        <span className="text-[11px] text-ink-muted font-mono">
                          <HighlightText text={comp.phoneNumber} query={ticket.companyName || ""} />
                        </span>
                      )}
                    </div>
                    {(comp.contactName || comp.address) && (
                      <div className="text-[11px] text-ink-muted mt-0.5 truncate">
                        {comp.contactName && (
                          <span>
                            Contact: <HighlightText text={comp.contactName} query={ticket.companyName || ""} />
                          </span>
                        )}
                        {comp.contactName && comp.address ? " · " : ""}
                        {comp.address && (
                          <HighlightText text={comp.address} query={ticket.companyName || ""} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink-secondary block">
                Attention / Contact Person (អ្នកទទួលខុសត្រូវ)
              </label>
              <span className="text-[10px] text-ink-muted font-normal flex items-center gap-1 bg-cushion px-2 py-0.5 rounded">
                <Lock className="w-2.5 h-2.5" /> ពីក្រុមហ៊ុន
              </span>
            </div>
            <input
              type="text"
              value={ticket.contactName || ""}
              disabled
              readOnly
              className={`${inputClass} opacity-80 cursor-not-allowed bg-cushion text-ink font-medium select-none`}
              placeholder="Auto-filled from Company"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink-secondary block">
                Phone Number (លេខទូរស័ព្ទ)
              </label>
              <span className="text-[10px] text-ink-muted font-normal flex items-center gap-1 bg-cushion px-2 py-0.5 rounded">
                <Lock className="w-2.5 h-2.5" /> ពីក្រុមហ៊ុន
              </span>
            </div>
            <input
              type="text"
              value={ticket.phoneNumber || ""}
              disabled
              readOnly
              className={`${inputClass} opacity-80 cursor-not-allowed bg-cushion text-ink font-medium select-none`}
              placeholder="Auto-filled from Company"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink-secondary block">
                Address (អាសយដ្ឋាន)
              </label>
              <span className="text-[10px] text-ink-muted font-normal flex items-center gap-1 bg-cushion px-2 py-0.5 rounded">
                <Lock className="w-2.5 h-2.5" /> ពីក្រុមហ៊ុន
              </span>
            </div>
            <input
              type="text"
              value={ticket.address || ""}
              disabled
              readOnly
              className={`${inputClass} opacity-80 cursor-not-allowed bg-cushion text-ink font-medium select-none`}
              placeholder="Auto-filled from Company"
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Instrument Information ── */}
      <div
        ref={sectionRefs.instrument}
        onClick={() => onSectionFocused?.("instrument")}
        className="p-5 rounded-2xl bg-surface border border-subtle shadow-soft-sm space-y-4 transition-all"
      >
        <div className="border-b border-subtle pb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <span>២. ព័ត៌មានឧបករណ៍/ម៉ាស៊ីន (Instrument Information)</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 relative">
            <label className={labelClass}>Product / Model Name (ឈ្មោះម៉ាស៊ីន)</label>
            <div className="relative">
              <input
                ref={itemInputRef}
                type="text"
                value={ticket.itemName || ""}
                onChange={(e) => handleItemSearch(e.target.value)}
                onFocus={() => {
                  if ((ticket.itemName || "").trim().length >= 1) {
                    void handleItemSearch(ticket.itemName || "");
                  }
                }}
                className={`${inputClass} pr-8`}
                placeholder="Search inventory or type model name..."
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
                {isSearchingItems ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </div>

            {/* Item Dropdown Results */}
            {showItemDropdown && matchingItems.length > 0 && (
              <div
                ref={itemDropdownRef}
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-subtle rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-subtle"
              >
                {matchingItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="p-3 hover:bg-accent-soft/40 cursor-pointer transition-colors text-xs"
                  >
                    <div className="font-bold text-ink flex items-center justify-between">
                      <span>
                        <HighlightText text={item.itemName} query={ticket.itemName || ""} />
                      </span>
                      {item.serialNumber && (
                        <span className="text-[11px] text-ink-muted font-mono">
                          <HighlightText text={item.serialNumber} query={ticket.itemName || ""} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink-secondary block">
                Serial Number (លេខសម្គាល់)
              </label>
              <span className="text-[10px] text-ink-muted font-normal flex items-center gap-1 bg-cushion px-2 py-0.5 rounded">
                <Lock className="w-2.5 h-2.5" /> ពីម៉ាស៊ីន
              </span>
            </div>
            <input
              type="text"
              value={ticket.serialNumber || ""}
              disabled
              readOnly
              className={`${inputClass} opacity-80 cursor-not-allowed bg-cushion text-ink font-mono select-none`}
              placeholder="Auto-filled from Model"
            />
          </div>

          <div>
            <label className={labelClass}>Service Location (ទីតាំងសេវា)</label>
            <select
              value={ticket.serviceLocation === "OnSite" ? "OnSite" : "CompanyService"}
              onChange={(e) => updateField("serviceLocation", e.target.value)}
              className={inputClass}
            >
              <option value="CompanyService">Company Service (ក្នុងក្រុមហ៊ុន)</option>
              <option value="OnSite">On Site (ក្រៅក្រុមហ៊ុន / អតិថិជន)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Type of Service (ប្រភេទសេវាកម្ម)</label>
            <select
              value={ticket.serviceTypeId === 2 || ticket.serviceType === "Charge" ? "2" : "1"}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange({
                  ...ticket,
                  serviceTypeId: val,
                  serviceType: val === 2 ? "Charge" : "Free",
                });
              }}
              className={inputClass}
            >
              <option value="1">Free (ជួសជុលមិនគិតលុយ)</option>
              <option value="2">Charge (ជួសជុលគិតលុយ)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Service Priority (អាទិភាព)</label>
            <select
              value={
                ticket.servicePriority
                  ? ticket.servicePriority.charAt(0).toUpperCase() + ticket.servicePriority.slice(1).toLowerCase()
                  : "Normal"
              }
              onChange={(e) => {
                const val = e.target.value;
                const prioId = val === "Low" ? 1 : val === "High" ? 3 : 2;
                onChange({
                  ...ticket,
                  servicePriority: val,
                  servicePriorityId: prioId,
                });
              }}
              className={inputClass}
            >
              <option value="Low">Low (ទាប)</option>
              <option value="Normal">Normal (ធម្មតា)</option>
              <option value="High">High (ខ្ពស់)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Diagnostic Analysis & Solution ── */}
      <div
        ref={sectionRefs.diagnostic}
        onClick={() => onSectionFocused?.("diagnostic")}
        className="p-5 rounded-2xl bg-surface border border-subtle shadow-soft-sm space-y-4 transition-all"
      >
        <div className="border-b border-subtle pb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Wrench className="w-4 h-4 text-accent" />
            <span>៣. រោគសញ្ញា វិនិច្ឆ័យ និងដំណោះស្រាយ (Problem, Diagnostic & Solution)</span>
          </h3>
        </div>

        <div className="space-y-4">
          {/* Customer Complaint */}
          <div ref={sectionRefs.request}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <label className="text-xs font-bold text-ink">
                Customer Request / Complaint (សំណើ និងរោគសញ្ញារបស់អតិថិជន)
              </label>
            </div>
            <textarea
              rows={3}
              value={ticket.customerRequest || ""}
              onChange={(e) => updateField("customerRequest", e.target.value)}
              className={inputClass}
              placeholder="Describe customer complaint or reason for repair..."
            />
          </div>

          {/* Diagnostic Analysis */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-500" />
              <label className="text-xs font-bold text-ink">
                Diagnostic Analysis / Action Taken (វិនិច្ឆ័យរោគ និងការងារដែលបានធ្វើ)
              </label>
            </div>
            <textarea
              rows={3}
              value={ticket.inspection || ""}
              onChange={(e) => updateField("inspection", e.target.value)}
              className={inputClass}
              placeholder="Describe diagnostics results, fault analysis, and work completed..."
            />
          </div>

          {/* Solution */}
          <div ref={sectionRefs.solution}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <label className="text-xs font-bold text-ink">
                Solution / Replaced Parts (ដំណោះស្រាយ និងគ្រឿងបន្លាស់ដែលបានផ្លាស់ប្តូរ)
              </label>
            </div>
            <textarea
              rows={3}
              value={ticket.solution || ""}
              onChange={(e) => updateField("solution", e.target.value)}
              className={inputClass}
              placeholder="Detail solution applied, components replaced, and counter values..."
            />
          </div>
        </div>
      </div>

      {/* ── Section 4: Spare Parts Descriptions Table ── */}
      <div
        ref={sectionRefs.spareparts}
        onClick={() => onSectionFocused?.("spareparts")}
        className="p-5 rounded-2xl bg-surface border border-subtle shadow-soft-sm space-y-4 transition-all"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-ink">
              ៤. តារាងគ្រឿងបន្លាស់ (Spare Part Descriptions)
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent-soft text-accent font-bold">
              {(ticket.sparepartItems || []).filter((p) => Boolean((p.description || p.itemName || "").trim())).length} មុខ
            </span>
            {isSparepartLocked && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Lock className="w-3 h-3" />
                <span>Locked ({ticket.status || "Disabled"})</span>
              </span>
            )}
          </div>
          {!isSparepartLocked && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddNewSparepart}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-accent text-white hover:bg-accent/90 shadow-soft-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Sparepart</span>
              </button>
            </div>
          )}
        </div>

        {(!ticket.sparepartItems || ticket.sparepartItems.length === 0) ? (
          isSparepartLocked ? (
            <div className="p-8 text-center border-2 border-dashed border-subtle rounded-2xl text-xs text-ink-muted bg-cushion/20 space-y-2 select-none">
              <Lock className="w-8 h-8 mx-auto text-rose-500/60" />
              <p className="font-bold text-ink">តារាងគ្រឿងបន្លាស់ត្រូវបានចាក់សោ (Locked)</p>
              <p className="text-[11px] text-ink-secondary max-w-md mx-auto">
                មិនអាចបន្ថែមគ្រឿងបន្លាស់បានទេ ក្នុងស្ថានភាព &ldquo;{ticket.status || "បច្ចុប្បន្ន"}&rdquo; (Item Recieved, Inspecting, Customer Rejected, Unrepairable)។
              </p>
            </div>
          ) : (
            <div
              onClick={handleAddNewSparepart}
              className="p-8 text-center border-2 border-dashed border-subtle rounded-2xl text-xs text-ink-muted hover:border-accent hover:bg-accent-soft/10 cursor-pointer transition-all space-y-2"
            >
              <Package className="w-8 h-8 mx-auto text-accent opacity-60" />
              <p className="font-semibold text-ink">មិនទាន់មានគ្រឿងបន្លាស់ក្នុងរបាយការណ៍នេះទេ</p>
              <p className="text-[11px] text-ink-secondary">ចុចទីនេះ ឬប៊ូតុងខាងលើដើម្បីបន្ថែមគ្រឿងបន្លាស់ថ្មី (Add New Sparepart)</p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {isSparepartLocked && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  តារាងគ្រឿងបន្លាស់ត្រូវបានចាក់សោ (Locked) មិនអាចបន្ថែម លុប ឬកែប្រែបានទេ ក្នុងស្ថានភាព <strong>&ldquo;{ticket.status || "បច្ចុប្បន្ន"}&rdquo;</strong>។
                </span>
              </div>
            )}
            <div className="overflow-visible rounded-xl border border-subtle">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-cushion text-ink-secondary font-bold uppercase tracking-wider border-b border-subtle">
                    <th className="px-3 py-2.5 w-12 text-center">No</th>
                    <th className="px-4 py-2.5 min-w-[280px]">Spare Part Description (ស្វែងរក / វាយបញ្ចូល)</th>
                    <th className="px-3 py-2.5 min-w-[140px]">Use For / Model</th>
                    <th className="px-3 py-2.5 w-28 font-mono">Part No</th>
                    <th className="px-3 py-2.5 w-24 text-center">Qty</th>
                    <th className="px-3 py-2.5 w-28 text-center">Condition</th>
                    <th className="px-3 py-2.5 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle bg-surface">
                  {ticket.sparepartItems.map((part, idx) => {
                    const resolvedDesc = (part.description || part.itemName || "") as string;
                    const resolvedUseFor = (part.useFor || "") as string;
                    const resolvedPartNo = (part.partNumber && part.partNumber !== "—" ? part.partNumber : "") as string;

                    return (
                      <tr key={part.id || idx} className="hover:bg-cushion/40 transition-colors">
                        <td className="px-3 py-2 text-center font-bold text-ink-muted">{idx + 1}</td>
                        <td className="px-3 py-2 relative">
                          <div className="relative">
                            <input
                              type="text"
                              value={resolvedDesc}
                              disabled={isSparepartLocked}
                              readOnly={isSparepartLocked}
                              placeholder={isSparepartLocked ? "Locked" : "Type to search or enter spare part..."}
                              onChange={(e) => {
                                if (isSparepartLocked) return;
                                handleUpdatePartDesc(idx, e.target.value);
                                setActiveSearchRowIdx(idx);
                                setRowSearchQuery(e.target.value);
                              }}
                              onFocus={() => {
                                if (isSparepartLocked) return;
                                setActiveSearchRowIdx(idx);
                                setRowSearchQuery(resolvedDesc);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  setActiveSearchRowIdx(null);
                                }
                              }}
                              className={`w-full px-2.5 py-1.5 text-xs rounded-lg border border-subtle ${
                                isSparepartLocked
                                  ? "bg-subtle/30 text-ink-muted cursor-not-allowed select-none opacity-80"
                                  : "bg-surface focus:ring-2 focus:ring-accent text-ink"
                              } font-medium pr-7`}
                            />
                            {!isSparepartLocked && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
                                <Search className="w-3.5 h-3.5" />
                              </div>
                            )}

                            {/* Autocomplete Dropdown */}
                            {!isSparepartLocked && activeSearchRowIdx === idx && (
                              <div
                                ref={rowDropdownRef}
                                className="absolute left-0 top-full mt-1.5 w-[420px] max-w-[90vw] z-[100] bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden text-xs"
                              >
                                <div className="p-2.5 bg-cushion/90 border-b border-subtle flex items-center justify-between font-semibold text-ink-secondary">
                                  <span className="flex items-center gap-1.5 text-[11.5px]">
                                    <Package className="w-3.5 h-3.5 text-accent" />
                                    <span>ជ្រើសរើសគ្រឿងបន្លាស់ ({sparePartsTotal})</span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {isSearchingParts && (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveSearchRowIdx(null);
                                      }}
                                      className="text-ink-muted hover:text-ink font-bold p-1 rounded text-xs cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                <div
                                  onScroll={handleSparePartsScroll}
                                  className="max-h-56 overflow-y-auto divide-y divide-subtle"
                                >
                                  {isSearchingParts && sparePartsList.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-ink-muted flex items-center justify-center gap-2">
                                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                      <span>កំពុងស្វែងរក...</span>
                                    </div>
                                  ) : sparePartsList.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-ink-muted">
                                      រកមិនឃើញគ្រឿងបន្លាស់ត្រូវគ្នានឹង &ldquo;{rowSearchQuery}&rdquo; ទេ។<br />
                                      <span className="text-[11px] text-ink-secondary mt-1 block">
                                        អ្នកអាចវាយបញ្ចូលឈ្មោះផ្ទាល់ខ្លួនក្នុងប្រអប់បាន។
                                      </span>
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
                                            onClick={() => handleSelectPartForRow(idx, invPart)}
                                            className="p-2.5 hover:bg-accent-soft/40 cursor-pointer flex items-center gap-3 transition-colors"
                                          >
                                            {invPart.pictureUrl ? (
                                              <img
                                                src={getImageUrl(invPart.pictureUrl)}
                                                alt=""
                                                className="w-8 h-8 object-cover rounded-lg border border-subtle shrink-0 bg-white"
                                              />
                                            ) : (
                                              <div className="w-8 h-8 rounded-lg bg-cushion border border-subtle flex items-center justify-center shrink-0">
                                                <Package className="w-4 h-4 text-ink-muted" />
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="font-bold text-xs text-ink truncate">
                                                <HighlightText text={partName} query={rowSearchQuery} />
                                              </div>
                                              <div className="text-[10.5px] text-ink-muted truncate mt-0.5">
                                                Code: <HighlightText text={partCode} query={rowSearchQuery} />
                                                &nbsp;·&nbsp;
                                                For: <HighlightText text={partModel} query={rowSearchQuery} />
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
                                              {stockQty <= 0 ? "Out of Stock" : `${stockQty} In Stock`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                      {isLoadingMoreParts && (
                                        <div className="p-2 text-center text-[11px] text-ink-muted flex items-center justify-center gap-1.5 bg-cushion/40">
                                          <Loader2 className="w-3 h-3 animate-spin text-accent" />
                                          <span>កំពុងទាញទិន្នន័យបន្ថែម...</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={resolvedUseFor}
                            disabled={isSparepartLocked}
                            readOnly={isSparepartLocked}
                            placeholder="Model..."
                            onChange={(e) => handleUpdatePartModel(idx, e.target.value)}
                            className={`w-full px-2 py-1 text-xs rounded border border-subtle ${
                              isSparepartLocked
                                ? "bg-subtle/30 text-ink-muted cursor-not-allowed select-none opacity-80"
                                : "bg-transparent focus:bg-surface focus:ring-1 focus:ring-accent text-ink"
                            } font-medium`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={resolvedPartNo}
                            disabled={isSparepartLocked}
                            readOnly={isSparepartLocked}
                            placeholder="Part No..."
                            onChange={(e) => handleUpdatePartNo(idx, e.target.value)}
                            className={`w-full px-2 py-1 text-xs rounded border border-subtle ${
                              isSparepartLocked
                                ? "bg-subtle/30 text-ink-muted cursor-not-allowed select-none opacity-80"
                                : "bg-transparent focus:bg-surface focus:ring-1 focus:ring-accent text-ink"
                            } font-mono`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            value={part.quantity || 1}
                            disabled={isSparepartLocked}
                            readOnly={isSparepartLocked}
                            onChange={(e) => handleUpdatePartQty(idx, parseInt(e.target.value, 10) || 1)}
                            className={`w-16 px-2 py-1 text-xs text-center rounded border border-subtle ${
                              isSparepartLocked
                                ? "bg-subtle/30 text-ink-muted cursor-not-allowed select-none opacity-80"
                                : "bg-transparent focus:bg-surface focus:ring-1 focus:ring-accent font-bold"
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={normalizeCondition(part.condition)}
                            disabled={isSparepartLocked}
                            onChange={(e) => handleUpdatePartCondition(idx, e.target.value)}
                            className={`px-2 py-1 text-xs rounded border border-subtle ${
                              isSparepartLocked
                                ? "bg-subtle/30 text-ink-muted cursor-not-allowed select-none opacity-80"
                                : "bg-transparent focus:bg-surface focus:ring-1 focus:ring-accent"
                            }`}
                          >
                            {CONDITIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isSparepartLocked ? (
                            <Lock className="w-3.5 h-3.5 mx-auto text-ink-muted/50" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemovePart(idx)}
                              className="p-1 rounded text-danger hover:bg-danger-soft transition-colors cursor-pointer"
                              title="Remove part"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 6: Signatures & Approvals ── */}
      <div
        ref={sectionRefs.signatures}
        onClick={() => onSectionFocused?.("signatures")}
        className="p-5 rounded-2xl bg-surface border border-subtle shadow-soft-sm space-y-4 transition-all"
      >
        <div className="border-b border-subtle pb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-accent" />
            <span>៥. ហត្ថលេខា និងការត្រួតពិនិត្យ (Signatures & Approvals)</span>
          </h3>
          {!isFinished ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded">
              <Lock className="w-2.5 h-2.5" /> មិនទាន់ Finished (Disabled)
            </span>
          ) : (
            <span className="text-[11px] text-ink-muted">
              ជ្រើសរើសឈ្មោះបុគ្គលិកចុះហត្ថលេខាលើរបាយការណ៍
            </span>
          )}
        </div>

        {!isFinished && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              ហត្ថលេខា និងការត្រួតពិនិត្យ អាចកែប្រែបានលុះត្រាតែ Status ស្ថិតក្នុងស្ថានភាព <strong>&ldquo;Finished&rdquo;</strong> (ស្ថានភាពបច្ចុប្បន្ន: {ticket.status || "In Progress"})។
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Checked By / Verified By */}
          <div className="p-4 rounded-xl bg-cushion/60 border border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Checked By / Verified By (អ្នកត្រួតពិនិត្យ)
              </span>
            </div>

            <div>
              <label className={labelClass}>Select User (ជ្រើសរើសបុគ្គលិក)</label>
              <select
                value={ticket.verifiedBy || ""}
                disabled={!isFinished}
                onChange={(e) => {
                  const u = availableUsers.find((x) => x.id.toLowerCase() === e.target.value.toLowerCase());
                  onChange({
                    ...ticket,
                    verifiedBy: e.target.value,
                    verifiedByName: u ? (u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.userName) : ticket.verifiedByName,
                    verifiedByPhone: u?.phoneNumber || ticket.verifiedByPhone || "",
                  });
                }}
                className={`${inputClass} ${
                  !isFinished ? "opacity-60 cursor-not-allowed bg-subtle/40 text-ink-muted select-none" : ""
                }`}
              >
                <option value="">-- Select Verifier / Manager --</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.userName} ({u.userName})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Display Name on Report</label>
                <input
                  type="text"
                  value={ticket.verifiedByName || ""}
                  disabled={!isFinished}
                  readOnly={!isFinished}
                  onChange={(e) => updateField("verifiedByName", e.target.value)}
                  className={`${inputClass} ${
                    !isFinished ? "opacity-60 cursor-not-allowed bg-subtle/40 text-ink-muted select-none" : ""
                  }`}
                  placeholder="e.g. Sokha Meng"
                />
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  type="text"
                  value={ticket.verifiedByPhone || ""}
                  disabled={!isFinished}
                  readOnly={!isFinished}
                  onChange={(e) => updateField("verifiedByPhone", e.target.value)}
                  className={`${inputClass} ${
                    !isFinished ? "opacity-60 cursor-not-allowed bg-subtle/40 text-ink-muted select-none" : ""
                  }`}
                  placeholder="e.g. 012 345 678"
                />
              </div>
            </div>
          </div>

          {/* Technician / Engineer */}
          <div className="p-4 rounded-xl bg-cushion/60 border border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Technician / Engineer (វិស្វករ / ជាងបច្ចេកទេស)
              </span>
            </div>

            <div>
              <label className={labelClass}>Select User (ជ្រើសរើសបុគ្គលិក)</label>
              <select
                value={ticket.repairBy || ""}
                disabled={!isFinished}
                onChange={(e) => {
                  const u = availableUsers.find((x) => x.id.toLowerCase() === e.target.value.toLowerCase());
                  onChange({
                    ...ticket,
                    repairBy: e.target.value,
                    repairByName: u ? (u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.userName) : ticket.repairByName,
                    repairByPhone: u?.phoneNumber || ticket.repairByPhone || "",
                  });
                }}
                className={`${inputClass} ${
                  !isFinished ? "opacity-60 cursor-not-allowed bg-subtle/40 text-ink-muted select-none" : ""
                }`}
              >
                <option value="">-- Select Technician / Engineer --</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.userName} ({u.userName})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Display Name on Report</label>
                <input
                  type="text"
                  value={ticket.repairByName || ""}
                  disabled={!isFinished}
                  readOnly={!isFinished}
                  onChange={(e) => updateField("repairByName", e.target.value)}
                  className={`${inputClass} ${
                    !isFinished ? "opacity-60 cursor-not-allowed bg-subtle/40 text-ink-muted select-none" : ""
                  }`}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  type="text"
                  value={ticket.repairByPhone || ""}
                  disabled={!isFinished}
                  readOnly={!isFinished}
                  onChange={(e) => updateField("repairByPhone", e.target.value)}
                  className={`${inputClass} ${
                    !isFinished ? "opacity-60 cursor-not-allowed bg-subtle/40 text-ink-muted select-none" : ""
                  }`}
                  placeholder="e.g. 095 404 590"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
