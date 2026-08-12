using System;

namespace ServiceMaintenance.Models
{
    public class SentSparepartsRequest
    {
        public Guid Id { get; set; }                     // Repair Service Id
        public Guid SetSentSparepartsBy { get; set; }     // User performing the action
    }
}