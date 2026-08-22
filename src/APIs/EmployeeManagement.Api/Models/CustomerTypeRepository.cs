using EmployeeManagement.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public class CustomerTypeRepository : ICustomerTypeRepository
    {
        private readonly AppDbContext appDbContext;

        public CustomerTypeRepository(AppDbContext appDbContext)
        {
            this.appDbContext = appDbContext;
        }

        public async Task<CustomerType> CreateCustomerType(CustomerType customerType)
        {
            if (customerType == null)
            {
                throw new ArgumentNullException(nameof(customerType));
            }

            customerType.CreatedAt = DateTime.UtcNow;
            customerType.ModifiedAt = DateTime.UtcNow;

            appDbContext.CustomerTypes.Add(customerType);
            await appDbContext.SaveChangesAsync();

            return customerType;
        }

        public async Task<IEnumerable<CustomerType>> GetCustomerTypes()
        {
            return await appDbContext.CustomerTypes
                .AsNoTracking()
                .OrderBy(ct => ct.Type)
                .ToListAsync();
        }

        public async Task<CustomerType> GetCustomerTypeById(int id)
        {
            return await appDbContext.CustomerTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(ct => ct.ListId == id);
        }

        public async Task<(IEnumerable<CustomerType> Items, int TotalCount)> GetCustomerTypesPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null)
        {
            var query = appDbContext.CustomerTypes.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                // Escaped so wildcards typed by the user are matched literally.
                var pattern = SearchPattern.Contains(searchTerm.Trim());
                query = query.Where(ct => ct.Type != null &&
                    EF.Functions.Like(ct.Type, pattern, SearchPattern.EscapeCharacter));
            }

            var totalCount = await query.CountAsync();

            if (totalCount == 0)
            {
                return (Array.Empty<CustomerType>(), 0);
            }

            var items = await query
                .OrderBy(ct => ct.Type)
                .ThenBy(ct => ct.ListId)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        public async Task<CustomerType> UpdateCustomerType(CustomerType customerType)
        {
            if (customerType == null)
            {
                throw new ArgumentNullException(nameof(customerType));
            }

            var existingCustomerType = await appDbContext.CustomerTypes
                .FirstOrDefaultAsync(ct => ct.ListId == customerType.ListId);

            if (existingCustomerType == null)
            {
                return null;
            }

            existingCustomerType.Type = customerType.Type;
            existingCustomerType.Description = customerType.Description;
            existingCustomerType.IsActive = customerType.IsActive;
            existingCustomerType.ModifiedBy = customerType.ModifiedBy;
            existingCustomerType.ModifiedAt = DateTime.UtcNow;

            await appDbContext.SaveChangesAsync();

            return existingCustomerType;
        }

        /// <returns><c>true</c> if a row was deleted, <c>false</c> if none existed.</returns>
        public async Task<bool> DeleteCustomerType(int id)
        {
            var customerType = await appDbContext.CustomerTypes
                .FirstOrDefaultAsync(ct => ct.ListId == id);

            if (customerType == null)
            {
                return false;
            }

            appDbContext.CustomerTypes.Remove(customerType);
            await appDbContext.SaveChangesAsync();
            return true;
        }
    }
}
