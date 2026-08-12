using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ServiceMaintenance.Models
{
    public class Repairs
    {
        public Guid Id { get; set; } = Guid.Empty;

        [Required(ErrorMessage = "ItemName is required.(ត្រូវតែបំពេញ)")]
        public string ItemName { get; set; }

        [Required(ErrorMessage = "SerialNumber is required.(ត្រូវតែបំពេញ)")]
        public string SerialNumber { get; set; }
        [Required(ErrorMessage = "ItemType is required.(ត្រូវតែបំពេញ)")]
        public string ItemType { get; set; }
    }
}
