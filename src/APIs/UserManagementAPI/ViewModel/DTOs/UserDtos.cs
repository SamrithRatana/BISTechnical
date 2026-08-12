using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class CreateUserDto
    {
        [Required]
        [StringLength(50)]
        public string UserName { get; set; }

        [Required]
        [EmailAddress]
        public string Email { get; set; }

        [Required]
        [StringLength(100, MinimumLength = 6)]
        public string Password { get; set; }

        [Required]
        public string FirstName { get; set; }

        [Required]
        public string LastName { get; set; }

        [Phone]
        public string PhoneNumber { get; set; }

        public List<string> Roles { get; set; } = new List<string>();
    }

    // Update User DTO (for API)
    public class UpdateUserDto
    {
        [Required]
        [StringLength(50)]
        public string UserName { get; set; }

        [Required]
        [EmailAddress]
        public string Email { get; set; }

        [Required]
        public string FirstName { get; set; }

        [Required]
        public string LastName { get; set; }

        [Phone]
        public string PhoneNumber { get; set; }
    }

    // Update Roles DTO
    public class UpdateRolesDto
    {
        [Required]
        public string UserId { get; set; }

        [Required]
        public List<string> Roles { get; set; } = new List<string>();
    }

    // Role DTO
    public class RoleDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }

    // User Roles DTO
    public class UserRolesDto
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public List<RoleAssignmentDto> Roles { get; set; }
    }

    // Role Assignment DTO
    public class RoleAssignmentDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public bool IsAssigned { get; set; }
    }
}
    
