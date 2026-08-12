// File: UserManagementAPI/ViewModel/RefreshTokenRequest.cs
using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class RefreshTokenRequest
    {
        [Required]
        public string RefreshToken { get; set; }
    }
}