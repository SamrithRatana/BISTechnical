using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class EditUserViewModel
    {
        public string Id { get; set; }

        [Required]
        [Display(Name = "User Name")]
        public string UserName { get; set; }

        [Required]
        [EmailAddress]
        public string Email { get; set; }

        [Required]
        [Display(Name = "First Name")]
        public string FirstName { get; set; }

        [Required]
        [Display(Name = "Last Name")]
        public string LastName { get; set; }

        public List<RoleSelectionViewModel> Roles { get; set; }
    }
}