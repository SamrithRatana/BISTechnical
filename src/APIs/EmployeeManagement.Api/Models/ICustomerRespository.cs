using EmployeeManagement.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public interface ICustomerRespository
    {
        // Create operation
        Task<Customer> CreateCustomer(Customer customer);

        // Read operations
        Task<IEnumerable<Customer>> GetCustomers();
        Task<Customer> GetCustomerById(Guid id);
        Task<(IEnumerable<Customer> Items, int TotalCount)> GetCustomersPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null,
            bool? isActive = null);

        // Update operation
        Task<Customer> UpdateCustomer(Customer customer);

        // Delete operation
        Task DeleteCustomer(Guid id);
    }
}