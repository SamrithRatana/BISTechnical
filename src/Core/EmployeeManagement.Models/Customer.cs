using System;
using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.Models
{
    public class Customer
    {
        [Key]
  
        public Guid Id { get; set; }

        [StringLength(16)]
        public string? CreatedBy { get; set; }

        public DateTime? CreatedAt { get; set; } // Nullable DateTime for CreatedAt

        [StringLength(16)]
        public string? ModifiedBy { get; set; }

        public DateTime? ModifiedAt { get; set; } // Nullable DateTime for ModifiedAt

        [StringLength(1000)]
        public string? CompanyName { get; set; }

        public string? Address { get; set; }

        [StringLength(1000)]
        public string? ContactName { get; set; }

        [StringLength(100)]
        public string? PhoneNumber { get; set; }

        [StringLength(255)]
        public string? Email { get; set; }


        public int? CustomerTypeListId { get; set; } // Nullable Guid


        [StringLength(16)]
        public string? BankAccountListId { get; set; } // Nullable string

        [StringLength(16)]
        public string? TermListId { get; set; } // Nullable string

        public bool? IsActive { get; set; } // Nullable bool for IsActive

        // Add a navigation property for CustomerType
        public CustomerType? CustomerType { get; set; }
    }
}
