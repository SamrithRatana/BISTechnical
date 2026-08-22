/**
 * @file annualTechnicalExcel.ts
 * @description Generates the official "Monthly technical report - Technical dept/team"
 * Excel workbook (.xlsx) matching the company's exact template layout, fonts, borders,
 * and signature boxes.
 */

import ExcelJS from "exceljs";

export interface MonthlyMatrixData {
  year: number;
  // Table 1 rows (12 numbers each for Jan-Dec)
  machineIn: number[];
  machineOut: number[];
  unrepairable: number[];
  awaitingConfirm: number[];
  doubleTT: number[];
  tonerIssues: number[];
  onsiteService: number[];
  dailyResolved: number[];
  inHouseResolved: number[];
  pendingUnresolved: number[];

  // Table 2 rows (12 numbers each for Jan-Dec)
  tonerReplace: number[];
  tonerFix: number[];

  // Bottom section
  summaryNotes: string;
  preparedDate: string;
  preparedBy: string;
  headDate: string;
  headOfTechnical: string;
}

export async function exportAnnualTechnicalExcel(data: MonthlyMatrixData): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ServiceMaintenanceSystem";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Technical ${data.year}`, {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
  });

  const yrShort = String(data.year).slice(-2);
  const months = [
    `Jan-${yrShort}`,
    `Feb-${yrShort}`,
    `Mar-${yrShort}`,
    `Apr-${yrShort}`,
    `May-${yrShort}`,
    `Jun-${yrShort}`,
    `Jul-${yrShort}`,
    `Aug-${yrShort}`,
    `Sep-${yrShort}`,
    `Oct-${yrShort}`,
    `Nov-${yrShort}`,
    `Dec-${yrShort}`,
  ];

  // Column widths
  sheet.getColumn(1).width = 36; // Label column
  for (let c = 2; c <= 13; c++) {
    sheet.getColumn(c).width = 10; // Month columns
  }

  // Styles
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF444444" } },
    left: { style: "thin", color: { argb: "FF444444" } },
    bottom: { style: "thin", color: { argb: "FF444444" } },
    right: { style: "thin", color: { argb: "FF444444" } },
  };

  const tableHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF9CA3AF" }, // Light Slate
  };

  // Row 1: Top Title Bar
  sheet.mergeCells("A1:D1");
  const cellA1 = sheet.getCell("A1");
  cellA1.value = "Monthly technical report";
  cellA1.font = { bold: true, size: 12, color: { argb: "FF111827" } };
  cellA1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cellA1.border = borderThin;

  sheet.mergeCells("E1:M1");
  const cellE1 = sheet.getCell("E1");
  cellE1.value = "Technical dept/team";
  cellE1.font = { bold: true, size: 12, color: { argb: "FF111827" } };
  cellE1.alignment = { vertical: "middle", horizontal: "center" };
  cellE1.border = borderThin;

  sheet.getRow(1).height = 28;

  // Row 2: Table 1 Header
  sheet.getRow(2).height = 24;
  const h1 = sheet.getCell("A2");
  h1.value = "technical for month";
  h1.font = { bold: true, size: 10, color: { argb: "FF111827" } };
  h1.alignment = { vertical: "middle", horizontal: "center" };
  h1.fill = tableHeaderFill;
  h1.border = borderThin;

  months.forEach((m, idx) => {
    const cell = sheet.getCell(2, idx + 2);
    cell.value = m;
    cell.font = { bold: true, size: 10, color: { argb: "FF111827" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = tableHeaderFill;
    cell.border = borderThin;
  });

  // Table 1 Rows
  const table1Rows: [string, number[]][] = [
    ["ម៉ាស៊ីនចូល", data.machineIn],
    ["ម៉ាស៊ីនចេញ", data.machineOut],
    ["ម៉ាស៊ីនជួសជុលមិនបាន", data.unrepairable],
    ["ម៉ាស៊ីនរង់ចាំការយល់ព្រមជួសជុល", data.awaitingConfirm],
    ["ម៉ាស៊ីនជួសជុល Double TT", data.doubleTT],
    ["បញ្ហាទឹកថ្នាំ", data.tonerIssues],
    ["ឆែក&ជួសជុលម៉ាស៊ីនខាងក្រៅ", data.onsiteService],
    ["ដោះស្រាយបញ្ហាប្រចាំថ្ងៃ", data.dailyResolved],
    ["ដោះស្រាយផ្ទាល់", data.inHouseResolved],
    ["បញ្ហាដោះស្រាយមិនទាន់ចប់ក្នុងថ្ងៃ", data.pendingUnresolved],
  ];

  let curRow = 3;
  table1Rows.forEach(([name, vals]) => {
    sheet.getRow(curRow).height = 22;
    const labelCell = sheet.getCell(curRow, 1);
    labelCell.value = name;
    labelCell.font = { bold: true, size: 10 };
    labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    labelCell.border = borderThin;

    for (let c = 0; c < 12; c++) {
      const valCell = sheet.getCell(curRow, c + 2);
      valCell.value = vals[c] ?? 0;
      valCell.font = { size: 10, bold: true };
      valCell.alignment = { vertical: "middle", horizontal: "center" };
      valCell.border = borderThin;
      valCell.numFmt = "#,##0";
    }
    curRow++;
  });

  // Table 2 Header: Toner error & Chip
  sheet.getRow(curRow).height = 24;
  sheet.mergeCells(`A${curRow}:A${curRow}`);
  const h2 = sheet.getCell(curRow, 1);
  h2.value = "Toner error & Chip";
  h2.font = { bold: true, size: 10, color: { argb: "FF111827" } };
  h2.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  h2.fill = tableHeaderFill;
  h2.border = borderThin;

  months.forEach((m, idx) => {
    const cell = sheet.getCell(curRow, idx + 2);
    cell.value = m;
    cell.font = { bold: true, size: 10, color: { argb: "FF111827" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = tableHeaderFill;
    cell.border = borderThin;
  });
  curRow++;

  // Table 2 Rows
  const table2Rows: [string, number[]][] = [
    ["Replace", data.tonerReplace],
    ["Fix", data.tonerFix],
  ];

  table2Rows.forEach(([name, vals]) => {
    sheet.getRow(curRow).height = 22;
    const labelCell = sheet.getCell(curRow, 1);
    labelCell.value = name;
    labelCell.font = { bold: true, size: 10 };
    labelCell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    labelCell.border = borderThin;

    for (let c = 0; c < 12; c++) {
      const valCell = sheet.getCell(curRow, c + 2);
      valCell.value = vals[c] ?? 0;
      valCell.font = { size: 10, bold: true };
      valCell.alignment = { vertical: "middle", horizontal: "center" };
      valCell.border = borderThin;
      valCell.numFmt = "#,##0";
    }
    curRow++;
  });

  // Space row
  curRow++;

  // Label: summary/forecast of technical performance and activities
  sheet.mergeCells(`F${curRow}:M${curRow}`);
  const forecastLabel = sheet.getCell(`F${curRow}`);
  forecastLabel.value = "summary/forecast of technical performance and activities";
  forecastLabel.font = { italic: true, size: 9, color: { argb: "FF4B5563" } };
  forecastLabel.alignment = { vertical: "middle", horizontal: "right" };
  curRow++;

  // Box: Notes & Forecast + Signatures
  const boxStart = curRow;
  const boxEnd = curRow + 7;

  for (let r = boxStart; r <= boxEnd; r++) {
    for (let c = 1; c <= 13; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: r === boxStart ? { style: "medium" } : undefined,
        bottom: r === boxEnd ? { style: "medium" } : undefined,
        left: c === 1 ? { style: "medium" } : undefined,
        right: c === 13 ? { style: "medium" } : undefined,
      };
    }
  }

  // Summary notes content
  sheet.mergeCells(`A${boxStart}:M${boxStart + 2}`);
  const notesCell = sheet.getCell(`A${boxStart}`);
  notesCell.value = data.summaryNotes || "(No forecast or summary notes provided for this period)";
  notesCell.font = { size: 10 };
  notesCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  // Signature Left: Prepared By
  const sigRow1 = boxStart + 3;
  const sigRow2 = boxStart + 4;
  const sigRow3 = boxStart + 6;

  sheet.getCell(`B${sigRow1}`).value = `Date: ${data.preparedDate || "____ / ____ / ____"}`;
  sheet.getCell(`B${sigRow1}`).font = { bold: true, size: 10 };

  sheet.getCell(`B${sigRow2}`).value = "Prepared by:";
  sheet.getCell(`B${sigRow2}`).font = { bold: true, size: 10 };

  sheet.getCell(`B${sigRow3}`).value = data.preparedBy || "__________________";
  sheet.getCell(`B${sigRow3}`).font = { bold: true, size: 11 };

  // Signature Right: Head of Technical
  sheet.getCell(`J${sigRow1}`).value = `Date: ${data.headDate || "____ / ____ / ____"}`;
  sheet.getCell(`J${sigRow1}`).font = { bold: true, size: 10 };

  sheet.getCell(`J${sigRow2}`).value = "Head of Technical";
  sheet.getCell(`J${sigRow2}`).font = { bold: true, size: 10 };

  sheet.getCell(`J${sigRow3}`).value = data.headOfTechnical || "__________________";
  sheet.getCell(`J${sigRow3}`).font = { bold: true, size: 11 };

  // Trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Monthly-Technical-Report-${data.year}.xlsx`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
