using System;
using System.ComponentModel.DataAnnotations;

namespace ServiceMaintenance.Models
{
    public class Issue
    {
        public int IssueID { get; set; }

        [MaxLength(255)]
        public string CustomerId { get; set; }

        [MaxLength(255)]
        public string ItemId { get; set; }

        [MaxLength(100)]
        public string IssueType { get; set; }

        public DateTime Date { get; set; }

        public DateTime SolveDate { get; set; }

        [MaxLength(1000)]
        public string Description { get; set; }

        [MaxLength(50)]
        public string Status { get; set; }
    }
}
