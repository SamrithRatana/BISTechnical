using EmployeeManagement.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public class EmployeeRepository : IEmployeeRepository
    {
        private readonly AppDbContext appDbContext;

        public EmployeeRepository(AppDbContext appDbContext)
        {
            this.appDbContext = appDbContext;
        }

        public async Task<IEnumerable<Employee>> GetEmployees()
        {
            return await appDbContext.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .OrderBy(e => e.FirstName)
                .ThenBy(e => e.LastName)
                .ToListAsync();
        }

        public async Task<Employee> GetEmployee(int employeeId)
        {
            return await appDbContext.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .FirstOrDefaultAsync(e => e.EmployeeId == employeeId);
        }

        /// <summary>Returns the employee already holding <paramref name="email"/>, if any.</summary>
        public async Task<Employee> ValidateEmployeeByEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            return await appDbContext.Employees
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Email == email);
        }

        public async Task<IEnumerable<Employee>> Search(string name, Gender? gender)
        {
            var query = appDbContext.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(name))
            {
                // Escaped so '%' / '_' typed by the user are literal characters.
                var pattern = SearchPattern.Contains(name.Trim());
                query = query.Where(e =>
                    (e.FirstName != null && EF.Functions.Like(e.FirstName, pattern, SearchPattern.EscapeCharacter)) ||
                    (e.LastName != null && EF.Functions.Like(e.LastName, pattern, SearchPattern.EscapeCharacter)));
            }

            if (gender.HasValue)
            {
                query = query.Where(e => e.Gender == gender.Value);
            }

            return await query
                .OrderBy(e => e.FirstName)
                .ThenBy(e => e.LastName)
                .ToListAsync();
        }

        public async Task<Employee> AddEmployee(Employee employee)
        {
            if (employee == null)
            {
                throw new ArgumentNullException(nameof(employee));
            }

            var result = await appDbContext.Employees.AddAsync(employee);
            await appDbContext.SaveChangesAsync();
            return result.Entity;
        }

        public async Task<Employee> UpdateEmployee(Employee employee)
        {
            if (employee == null)
            {
                throw new ArgumentNullException(nameof(employee));
            }

            var result = await appDbContext.Employees
                .FirstOrDefaultAsync(e => e.EmployeeId == employee.EmployeeId);

            if (result == null)
            {
                return null;
            }

            result.FirstName = employee.FirstName;
            result.LastName = employee.LastName;
            result.Email = employee.Email;
            result.DateOfBrith = employee.DateOfBrith;
            result.Gender = employee.Gender;
            result.DepartmentId = employee.DepartmentId;
            result.PhotoPath = employee.PhotoPath;

            await appDbContext.SaveChangesAsync();

            return result;
        }

        public async Task<Employee> DeleteEmployee(int employeeId)
        {
            var result = await appDbContext.Employees
                .FirstOrDefaultAsync(e => e.EmployeeId == employeeId);

            if (result == null)
            {
                return null;
            }

            appDbContext.Employees.Remove(result);
            await appDbContext.SaveChangesAsync();
            return result;
        }
    }
}
