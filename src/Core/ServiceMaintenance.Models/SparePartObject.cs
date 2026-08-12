using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class SparePartObject
    {
        public Guid Id { get; set; } = Guid.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string UseFor { get; set; } = string.Empty;
        public int Quantity { get; set; } = 0;
        public string PictureUrl { get; set; } = string.Empty;
        public Guid LinkItemId { get; set; } = Guid.Empty;
        public int UsageCount { get; set; }
        public int TotalQtyUsed { get; set; }
        public decimal DefaultPrice { get; set; } = 0; // ✅ ត្រូវប្រាកដថាមាន
    }
}
