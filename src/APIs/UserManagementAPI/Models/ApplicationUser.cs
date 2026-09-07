using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.Models
{
    public class ApplicationUser : IdentityUser
    {
        [Required, MaxLength(100)]
        public string FirstName { get; set; }

        [Required, MaxLength(100)]
        public string LastName { get; set; }

        // Change from byte[] to string to store URL/path
        [MaxLength(500)]
        public string ProfilePictureUrl { get; set; }

        /// <summary>
        /// Profile COVER image URL. Server-side so the web portal and the CAM ID
        /// mobile app show the same cover — before this column the web kept the
        /// cover in one browser's localStorage, which no other device could see.
        /// Null means "use the client's default cover".
        /// </summary>
        [MaxLength(500)]
        public string CoverUrl { get; set; }

        public ApplicationUser()
        {
            Messages = new HashSet<Message>();
        }

        public virtual ICollection<Message> Messages { get; set; }
    }
}