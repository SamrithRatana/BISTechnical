using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class ChangePasswordViewModel
    {
        public string UserId { get; set; }
        public string UserName { get; set; }

        [Required]
        [DataType(DataType.Password)]
        [Display(Name = "New Password")]
        public string NewPassword { get; set; }

        [Required]
        [DataType(DataType.Password)]
        [Display(Name = "Confirm New Password")]
        [Compare("NewPassword", ErrorMessage = "The new password and confirmation password do not match.")]
        public string ConfirmPassword { get; set; }
    }
}