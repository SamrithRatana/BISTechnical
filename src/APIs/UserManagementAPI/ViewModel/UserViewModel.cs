using System.Collections.Generic;

namespace UserManagementAPI.ViewModel
{
    public class UserViewModel
    {
        public string Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
        public string PhoneNumber { get; set; } 

        public string Password { get; set; }
        public string ConfirmPassword { get; set; }
        public byte[] ProfilePicture { get; set; }
        public IEnumerable<string> Roles { get; set; }
        public bool IsOnline { get; set; } = false;

        public string DisplayName => $"{FirstName} {LastName}";

    }
}