using EmployeeManagement.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public interface ICustomerTypeRepository
    {
        // Create
        Task<CustomerType> CreateCustomerType(CustomerType customerType);

        // Read
        Task<IEnumerable<CustomerType>> GetCustomerTypes();
        Task<CustomerType> GetCustomerTypeById(int id);
        Task<(IEnumerable<CustomerType> Items, int TotalCount)> GetCustomerTypesPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null);

        // Update
        Task<CustomerType> UpdateCustomerType(CustomerType customerType);

        // Delete
        Task<bool> DeleteCustomerType(int id);
    }
}
