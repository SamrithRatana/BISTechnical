using EmployeeManagement.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.Api.Dtos
{
    /// <summary>
    /// Customer as returned by the API: the entity's own columns plus the
    /// resolved customer-type name. Replaces five hand-written copies of the
    /// same anonymous-object projection; the property names (and therefore the
    /// serialised JSON) are unchanged.
    /// </summary>
    public sealed class CustomerResponse
    {
        public Guid Id { get; init; }
        public string CreatedBy { get; init; }
        public DateTime? CreatedAt { get; init; }
        public string ModifiedBy { get; init; }
        public DateTime? ModifiedAt { get; init; }
        public string CompanyName { get; init; }
        public string Address { get; init; }
        public string ContactName { get; init; }
        public string PhoneNumber { get; init; }
        public string Email { get; init; }
        public int? CustomerTypeListId { get; init; }
        public bool? IsActive { get; init; }
        public string CustomerType { get; init; }

        public static CustomerResponse From(Customer c) => new()
        {
            Id = c.Id,
            CreatedBy = c.CreatedBy,
            CreatedAt = c.CreatedAt,
            ModifiedBy = c.ModifiedBy,
            ModifiedAt = c.ModifiedAt,
            CompanyName = c.CompanyName,
            Address = c.Address,
            ContactName = c.ContactName,
            PhoneNumber = c.PhoneNumber,
            Email = c.Email,
            CustomerTypeListId = c.CustomerTypeListId,
            IsActive = c.IsActive,
            CustomerType = c.CustomerType?.Type
        };
    }

    /// <summary>Request body for <c>PUT /api/Customer/bulk-assign-type</c>.</summary>
    public sealed class BulkAssignCustomerTypeRequest
    {
        [Required]
        [MinLength(1, ErrorMessage = "At least one customer id is required.")]
        [MaxLength(BulkAssignLimits.MaxCustomerIds,
            ErrorMessage = "Too many customer ids in one request.")]
        public List<Guid> CustomerIds { get; set; }

        /// <summary>Null clears the customer type on every listed customer.</summary>
        public int? CustomerTypeListId { get; set; }

        [StringLength(16)]
        public string ModifiedBy { get; set; }
    }

    /// <summary>Response body for <c>PUT /api/Customer/bulk-assign-type</c>.</summary>
    public sealed class BulkAssignResult
    {
        public int RequestedCount { get; init; }
        public int UpdatedCount { get; init; }
    }

    internal static class BulkAssignLimits
    {
        /// <summary>
        /// Caps the IN (...) list so one request cannot build an unbounded query.
        /// </summary>
        public const int MaxCustomerIds = 1000;
    }
}
