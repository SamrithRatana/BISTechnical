using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ServiceMaintenance.Models
{
    public class Article
    {
        [Key]
        public int Id { get; set; }

        public string ArticleHeading { get; set; }
        public string ArticleContent { get; set; }
        public string Username { get; set; }
        public string ProfilePicture { get; set; }

        // ✅ Store as UTC in database
        [Column(TypeName = "datetime2")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; } = false;
        public bool IsActionVisible { get; set; } = false;
    }
}