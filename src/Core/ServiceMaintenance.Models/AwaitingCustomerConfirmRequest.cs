using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class AwaitingCustomerConfirmRequest
    {
        public Guid Id { get; set; } // The GUID for the Repair Service Id
        public Guid SetAwaitingCustomerConfirmBy { get; set; } // The GUID of the user performing the action
    }
}
