using EmployeeManagement.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public class CustomerTypeRepository : ICustomerTypeRespository
    {
        private readonly AppDbContext appDbContext;

        public CustomerTypeRepository(AppDbContext appDbContext)
        {
            this.appDbContext = appDbContext;
        }

        public async Task<CustomerType> CreateCustomerType(CustomerType customerType)
        {
            customerType.CreatedAt = DateTime.UtcNow;
            customerType.ModifiedAt = DateTime.UtcNow;

            appDbContext.CustomerTypes.Add(customerType);
            await appDbContext.SaveChangesAsync();

            return customerType;
        }

        public async Task<IEnumerable<CustomerType>> GetCustomerTypes()
        {
            return await appDbContext.CustomerTypes.ToListAsync();
        }

        public async Task<CustomerType> GetCustomerTypeById(int id)
        {
            return await appDbContext.CustomerTypes
                .FirstOrDefaultAsync(ct => ct.ListId == id);
        }

        public async Task<(IEnumerable<CustomerType> Items, int TotalCount)> GetCustomerTypesPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null)
        {
            var query = appDbContext.CustomerTypes.AsQueryable();

            // Apply search filter
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                searchTerm = searchTerm.ToLower();
                query = query.Where(ct => ct.Type.ToLower().Contains(searchTerm));
            }

            // Get total count
            var totalCount = await query.CountAsync();

            // Apply pagination
            var items = await query
                .OrderBy(ct => ct.Type)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        public async Task<CustomerType> UpdateCustomerType(CustomerType customerType)
        {
            var existingCustomerType = await appDbContext.CustomerTypes
                .FirstOrDefaultAsync(ct => ct.ListId == customerType.ListId);

            if (existingCustomerType != null)
            {
                existingCustomerType.Type = customerType.Type;
                existingCustomerType.ModifiedBy = customerType.ModifiedBy;
                existingCustomerType.ModifiedAt = DateTime.UtcNow;

                await appDbContext.SaveChangesAsync();
            }

            return existingCustomerType;
        }

        public async Task DeleteCustomerType(int id)
        {
            var customerType = await appDbContext.CustomerTypes
                .FirstOrDefaultAsync(ct => ct.ListId == id);

            if (customerType != null)
            {
                appDbContext.CustomerTypes.Remove(customerType);
                await appDbContext.SaveChangesAsync();
            }
        }
    }
}
