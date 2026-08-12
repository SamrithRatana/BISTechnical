// Enhanced Print Helper Functions for BlazorReports
window.blazorReportsPrint = {
    // Print report from URL with better error handling
    printReport: function (url) {
        try {
            const printWindow = window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,status=no');
            if (printWindow) {
                printWindow.onload = function () {
                    setTimeout(() => {
                        printWindow.focus();
                        printWindow.print();
                        // Close window after printing (optional)
                        printWindow.onafterprint = function () {
                            setTimeout(() => {
                                printWindow.close();
                            }, 1000);
                        };
                    }, 1500);
                };
                // Fallback if onload doesn't fire
                setTimeout(() => {
                    if (printWindow && !printWindow.closed) {
                        printWindow.focus();
                        printWindow.print();
                    }
                }, 3000);
            } else {
                console.error('Failed to open print window. Please check your popup blocker settings.');
                alert('Failed to open print window. Please check your popup blocker settings.');
            }
        } catch (error) {
            console.error('Error printing report:', error);
            alert('Error printing report: ' + error.message);
        }
    },
}
