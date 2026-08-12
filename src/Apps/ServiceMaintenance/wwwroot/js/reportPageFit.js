// ═══════════════════════════════════════════════════════════════
// reportPageFit.js
//
// Shared "no outer page scrollbar" behavior for any report page.
// Pins a wrapper element's height to exactly what's left of the
// viewport below it (not a blind 100vh, which ignores the
// wrapper's own offset from the top of the page), and re-measures
// on window resize.
//
// Usable by any page: pass the wrapper's element id.
//   window.reportPageFit.init('dailyReportPageWrapper');
//   window.reportPageFit.init('monthlyReportPageWrapper');
// ═══════════════════════════════════════════════════════════════
window.reportPageFit = {
    _bound: {},

    adjust: function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        const available = Math.max(200, window.innerHeight - top - 8);
        el.style.height = available + 'px';
        el.style.maxHeight = available + 'px';
    },

    init: function (id) {
        // Double rAF: wait for the browser to actually paint the
        // current layout (navbar, toolbar, Syncfusion widgets)
        // before measuring — measuring on the same tick as
        // firstRender can catch things mid-layout and lock in a
        // wrong offset, leaving a stray gap once things settle.
        const self = this;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => self.adjust(id));
        });

        if (!this._bound[id]) {
            const handler = () => this.adjust(id);
            window.addEventListener('resize', handler);
            this._bound[id] = handler;
        }
    },

    // Call when a page is torn down / component disposed, to avoid
    // leaking resize listeners across navigations.
    dispose: function (id) {
        if (this._bound[id]) {
            window.removeEventListener('resize', this._bound[id]);
            delete this._bound[id];
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// Shared report print/export helpers (moved out of individual
// pages so every report page gets the same behavior/error handling).
// ═══════════════════════════════════════════════════════════════
window.blazorReportsPrint = window.blazorReportsPrint || {};

window.blazorReportsPrint.previewReportInNewTab = function (base64Data, filename) {
    try {
        if (!base64Data) { alert('Error: No report data to display'); return; }
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
            newWindow.document.title = filename || 'Report';
            setTimeout(function () { newWindow.focus(); newWindow.print(); }, 500);
            setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        } else {
            alert('Please allow popups to preview the report.\n\nOr use the "Export to PDF" option to download instead.');
            downloadBlobInternal(blob, filename);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        alert('Error opening report preview: ' + error.message);
    }
};

window.blazorReportsPrint.printReport = function (base64Data, filename) {
    window.blazorReportsPrint.previewReportInNewTab(base64Data, filename);
};

window.downloadReportPdf = function (reportData, filename) {
    try {
        if (!reportData || reportData.length === 0) { alert('Error: No report data to download'); return; }
        const blob = new Blob([reportData], { type: 'application/pdf' });
        downloadBlobInternal(blob, filename || 'Report.pdf');
    } catch (error) {
        alert('Error downloading PDF: ' + error.message);
    }
};

window.downloadExcelFile = function (bytes, filename) {
    try {
        const blob = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlobInternal(blob, filename || 'Report.xlsx');
    } catch (error) {
        alert('Error downloading Excel file: ' + error.message);
    }
};

function downloadBlobInternal(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || 'Report';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
}
