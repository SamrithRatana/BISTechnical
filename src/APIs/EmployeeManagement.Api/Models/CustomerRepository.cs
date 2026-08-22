using EmployeeManagement.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public class CustomerRepository : ICustomerRepository
    {
        private readonly AppDbContext appDbContext;

        public CustomerRepository(AppDbContext appDbContext)
        {
            this.appDbContext = appDbContext;
        }

        public async Task<Customer> CreateCustomer(Customer customer)
        {
            if (customer == null)
            {
                throw new ArgumentNullException(nameof(customer));
            }

            if (customer.Id == Guid.Empty)
            {
                customer.Id = Guid.NewGuid();
            }

            customer.CreatedAt = DateTime.UtcNow;
            customer.ModifiedAt = DateTime.UtcNow;

            appDbContext.Customers.Add(customer);
            await appDbContext.SaveChangesAsync();

            // Load navigation properties
            await appDbContext.Entry(customer).Reference(c => c.CustomerType).LoadAsync();

            return customer;
        }

        public async Task<IEnumerable<Customer>> GetCustomers()
        {
            return await appDbContext.Customers
                .AsNoTracking()
                .Include(c => c.CustomerType)
                .OrderBy(c => c.CompanyName)
                .ToListAsync();
        }

        public async Task<Customer> GetCustomerById(Guid id)
        {
            return await appDbContext.Customers
                .AsNoTracking()
                .Include(c => c.CustomerType)
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<(IEnumerable<Customer> Items, int TotalCount)> GetCustomersPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null,
            bool? isActive = null)
        {
            var query = appDbContext.Customers
                .AsNoTracking()
                .Include(c => c.CustomerType)
                .AsQueryable();

            if (isActive.HasValue)
            {
                query = query.Where(c => c.IsActive == isActive.Value);
            }

            // Multi-word search: every word must match at least one field.
            // Wildcards in the user's input are escaped so "50%" means the
            // literal text, not "match anything".
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                var searchWords = searchTerm
                    .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                foreach (var word in searchWords)
                {
                    // Captured per iteration so each Where gets its own pattern.
                    var pattern = SearchPattern.Contains(word);

                    query = query.Where(c =>
                        (c.CompanyName != null && EF.Functions.Like(c.CompanyName, pattern, SearchPattern.EscapeCharacter)) ||
                        (c.ContactName != null && EF.Functions.Like(c.ContactName, pattern, SearchPattern.EscapeCharacter)) ||
                        (c.PhoneNumber != null && EF.Functions.Like(c.PhoneNumber, pattern, SearchPattern.EscapeCharacter)) ||
                        (c.Email != null && EF.Functions.Like(c.Email, pattern, SearchPattern.EscapeCharacter)) ||
                        (c.Address != null && EF.Functions.Like(c.Address, pattern, SearchPattern.EscapeCharacter)));
                }
            }

            var totalCount = await query.CountAsync();

            // Short-circuit: no rows matched, so skip the second round-trip.
            if (totalCount == 0)
            {
                return (Array.Empty<Customer>(), 0);
            }

            var items = await query
                .OrderBy(c => c.CompanyName)
                .ThenBy(c => c.Id)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        public async Task<Customer> UpdateCustomer(Customer customer)
        {
            if (customer == null)
            {
                throw new ArgumentNullException(nameof(customer));
            }

            var existingCustomer = await appDbContext.Customers
                .Include(c => c.CustomerType)
                .FirstOrDefaultAsync(c => c.Id == customer.Id);

            if (existingCustomer == null)
            {
                return null;
            }

            existingCustomer.CompanyName = customer.CompanyName;
            existingCustomer.Address = customer.Address;
            existingCustomer.ContactName = customer.ContactName;
            existingCustomer.PhoneNumber = customer.PhoneNumber;
            existingCustomer.Email = customer.Email;
            existingCustomer.CustomerTypeListId = customer.CustomerTypeListId;
            existingCustomer.IsActive = customer.IsActive;
            existingCustomer.ModifiedBy = customer.ModifiedBy;
            existingCustomer.ModifiedAt = DateTime.UtcNow;

            await appDbContext.SaveChangesAsync();

            // Refresh the navigation property in case CustomerTypeListId changed.
            await appDbContext.Entry(existingCustomer).Reference(c => c.CustomerType).LoadAsync();

            return existingCustomer;
        }

        /// <summary>
        /// Assigns a customer type to many customers in a single SQL UPDATE.
        /// </summary>
        /// <returns>The number of rows actually updated.</returns>
        public async Task<int> BulkAssignCustomerType(
            IReadOnlyCollection<Guid> customerIds,
            int? customerTypeListId,
            string modifiedBy)
        {
            if (customerIds == null || customerIds.Count == 0)
            {
                return 0;
            }

            var modifiedAt = DateTime.UtcNow;

            // ExecuteUpdateAsync issues one UPDATE ... WHERE Id IN (...) rather
            // than loading each entity and saving it back one row at a time.
            return await appDbContext.Customers
                .Where(c => customerIds.Contains(c.Id))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(c => c.CustomerTypeListId, customerTypeListId)
                    .SetProperty(c => c.ModifiedBy, modifiedBy)
                    .SetProperty(c => c.ModifiedAt, modifiedAt));
        }

        /// <returns><c>true</c> if a customer was deleted, <c>false</c> if none existed.</returns>
        public async Task<bool> DeleteCustomer(Guid id)
        {
            var customer = await appDbContext.Customers.FindAsync(id);
            if (customer == null)
            {
                return false;
            }

            appDbContext.Customers.Remove(customer);
            await appDbContext.SaveChangesAsync();
            return true;
        }
    }
}
