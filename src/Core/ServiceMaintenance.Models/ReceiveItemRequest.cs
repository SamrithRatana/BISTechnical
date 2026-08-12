using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class ReceiveItemRequest
    {
        public Guid Id { get; set; } = Guid.Empty;
        public Guid CustomerId { get; set; } = Guid.Empty;

        [Required]
        public string CompanyName { get; set; }
        public string Address { get; set; }
        public string ContactName { get; set; }
        public string PhoneNumber { get; set; }
        public bool HasContract { get; set; }
        public DateTime ServiceDate { get; set; } = DateTime.Now;

        public string ReportNo { get; set; }

        [Required(ErrorMessage = "ServiceLocation is required.")]
        public string ServiceLocation { get; set; }
        public int ServicePriorityId { get; set; }

      
        public Guid ItemId { get; set; }
        [Required(ErrorMessage = "CustomerRequest is required.")]
        public string CustomerRequest { get; set; }
        public Guid CreateBy { get; set; }
    }

}
