using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class HoldServiceInfo
    {
        public Guid? ServiceId { get; set; }
        public string ReportNo { get; set; }
        public string CompanyName { get; set; }
        public string ServiceStatus { get; set; }
        public int Quantity { get; set; }
        public string Condition { get; set; }
    }
}
