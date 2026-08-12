using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class RentalItem
    {
        public Guid Id { get; set; } 
        public Guid CreatedBy { get; set; }
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; }
        public string ItemName { get; set; } 
        public string SerialNumber { get; set; }
        public string Condition { get; set; }
        public string Location { get; set; }
        public int Duration { get; set; } = 0;
    }
}
