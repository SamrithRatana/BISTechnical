using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class SparepartHoldSummary
    {
        public Guid SparepartId { get; set; }
        public string ItemName { get; set; }
        public string SerialNumber { get; set; }
        public int CurrentStock { get; set; }
        public int TotalHoldQty { get; set; }
        public int HoldCount { get; set; }
        public List<HoldServiceInfo> Services { get; set; } = new();
    }
}
