using EmployeeManagement.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public interface ICustomerTypeRespository
    {
        // Create operation
        Task<CustomerType> CreateCustomerType(CustomerType customerType);

        // Read operations
        Task<IEnumerable<CustomerType>> GetCustomerTypes();
        Task<CustomerType> GetCustomerTypeById(int id);
        Task<(IEnumerable<CustomerType> Items, int TotalCount)> GetCustomerTypesPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null);

        // Update operation
        Task<CustomerType> UpdateCustomerType(CustomerType customerType);

        // Delete operation
        Task DeleteCustomerType(int id);
    }
}