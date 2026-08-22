using EmployeeManagement.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public class UserRepository : IUserRepository
    {
        private readonly AppDbContext _context;

        public UserRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<User> GetUser(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return null;
            }

            return await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == id);
        }

        public async Task<IEnumerable<User>> GetUsers()
        {
            return await _context.Users
                .AsNoTracking()
                .OrderBy(u => u.UserName)
                .ToListAsync();
        }

        public async Task<User> AddUser(User user)
        {
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }

        /// <summary>
        /// Updates the editable profile fields of an existing user.
        /// Security-sensitive columns (PasswordHash, SecurityStamp, ConcurrencyStamp,
        /// lockout counters) are deliberately NOT copied from the caller-supplied
        /// entity: a full <c>DbSet.Update</c> let any caller overwrite the password
        /// hash and security stamp with values of their choosing.
        /// </summary>
        public async Task<User> UpdateUser(User user)
        {
            if (user == null || string.IsNullOrWhiteSpace(user.Id))
            {
                return null;
            }

            var existing = await _context.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
            if (existing == null)
            {
                return null;
            }

            existing.UserName = user.UserName;
            existing.NormalizedUserName = user.UserName?.ToUpperInvariant();
            existing.Email = user.Email;
            existing.NormalizedEmail = user.Email?.ToUpperInvariant();
            existing.EmailConfirmed = user.EmailConfirmed;
            existing.PhoneNumber = user.PhoneNumber;
            existing.PhoneNumberConfirmed = user.PhoneNumberConfirmed;
            existing.TwoFactorEnabled = user.TwoFactorEnabled;
            existing.LockoutEnabled = user.LockoutEnabled;
            existing.FirstName = user.FirstName;
            existing.LastName = user.LastName;
            existing.ProfilePicture = user.ProfilePicture;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task<User> DeleteUser(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return null;
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null)
            {
                return null;
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return user;
        }

        public async Task<IEnumerable<User>> Search(string name, string email)
        {
            var query = _context.Users.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(name))
            {
                var pattern = SearchPattern.Contains(name);
                query = query.Where(u => u.UserName != null &&
                    EF.Functions.Like(u.UserName, pattern, SearchPattern.EscapeCharacter));
            }

            if (!string.IsNullOrWhiteSpace(email))
            {
                var pattern = SearchPattern.Contains(email);
                query = query.Where(u => u.Email != null &&
                    EF.Functions.Like(u.Email, pattern, SearchPattern.EscapeCharacter));
            }

            return await query
                .OrderBy(u => u.UserName)
                .ToListAsync();
        }

        public async Task<User> ValidateUserByEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            return await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email == email);
        }
    }
}
