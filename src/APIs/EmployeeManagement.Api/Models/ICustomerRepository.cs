using EmployeeManagement.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public interface ICustomerRepository
    {
        // Create
        Task<Customer> CreateCustomer(Customer customer);

        // Read
        Task<IEnumerable<Customer>> GetCustomers();
        Task<Customer> GetCustomerById(Guid id);
        Task<(IEnumerable<Customer> Items, int TotalCount)> GetCustomersPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null,
            bool? isActive = null);

        // Update
        Task<Customer> UpdateCustomer(Customer customer);
        Task<int> BulkAssignCustomerType(
            IReadOnlyCollection<Guid> customerIds,
            int? customerTypeListId,
            string modifiedBy);

        // Delete
        Task<bool> DeleteCustomer(Guid id);
    }
}
