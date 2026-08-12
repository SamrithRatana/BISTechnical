// File: UserManagementAPI/Models/RefreshToken.cs
using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.Models
{
    /// <summary>
    /// ✅ Refresh Token Model for JWT Token Rotation
    /// Stores refresh tokens in database for security
    /// </summary>
    public class RefreshToken
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; }

        [Required]
        [StringLength(500)]
        public string Token { get; set; }

        [Required]
        [StringLength(500)]
        public string JwtId { get; set; } // Links to JWT token's jti claim

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public bool IsUsed { get; set; } = false;

        public bool IsRevoked { get; set; } = false;

        public string? ReplacedByToken { get; set; }

        public string? RevokedReason { get; set; }

        // Navigation property
        public virtual ApplicationUser User { get; set; }
    }
}