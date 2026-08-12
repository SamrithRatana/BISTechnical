using EmployeeManagement.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public class CustomerRepository : ICustomerRespository
    {
        private readonly AppDbContext appDbContext;

        public CustomerRepository(AppDbContext appDbContext)
        {
            this.appDbContext = appDbContext;
        }

        public async Task<Customer> CreateCustomer(Customer customer)
        {
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
                .Include(c => c.CustomerType)
                .ToListAsync();
        }

        public async Task<Customer> GetCustomerById(Guid id)
        {
            return await appDbContext.Customers
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
                .Include(c => c.CustomerType)
                .AsQueryable();

            // Apply isActive filter
            if (isActive.HasValue)
            {
                query = query.Where(c => c.IsActive == isActive.Value);
            }

            // ✅ IMPROVED: Apply multi-word, case-insensitive search filter
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                // Split search term into individual words
                var searchWords = searchTerm.Trim()
                    .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(word => word.ToLower())
                    .ToList();

                // Apply filter: ALL words must match at least one field
                foreach (var word in searchWords)
                {
                    query = query.Where(c =>
                        (c.CompanyName != null && EF.Functions.Like(c.CompanyName.ToLower(), $"%{word}%")) ||
                        (c.ContactName != null && EF.Functions.Like(c.ContactName.ToLower(), $"%{word}%")) ||
                        (c.PhoneNumber != null && EF.Functions.Like(c.PhoneNumber.ToLower(), $"%{word}%")) ||
                        (c.Email != null && EF.Functions.Like(c.Email.ToLower(), $"%{word}%")) ||
                        (c.Address != null && EF.Functions.Like(c.Address.ToLower(), $"%{word}%"))
                    );
                }
            }

            // Get total count before pagination
            var totalCount = await query.CountAsync();

            // Apply pagination
            var items = await query
                .OrderBy(c => c.CompanyName)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        public async Task<Customer> UpdateCustomer(Customer customer)
        {
            var existingCustomer = await appDbContext.Customers
                .Include(c => c.CustomerType)
                .FirstOrDefaultAsync(c => c.Id == customer.Id);

            if (existingCustomer != null)
            {
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

                // Reload to get CustomerType navigation property
                await appDbContext.Entry(existingCustomer).Reference(c => c.CustomerType).LoadAsync();
            }

            return existingCustomer;
        }

        public async Task DeleteCustomer(Guid id)
        {
            var customer = await appDbContext.Customers.FindAsync(id);
            if (customer != null)
            {
                appDbContext.Customers.Remove(customer);
                await appDbContext.SaveChangesAsync();
            }
        }
    }
}