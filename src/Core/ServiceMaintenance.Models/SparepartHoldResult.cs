using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class SparepartHoldResult
    {
        public List<SparepartHoldSummary> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int TotalHoldQty { get; set; }
        public int TotalHoldJobs { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }
}
