"use client";

/**
 * @file PrintPreviewSidebar.tsx
 * @description Exact 1:1 pixel-perfect replica of DevExpress Report2 layout with full API Spare Parts enrichment.
 */

import React, { useState, useEffect } from "react";
import { Printer, X } from "lucide-react";
import { fetchSparePartsInventory, type RepairServiceItem } from "@/services/api";
import { getStatusDate, formatTime24HourWithAmPm } from "@/services/types";

interface PrintPreviewSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  item: RepairServiceItem | null;
}

interface ResolvedSparePartRow {
  id: string;
  itemName: string;
  useFor: string;
  sparePartId: string;
  quantity: number;
  condition: string;
}

/**
 * Fetches parent SparePart details by ID directly from GET /api/proxy/spareparts/{id}
 */
async function fetchSparePartById(id: string): Promise<Record<string, unknown> | null> {
  if (!id || id === "undefined" || id === "null" || id.length < 10) return null;
  try {
    const res = await fetch(`/api/proxy/spareparts/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Formats date to match DevExpress format: DD-MM-YYYY HH:mm A
 * Example: 24-07-2026 13:43 PM — 24-hour digits, matching the rest of the
 * app's non-standard AM/PM convention (see formatTime24HourWithAmPm).
 */
function formatReportDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year} ${formatTime24HourWithAmPm(d)}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formats status to string matching DevExpress output.
 */
function formatStatus(status?: string): string {
  if (!status) return "N/A";
  switch (status) {
    case "Awaiting Customer Confirm":
    case "AWAITING_CUSTOMER_CONFIRM":
      return "Awaiting Customer Confirm";
    case "Awaiting Sparepart":
    case "AWAITING_SPAREPART":
      return "Awaiting Sparepart";
    case "Customer Rejected":
    case "CUSTOMER_REJECTED":
      return "Customer Rejected";
    case "Unrepairable":
    case "UNREPAIRABLE":
      return "Unrepairable";
    case "Repair by Third-Party":
    case "REPAIR_THIRD_PARTY":
      return "Repair by Third-Party";
    case "Finished Repair":
    case "FINISHED_REPAIR":
      return "Finished";
    case "Confirmed Sale":
    case "CONFIRMED_SALE":
      return "Sale Confirmed";
    default:
      return status;
  }
}

export default function PrintPreviewSidebar({
  isOpen,
  onClose,
  item,
}: PrintPreviewSidebarProps) {
  const [enrichedItem, setEnrichedItem] = useState<RepairServiceItem | null>(item);
  const [sparePartRows, setSparePartRows] = useState<ResolvedSparePartRow[]>([]);

  useEffect(() => {
    if (!isOpen || !item) return;

    let isMounted = true;
    setEnrichedItem(item);

    async function loadFullDetailsAndSpareParts() {
      try {
        if (!item) return;
        let ticketData = item;
        try {
          const res = await fetch(`/api/proxy/technicalservices/${item.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === "object") {
              ticketData = { ...item, ...data };
            }
          }
        } catch (e) {
          console.warn("Could not fetch full ticket details:", e);
        }

        if (!isMounted || !ticketData) return;
        setEnrichedItem(ticketData);

        // 2. Extract raw spare part items list with all case variations
        const rawParts = (
          (ticketData as any).sparepartItems ||
          (ticketData as any).sparePartItems ||
          (ticketData as any)._sparepartItems ||
          (ticketData as any).SparepartItems ||
          (ticketData as any).SparePartItems ||
          (ticketData as any).spareParts ||
          (ticketData as any).SpareParts ||
          []
        ) as Record<string, unknown>[];

        if (rawParts.length === 0) {
          setSparePartRows([]);
          return;
        }

        // 3. Fetch spare parts inventory to enrich names, part numbers, and useFor
        let inventoryParts: Record<string, unknown>[] = [];
        try {
          const invRes = await fetchSparePartsInventory(1, 500);
          inventoryParts = (invRes.items || []) as unknown as Record<string, unknown>[];
        } catch (e) {
          console.warn("Could not fetch spare parts inventory:", e);
        }

        const resolvedRows: ResolvedSparePartRow[] = await Promise.all(
          rawParts.map(async (sp, idx) => {
            const spId = String(
              sp.sparepartId ||
              sp.SparepartId ||
              sp.sparePartId ||
              sp.SparePartId ||
              sp.id ||
              sp.Id ||
              ""
            ).trim();

            const descStr = String(sp.description || sp.Description || sp.itemName || sp.ItemName || "").toLowerCase().trim();

            let matchedInv = inventoryParts.find((p) => {
              const pid = String(p.id || "").toLowerCase().trim();
              const pno = String(p.partNumber || "").toLowerCase().trim();
              const psn = String(p.serialNumber || "").toLowerCase().trim();
              const pnm = String(p.itemName || p.partName || "").toLowerCase().trim();
              return (
                (spId && (pid === spId.toLowerCase() || pno === spId.toLowerCase() || psn === spId.toLowerCase())) ||
                (descStr && pnm && (pnm === descStr || pnm.includes(descStr) || descStr.includes(pnm)))
              );
            });

            // If not found in bulk inventory array, fetch directly from parent GET /api/proxy/spareparts/{spId}
            if (!matchedInv && spId && spId.length > 10) {
              matchedInv = (await fetchSparePartById(spId)) || undefined;
            }

            const itemName = String(
              matchedInv?.itemName ||
              matchedInv?.partName ||
              sp.itemName ||
              sp.ItemName ||
              sp.description ||
              sp.Description ||
              "—"
            );

            const useFor = String(
              matchedInv?.useFor ||
              sp.useFor ||
              sp.UseFor ||
              "—"
            );

            let partNo = String(
              matchedInv?.serialNumber ||
              matchedInv?.partNumber ||
              sp.partNumber ||
              sp.PartNumber ||
              sp.serialNumber ||
              sp.SerialNumber ||
              ""
            ).trim();

            if (!partNo || partNo === spId || partNo === "undefined" || partNo.length > 25) {
              partNo = "N/A";
            }

            const quantity = Number(sp.quantity ?? sp.Quantity ?? 1);
            const condition = String(sp.condition || sp.Condition || "Replace");

            return {
              id: String(sp.id || sp.Id || idx),
              itemName,
              useFor,
              sparePartId: partNo,
              quantity,
              condition,
            };
          })
        );

        if (resolvedRows.length > 0 && isMounted) {
          setSparePartRows(resolvedRows);
          return;
        }

        // 4. Fallback: If rawParts is empty, check if solution or inspection text mentions any spare part names from inventoryParts
        if (inventoryParts.length > 0) {
          const solutionText = String(ticketData.solution || "").toLowerCase();
          const inspectionText = String(ticketData.inspection || "").toLowerCase();
          const combinedText = `${solutionText} ${inspectionText}`;

          const matchedFromText: ResolvedSparePartRow[] = [];

          for (const inv of inventoryParts) {
            const invName = String(inv.itemName || inv.partName || "").trim();
            if (!invName || invName.length < 3) continue;

            if (combinedText.includes(invName.toLowerCase())) {
              matchedFromText.push({
                id: String(inv.id || matchedFromText.length),
                itemName: invName,
                useFor: String(inv.useFor || "—"),
                sparePartId: String(inv.serialNumber || inv.partNumber || inv.id || "N/A"),
                quantity: 1,
                condition: "Replace",
              });
            }
          }

          if (matchedFromText.length > 0 && isMounted) {
            setSparePartRows(matchedFromText);
            return;
          }
        }

        if (isMounted) {
          setSparePartRows([]);
        }
      } catch (err) {
        console.error("Error enriching report spare parts:", err);
      }
    }

    void loadFullDetailsAndSpareParts();

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const currentItem = enrichedItem || item;
  const isCompanyService = currentItem.serviceLocation === "CompanyService" || currentItem.serviceLocation === "Company Service";
  const isOnSite = currentItem.serviceLocation === "OnSite" || currentItem.serviceLocation === "On Site";
  const hasContract = Boolean(currentItem.hasContract);

  const handlePrint = () => {
    window.print();
  };

  const formattedStatus = formatStatus(currentItem.status);
  const isFinished = currentItem.status === "Finished";
  const startDateStr = formatReportDate(currentItem.serviceDate);
  // Finished shows the actual finish date; any other status shows the date
  // the ticket entered *that* status (e.g. Inspecting → inspectDate) rather
  // than the finish date it hasn't reached yet.
  const finishDateStr = isFinished
    ? formatReportDate(currentItem.finishedDate || currentItem.serviceDate)
    : formatReportDate(getStatusDate(currentItem));

  return (
    <div className="fixed inset-0 z-50 flex justify-end av-scrim transition-opacity enter-fade">
      {/* Sidebar Container. `enter-right` rather than `enter-pop`: this panel
          is anchored to the right edge, so sliding in from off-screen matches
          where it lives. It is also the one entrance worth running slightly
          longer (380ms) — a full-height panel travelling a long distance looks
          snatched at 260ms. */}
      <div className="enter-right w-full max-w-4xl bg-ink h-full flex flex-col shadow-2xl overflow-hidden border-l border-subtle">
        
        {/* Top Action Bar (Screen Only) */}
        <div className="px-6 py-3 bg-ink border-b border-subtle flex items-center justify-between shrink-0 print:hidden text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-info/20 text-info flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Print Preview — <span className="font-mono text-info">{currentItem.reportNo}</span>
              </h2>
              <p className="text-[11px] text-ink-muted">
                Technical Service Maintenance Report (DevExpress Report2 Exact Replica)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-info hover:bg-info rounded-lg transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] shadow-md shadow-info/20 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-white hover:bg-ink rounded-lg transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Canvas Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-ink print:p-0 print:bg-white print:overflow-visible">
          
          {/* A4 Sheet Document with 1px black border matching Image 1 */}
          <div
            id="printable-report-document"
            className="w-full max-w-[210mm] min-h-[270mm] bg-white text-black p-6 md:p-8 shadow-2xl print:shadow-none print:p-0 print:w-full border border-black print:border-none my-auto flex flex-col justify-between"
            style={{
              fontFamily: "'Khmer OS Battambang', Battambang, Arial, sans-serif",
              fontSize: "10pt",
              color: "#000000",
              lineHeight: "1.3",
            }}
          >
            {/* Top Content Area */}
            <div className="flex-1 flex flex-col">
              {/* Header: Cam Logo Left, TECHNICAL SERVICE REPORT Right */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <img
                    src="/images/CamLogo.png"
                    alt="Cam Logo"
                    className="h-20 md:h-24 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/Cam-Logo.png";
                    }}
                  />
                </div>

                <div>
                  <h1
                    className="text-base font-bold italic tracking-wide text-ink-secondary uppercase"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    TECHNICAL SERVICE REPORT
                  </h1>
                </div>
              </div>

              {/* Top 2 Side-by-Side Bordered Header Boxes (DevExpress Report2 Centered 2-Column Replica) */}
              <div className="flex items-stretch justify-between mb-3 gap-4">
                {/* Left Box (57% width) — Centered 2-column block matching Image 2 */}
                <div className="w-[57%] border border-black p-2 text-[9.5pt] leading-snug text-black flex flex-col justify-between" style={{ fontFamily: "Arial, sans-serif" }}>
                  <div className="flex items-center justify-center w-full">
                    <span className="font-bold w-[145px] text-right pr-1.5 shrink-0 whitespace-nowrap">Report Number:</span>
                    <span className="font-bold text-left w-[140px] shrink-0 whitespace-nowrap">{currentItem.reportNo}</span>
                  </div>
                  <div className="flex items-center justify-center w-full">
                    <span className="font-bold w-[145px] text-right pr-1.5 shrink-0 whitespace-nowrap">On Site:</span>
                    <span className="font-normal text-left w-[140px] shrink-0 whitespace-nowrap">{isOnSite ? "☑" : "☐"}</span>
                  </div>
                  <div className="flex items-center justify-center w-full">
                    <span className="font-bold w-[145px] text-right pr-1.5 shrink-0 whitespace-nowrap">Company Service:</span>
                    <span className="font-normal text-left w-[140px] shrink-0 whitespace-nowrap">{isCompanyService ? "☑" : "☐"}</span>
                  </div>
                  <div className="flex items-center justify-center w-full">
                    <span className="font-bold w-[145px] text-right pr-1.5 shrink-0 whitespace-nowrap">Service with Contract:</span>
                    <span className="font-normal text-left w-[140px] shrink-0 whitespace-nowrap">{hasContract ? "☑" : "☐"}</span>
                  </div>
                </div>

                {/* Right Box (40% width) — Centered 2-column block matching Image 2 */}
                <div className="w-[40%] border border-black p-2 text-[9.5pt] leading-snug text-black flex flex-col justify-between" style={{ fontFamily: "Arial, sans-serif" }}>
                  <div className="flex items-center justify-center w-full">
                    <span className="font-bold w-[80px] text-right pr-1.5 shrink-0 whitespace-nowrap">Date Start:</span>
                    <span className="font-normal text-left w-[150px] shrink-0 whitespace-nowrap">{startDateStr}</span>
                  </div>
                  <div className="flex items-center justify-center w-full">
                    <span className="font-bold w-[80px] text-right pr-1.5 shrink-0 whitespace-nowrap">{isFinished ? "Date Finish:" : "Date Waiting:"}</span>
                    <span className="font-normal text-left w-[150px] shrink-0 whitespace-nowrap">{finishDateStr}</span>
                  </div>
                  {/* Only shown while the ticket hasn't reached Finished —
                      once finished, the finish date above already says it. */}
                  {!isFinished && (
                    <div className="flex items-center justify-center w-full">
                      <span className="font-bold text-center w-full whitespace-nowrap">Status = &apos;{formattedStatus}&apos;</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 1: Customer Information */}
              <div className="mb-2.5">
                <h2 className="text-[10pt] font-bold underline mb-1 text-black">
                  1/ <u>Customer Information (ព័ត៌មានអតិថិជន)</u>
                </h2>
                <div className="space-y-0.5 text-[10pt] text-black">
                  <div className="flex items-start">
                    <div className="w-[230px] text-right font-bold pr-2 shrink-0 whitespace-nowrap">
                      Company Name (ឈ្មោះក្រុមហ៊ុន) :
                    </div>
                    <div className="flex-1 font-normal text-black">{currentItem.companyName || "—"}</div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-[230px] text-right font-bold pr-2 shrink-0 whitespace-nowrap">
                      Attention (អ្នកទទួលខុសត្រូវ) :
                    </div>
                    <div className="flex-1 font-normal text-black">{currentItem.contactName || "—"}</div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-[230px] text-right font-bold pr-2 shrink-0 whitespace-nowrap">
                      Tel (លេខទូរស័ព្ទ) :
                    </div>
                    <div className="flex-1 font-normal text-black">{currentItem.phoneNumber || "—"}</div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-[230px] text-right font-bold pr-2 shrink-0 whitespace-nowrap">
                      Address (អាសយដ្ឋាន) :
                    </div>
                    <div className="flex-1 font-normal leading-normal text-black">{currentItem.address || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Section 2: Instrument Information */}
              <div className="mb-2.5">
                <h2 className="text-[10pt] font-bold underline mb-1 text-black">
                  2/ <u>Instrument Information (ព័ត៌មានសម្ភារៈ)</u>
                </h2>
                <div className="space-y-0.5 text-[10pt] text-black">
                  <div className="flex items-start">
                    <div className="w-[230px] text-right font-bold pr-2 shrink-0 whitespace-nowrap">
                      Product Name (ឈ្មោះម៉ាស៊ីន) :
                    </div>
                    <div className="flex-1 font-normal text-black">{currentItem.itemName || "—"}</div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-[230px] text-right font-bold pr-2 shrink-0 whitespace-nowrap">
                      Serial Number (លេខកូដ) :
                    </div>
                    <div className="flex-1 font-normal font-mono text-black">{currentItem.serialNumber || "—"}</div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-[230px] text-right font-bold pr-2 shrink-0 whitespace-nowrap">
                      Type of Service (ប្រភេទសេវាកម្ម) :
                    </div>
                    <div className="flex-1 font-normal text-black">{currentItem.serviceType || "Charge"}</div>
                  </div>
                </div>
              </div>

              {/* Section 3: Customer Request / Complaint */}
              <div className="mb-2.5">
                <h2 className="text-[10pt] font-bold underline mb-0.5 text-black">
                  3/ <u>Customer Request / Complaint (សំណើនិងការអះអាងរបស់អតិថិជន)</u>
                </h2>
                <div className="pl-[36px] text-[10pt] text-black leading-snug">
                  {currentItem.customerRequest || "—"}
                </div>
              </div>

              {/* Section 4: Diagnostic Analysis / Action Taken */}
              <div className="mb-2.5">
                <h2 className="text-[10pt] font-bold underline mb-0.5 text-black">
                  4/ <u>Diagnostic Analysis / Action Taken (វិនិច្ឆ័យខូចខាត និងការងារដែលបានធ្វើ)</u>
                </h2>
                <div className="pl-[36px] text-[10pt] text-black leading-snug">
                  {currentItem.inspection || "—"}
                </div>
              </div>

              {/* Section 5: Solution */}
              <div className="mb-2.5">
                <h2 className="text-[10pt] font-bold underline mb-0.5 text-black">
                  5/ <u>Solution (ដំណោះស្រាយ)</u>
                </h2>
                <div className="pl-[36px] text-[10pt] text-black leading-snug mb-1.5">
                  {currentItem.solution || "—"}
                </div>

                {/* Spare Parts Table — Matches DevExpress Image 2 Exact Replica */}
                <div className="mt-1.5">
                  <table className="w-full border-collapse border border-black text-[9.5pt] text-black">
                    <thead>
                      <tr className="border-b border-black text-black font-bold">
                        <th className="border-r border-black py-1 px-1.5 text-center w-8 font-bold">No</th>
                        <th className="border-r border-black py-1 px-2 text-left font-bold">Spare Part Descriptions</th>
                        <th className="border-r border-black py-1 px-2 text-center font-bold w-48">Use For</th>
                        <th className="border-r border-black py-1 px-2 text-center font-bold w-28 whitespace-nowrap">Part No</th>
                        <th className="border-r border-black py-1 px-1.5 text-center w-10 font-bold">Qty</th>
                        <th className="py-1 px-2 text-center w-20 font-bold">Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sparePartRows.length > 0 ? (
                        sparePartRows.map((sp, idx) => (
                          <tr key={sp.id || idx} className="border-b border-black text-[9.5pt]">
                            <td className="border-r border-black py-1 px-1.5 text-center">{idx + 1}</td>
                            <td className="border-r border-black py-1 px-2">{sp.itemName}</td>
                            <td className="border-r border-black py-1 px-2">{sp.useFor}</td>
                            <td className="border-r border-black py-1 px-2 text-center font-mono whitespace-nowrap">{sp.sparePartId}</td>
                            <td className="border-r border-black py-1 px-1.5 text-center">{sp.quantity}</td>
                            <td className="py-1 px-2 text-center">{sp.condition}</td>
                          </tr>
                        ))
                      ) : (
                        /* Empty Table Body: One single tall empty box with column dividers, NO inner horizontal lines! Matching Image 2 */
                        <tr className="h-20">
                          <td className="border-r border-black py-1 px-1.5">&nbsp;</td>
                          <td className="border-r border-black py-1 px-2">&nbsp;</td>
                          <td className="border-r border-black py-1 px-2">&nbsp;</td>
                          <td className="border-r border-black py-1 px-2">&nbsp;</td>
                          <td className="border-r border-black py-1 px-1.5">&nbsp;</td>
                          <td className="py-1 px-2">&nbsp;</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Signatures Block — Pinned at paper footer (mt-auto) */}
            <div className="mt-auto pt-6 grid grid-cols-3 gap-6 text-center text-[10pt] text-black shrink-0">
              {/* Customer Signature */}
              <div className="flex flex-col items-center">
                <div className="w-4/5 border-t border-black mb-1.5"></div>
                <p className="font-bold">ហត្ថលេខា និង ឈ្មោះអតិថិជន</p>
                <p className="text-[9.5pt] text-ink" style={{ fontFamily: "Arial, sans-serif" }}>Customer's signature</p>
              </div>

              {/* Verify Signature */}
              <div className="flex flex-col items-center">
                <div className="w-4/5 border-t border-black mb-1.5"></div>
                <p className="font-bold">ហត្ថលេខា និង ឈ្មោះអ្នកផ្ទៀងផ្ទាត់</p>
                <p className="text-[9.5pt] text-ink" style={{ fontFamily: "Arial, sans-serif" }}>Verify's signature</p>
                <p className="mt-1 font-semibold text-black">{currentItem.verifiedByName || currentItem.createdByName || "Seng KimNeang"}</p>
                <p className="text-[9.5pt] text-ink font-mono">{currentItem.createdByPhone || "+855 16 221 237"}</p>
              </div>

              {/* Engineer Signature */}
              <div className="flex flex-col items-center">
                <div className="w-4/5 border-t border-black mb-1.5"></div>
                <p className="font-bold">ហត្ថលេខា និង ឈ្មោះជាង</p>
                <p className="text-[9.5pt] text-ink" style={{ fontFamily: "Arial, sans-serif" }}>Engineer's signature</p>
                <p className="mt-1 font-semibold text-black">{currentItem.repairByName || "Sors Sokean"}</p>
                <p className="text-[9.5pt] text-ink font-mono">{currentItem.repairByPhone || "+855 16 380 159"}</p>
              </div>
            </div>

          </div>
        </div>

        {/* Action Footer (Screen only) */}
        <div className="px-6 py-3 bg-ink border-t border-subtle flex items-center justify-between shrink-0 print:hidden text-white">
          <p className="text-xs text-ink-muted">
            Clicking <strong className="text-white">Print Report</strong> opens your browser print dialog to print or save as PDF.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-ink-muted hover:text-white hover:bg-ink rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-1.5 text-xs font-bold text-white bg-info hover:bg-info rounded-lg transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] shadow-md shadow-info/20 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
