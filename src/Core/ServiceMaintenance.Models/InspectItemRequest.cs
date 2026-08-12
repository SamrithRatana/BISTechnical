using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ServiceMaintenance.Models
{
    public class InspectItemRequest
    {
        public Guid Id { get; set; }
        public Guid InspectBy { get; set; }
        [Required]
        public string Inspection { get; set; }
        [Required]
        public string Solution { get; set; }
        public int? ServiceTypeId { get; set; } // ✅ ADD THIS
        public List<SparePart> SpareParts { get; set; }
    }

    public class SparePart
    {
        public Guid Id { get; set; } 
        public Guid SparePartId { get; set; }
        public string Description { get; set; }
        public int Quantity { get; set; }
        public string Condition { get; set; }
        public Guid ServiceId { get; set; }
        public string ItemName { get; set; }
        public string SerialNumber { get; set; }
        public string UseFor { get; set; }
        public string ChargeType { get; set; }
        public bool IsHoldStatus { get; set; } = false; // ✅ NEW
        public string Remarks { get; set; } // ✅ NEW


    }
}