using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class ManualStockOutObject
    {
        public Guid Id { get; set; }
        public Guid SparepartId { get; set; }
        public int Quantity { get; set; }
        public string Reason { get; set; }
        public Guid? PerformedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
