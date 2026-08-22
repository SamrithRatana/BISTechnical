using EmployeeManagement.Models;

namespace EmployeeManagement.Api.Dtos
{
    /// <summary>
    /// User as returned by the API.
    /// </summary>
    /// <remarks>
    /// The <see cref="User"/> entity carries <c>PasswordHash</c>,
    /// <c>SecurityStamp</c> and <c>ConcurrencyStamp</c>. Returning the entity
    /// directly serialised all three to the caller, so a plain
    /// <c>GET /api/users</c> handed out every password hash in the database.
    /// This projection exists so those columns can never leave the process.
    /// </remarks>
    public sealed class UserResponse
    {
        public string Id { get; init; }
        public string UserName { get; init; }
        public string Email { get; init; }
        public bool EmailConfirmed { get; init; }
        public string PhoneNumber { get; init; }
        public bool PhoneNumberConfirmed { get; init; }
        public bool TwoFactorEnabled { get; init; }
        public bool LockoutEnabled { get; init; }
        public string FirstName { get; init; }
        public string LastName { get; init; }

        public static UserResponse From(User u) => new()
        {
            Id = u.Id,
            UserName = u.UserName,
            Email = u.Email,
            EmailConfirmed = u.EmailConfirmed,
            PhoneNumber = u.PhoneNumber,
            PhoneNumberConfirmed = u.PhoneNumberConfirmed,
            TwoFactorEnabled = u.TwoFactorEnabled,
            LockoutEnabled = u.LockoutEnabled,
            FirstName = u.FirstName,
            LastName = u.LastName
        };
    }
}
