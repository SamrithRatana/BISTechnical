"use client";

/**
 * @file AllTicketsSearchModal.tsx
 * @description Full-screen / large popup table modal for searching all service tickets
 * across all statuses with real-time yellow highlight on matching words.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Table as TableIcon,
  RefreshCw,
  Eye,
  ArrowUpRight,
  Loader2,
  FileText,
  Calendar,
  Building2,
  Wrench,
  Hash,
  UserCheck,
} from "lucide-react";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import HighlightText from "@/components/HighlightText";
import { fetchRepairServices, type RepairServiceItem } from "@/services/api";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { formatDay } from "@/services/reportShaping";

const ServiceDetailModal = dynamic(() => import("./ServiceDetailModal"), { ssr: false });

const STATUS_ROUTES: Record<string, string> = {
  "Item Recieved":             "/receive-item",
  "Received":                  "/receive-item",
  "Inspecting":                "/inspect-item",
  "Inspection":                "/inspection",
  "Awaiting Sparepart":        "/spare-request",
  "Awaiting Customer Confirm": "/waiting-confirm",
  "Sale Confirmed":            "/confirmed-sale",
  "Sent Spareparts":           "/approve-repair",
  "Repairing":                 "/approve-repair",
  "Finished":                  "/approve-verify",
  "Customer Rejected":         "/rejected",
  "Unrepairable":              "/unrepairable",
  "Repair by Third-Party":     "/approve-repair",
};

const STATUS_BADGE: Record<string, string> = {
  "Finished":                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60",
  "Repairing":                 "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60",
  "Awaiting Customer Confirm": "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
  "Awaiting Sparepart":        "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60",
  "Sent Spareparts":           "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60",
  "Sale Confirmed":            "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60",
  "Customer Rejected":         "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60",
  "Unrepairable":              "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/60",
  "Repair by Third-Party":     "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60",
  "Inspecting":                "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60",
  "Inspection":                "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60",
  "Item Recieved":             "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
};

interface AllTicketsSearchModalProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export default function AllTicketsSearchModal({
  open,
  onClose,
  initialQuery = "",
}: AllTicketsSearchModalProps) {
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedTicket, setSelectedTicket] = useState<RepairServiceItem | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initial query when opened
  useEffect(() => {
    if (open) {
      setSearchTerm(initialQuery);
      setSelectedStatus("All");
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 100);
    }
  }, [open, initialQuery]);

  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 250);

  // Infinite list fetcher for tickets across all statuses
  const fetchTicketsPage = useCallback(
    async (page: number, pageSize: number) => {
      const res = await fetchRepairServices(page, pageSize, selectedStatus, debouncedSearch);
      return {
        items: res.items,
        totalCount: res.totalCount,
      };
    },
    [selectedStatus, debouncedSearch]
  );

  const {
    items: tickets,
    totalCount,
    isLoading: loading,
    isLoadingMore: loadingMore,
    reachedEnd,
    limitReached,
    refresh,
    scrollRootRef,
    sentinelRef,
  } = useInfiniteList<RepairServiceItem, HTMLDivElement, HTMLDivElement>({
    fetchPage: fetchTicketsPage,
    pageSize: 30,
    resetKey: `${selectedStatus}_${debouncedSearch}`,
    disabled: !open,
    getId: (i) => i?.id,
  });

  const navigateToTicket = useCallback(
    (ticket: RepairServiceItem) => {
      const route = STATUS_ROUTES[ticket.status] ?? "/";
      const q = ticket.reportNo || ticket.serialNumber || "";
      const href = q ? `${route}?q=${encodeURIComponent(q)}` : route;
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  const statusOptions = useMemo(
    () => [
      { key: "All", label: isKhmer ? "គ្រប់ស្ថានភាពទាំងអស់" : "All Statuses" },
      { key: "Item Recieved", label: isKhmer ? "១. ទទួលម៉ាស៊ីន" : "1. Received" },
      { key: "Inspecting", label: isKhmer ? "២. កំពុងវិនិច្ឆ័យ" : "2. Inspecting" },
      { key: "Inspection", label: isKhmer ? "៣. វិនិច្ឆ័យរួចរាល់" : "3. Inspection" },
      { key: "Awaiting Customer Confirm", label: isKhmer ? "៤. រង់ចាំភ្ញៀវយល់ព្រម" : "4. Await Confirm" },
      { key: "Awaiting Sparepart", label: isKhmer ? "៥. រង់ចាំគ្រឿងបន្លាស់" : "5. Await Sparepart" },
      { key: "Sale Confirmed", label: isKhmer ? "៦. ផ្នែកលក់យល់ព្រម" : "6. Sale Confirmed" },
      { key: "Sent Spareparts", label: isKhmer ? "៧. បានបញ្ជូនបន្លាស់" : "7. Sent Parts" },
      { key: "Repairing", label: isKhmer ? "៨. កំពុងជួសជុល" : "8. Repairing" },
      { key: "Finished", label: isKhmer ? "៩. ជួសជុលរួចរាល់" : "9. Finished" },
      { key: "Customer Rejected", label: isKhmer ? "១០. អតិថិជនមិនព្រម" : "10. Rejected" },
      { key: "Unrepairable", label: isKhmer ? "១១. ជួសជុលមិនបាន" : "11. Unrepairable" },
      { key: "Repair by Third-Party", label: isKhmer ? "១២. ផ្ញើជួសជុលខាងក្រៅ" : "12. Third-Party" },
    ],
    [isKhmer]
  );

  if (!open) return null;

  return (
    <>
      <ModalWrapper
        open={open}
        onClose={onClose}
        maxWidth="max-w-6xl xl:max-w-7xl w-full"
        zIndex={210}
        labelledBy="all-tickets-modal-title"
        placement="center"
        backdropVariant="heavy"
      >
        <div className="flex flex-col h-[85vh] max-h-[900px] overflow-hidden bg-surface dark:bg-slate-900 rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.1]">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-slate-50/80 dark:bg-slate-800/60 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-2xs">
                <TableIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 id="all-tickets-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{isKhmer ? "តារាងស្វែងរកសំបុត្រជួសជុលទាំងអស់" : "All Tickets Search Table"}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {totalCount} {isKhmer ? "សំបុត្រ" : "tickets"}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isKhmer ? "ស្វែងរកតាមលេខ Report No, ឈ្មោះក្រុមហ៊ុន, ម៉ូដែល, Serial No ឬឈ្មោះជាង" : "Search by Report #, Company, Model, Serial #, or Technician"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.06] bg-surface dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1 min-w-[240px] max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isKhmer ? "វាយពាក្យស្វែងរក (Report No, ក្រុមហ៊ុន, ម៉ូដែល, Serial)..." : "Type to search tickets..."}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Status Select */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors cursor-pointer"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Refresh */}
              <button
                type="button"
                onClick={() => refresh()}
                title={isKhmer ? "ផ្ទុកឡើងវិញ" : "Refresh"}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-500" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table Content with Custom Scroll */}
          <div ref={scrollRootRef} className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                <tr>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-500" />
                      {isKhmer ? "លេខ Report" : "Report #"}
                    </span>
                  </th>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      {isKhmer ? "ថ្ងៃទទួល" : "Date"}
                    </span>
                  </th>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      {isKhmer ? "ក្រុមហ៊ុន / អតិថិជន" : "Customer / Company"}
                    </span>
                  </th>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                      {isKhmer ? "ម៉ាស៊ីន / ម៉ូដែល" : "Item / Model"}
                    </span>
                  </th>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {isKhmer ? "លេខសម្គាល់" : "Serial Number"}
                  </th>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap text-center">
                    {isKhmer ? "ស្ថានភាព" : "Status"}
                  </th>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                      {isKhmer ? "អ្នកជួសជុល / ជាង" : "Technician"}
                    </span>
                  </th>
                  <th className="px-3.5 py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap text-right">
                    {isKhmer ? "សកម្មភាព" : "Action"}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-500">{isKhmer ? "កំពុងទាញយកទិន្នន័យសំបុត្រ..." : "Loading service tickets..."}</p>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {isKhmer ? `រកមិនឃើញសំបុត្រដែលត្រូវនឹង "${debouncedSearch}" ឡើយ` : `No tickets match "${debouncedSearch}"`}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{isKhmer ? "សូមសាកល្បងស្វែងរកជាមួយពាក្យគន្លឹះផ្សេងទៀត" : "Try searching with a different term"}</p>
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => {
                    const tech = ticket.repairByName || ticket.inspectByName || ticket.createdByName || "—";
                    return (
                      <tr
                        key={ticket.id}
                        onDoubleClick={() => setSelectedTicket(ticket)}
                        className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors group cursor-pointer"
                      >
                        {/* Report No */}
                        <td className="px-3.5 py-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedTicket(ticket)}
                            className="hover:underline text-left flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-500/70" />
                            <HighlightText text={ticket.reportNo || "—"} query={debouncedSearch} />
                          </button>
                        </td>

                        {/* Date */}
                        <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {ticket.serviceDate ? formatDay(ticket.serviceDate) : "—"}
                        </td>

                        {/* Company Name */}
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={ticket.companyName}>
                          <HighlightText text={ticket.companyName || "—"} query={debouncedSearch} />
                        </td>

                        {/* Item Name */}
                        <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-200 max-w-[180px] truncate" title={ticket.itemName}>
                          <HighlightText text={ticket.itemName || "—"} query={debouncedSearch} />
                        </td>

                        {/* Serial Number */}
                        <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <HighlightText text={ticket.serialNumber || "—"} query={debouncedSearch} />
                        </td>

                        {/* Status Badge */}
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${
                              STATUS_BADGE[ticket.status] || "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {translateStatus(ticket.status, t)}
                          </span>
                        </td>

                        {/* Technician */}
                        <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <HighlightText text={tech} query={debouncedSearch} />
                        </td>

                        {/* Actions */}
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicket(ticket);
                              }}
                              title={isKhmer ? "មើលព័ត៌មានលម្អិត" : "View Details"}
                              className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToTicket(ticket);
                              }}
                              title={isKhmer ? "ទៅកាន់ទំព័រការងារ" : "Go to Workflow Page"}
                              className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="py-3 text-center text-xs font-semibold text-slate-500">
              <InfiniteScrollStatus
                isLoadingMore={loadingMore}
                reachedEnd={reachedEnd}
                limitReached={limitReached}
                count={tickets.length}
              />
            </div>
          </div>

          {/* Footer Bar */}
          <div className="px-5 py-2.5 border-t border-black/[0.05] dark:border-white/[0.06] bg-slate-50/80 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
            <div>
              <span>{isKhmer ? "ចុចពីរដង (Double click) លើជួរដេក ដើម្បីបើកមើលលម្អិត" : "Double-click a row to open full ticket details"}</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span>{tickets.length} / {totalCount} {isKhmer ? "សំបុត្រ" : "tickets"}</span>
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* Ticket Detail View Modal */}
      {selectedTicket && (
        <ServiceDetailModal
          item={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          mode="view"
          zIndex={300}
        />
      )}
    </>
  );
}
