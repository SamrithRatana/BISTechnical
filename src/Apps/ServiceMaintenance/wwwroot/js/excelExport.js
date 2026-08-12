// wwwroot/js/excelExport.js
// Requires SheetJS loaded before this file:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

window.exportToExcel = function (rows, headers, fileName, sheetName) {
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto column widths based on content
    const colWidths = headers.map((h, i) => ({
        wch: Math.max(
            h.length,
            ...rows.map(r => (r[i] == null ? 0 : String(r[i]).length))
        ) + 2
    }));
    ws['!cols'] = colWidths;

    // Freeze top header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Export');
    XLSX.writeFile(wb, fileName);
};