    using Microsoft.AspNetCore.Identity;
    using System.ComponentModel.DataAnnotations;

    namespace ServiceMaintenance.Models
    {
        public class ApplicationUser : IdentityUser
        {

        [Required,MaxLength(100)]
            public string FirstName { get; set; }
            [Required, MaxLength(100)]
            public string LastName { get; set; }
            public byte[] ProfilePicture { get; set; }

            
            public ApplicationUser()
            {
                Messages = new HashSet<Message>();
            }
            public virtual ICollection<Message> Messages { get; set; }
        }
    }
