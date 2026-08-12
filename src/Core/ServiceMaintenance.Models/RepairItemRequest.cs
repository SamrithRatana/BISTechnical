using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class RepairItemRequest
    {
        public Guid Id { get; set; } // The GUID for the Repair Service Id
        public Guid repairBy { get; set; } // The GUID of the user performing the action
    }
}
