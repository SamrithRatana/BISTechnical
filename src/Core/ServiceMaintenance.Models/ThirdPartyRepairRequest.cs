using System;

namespace ServiceMaintenance.Models
{
    public class ThirdPartyRepairRequest
    {
        public Guid Id { get; set; }
        public Guid ThirdPartyRepairBy { get; set; }
    }
}