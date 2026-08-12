using System;
using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.Models
{
    public class CustomerType
    {
        [Key]
        public int ListId { get; set; } // Changed to int to match the SQL table's INT primary key

        public int? ParentListId { get; set; } // Changed to nullable int to match the SQL table's INT column

        [StringLength(16)]
        public string CreatedBy { get; set; }

        public DateTime? CreatedAt { get; set; } // Nullable DateTime for CreatedAt

        [StringLength(16)]
        public string ModifiedBy { get; set; }

        public DateTime? ModifiedAt { get; set; } // Nullable DateTime for ModifiedAt

        [StringLength(1000)]
        public string Type { get; set; }

        public string Description { get; set; } // Nullable by default for string

        public bool? IsActive { get; set; } // Nullable bool for IsActive
    }
}
