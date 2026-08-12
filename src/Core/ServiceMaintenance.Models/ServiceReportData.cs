using System;
using System.ComponentModel.DataAnnotations;

namespace ServiceMaintenance.Models
{
    public class ServiceReportData
    {
        [Key]
        public int ID { get; set; }

        [Required(ErrorMessage = "Code is required")]
        public string Code { get; set; }

        [Required(ErrorMessage = "ReportID is required")]
        public DateTime ReportID { get; set; }

        [Required(ErrorMessage = "CompanyName is required")]
        public string CompanyName { get; set; }

        [Required(ErrorMessage = "Attention is required")]
        public string Attention { get; set; }

        public string Atten { get; set; }

        [Required(ErrorMessage = "Address is required")]
        public string Address { get; set; }

        [Required(ErrorMessage = "Mobile is required")]
        [Phone(ErrorMessage = "Invalid Mobile phone number")]
        public string Mobile { get; set; }

        [Phone(ErrorMessage = "Invalid OfficeTel phone number")]
        public string OfficeTel { get; set; }

        [Required(ErrorMessage = "ProductName is required")]
        public string ProductName { get; set; }

        [Required(ErrorMessage = "Instrument is required")]
        public string Instrument { get; set; }

        [Required(ErrorMessage = "SerialNumber is required")]
        public string SerialNumber { get; set; }

        public string BranchSerial { get; set; }

        public string CustomerReq { get; set; }

        public string ActionTaken { get; set; }

        public string Solution { get; set; }

        public bool Onsite { get; set; }

        public bool CompanyService { get; set; }

        public bool ServiceContract { get; set; }

        [Required(ErrorMessage = "Datestart is required")]
        public DateTime Datestart { get; set; }

        [Required(ErrorMessage = "DateFinish is required")]
        public DateTime DateFinish { get; set; }

        [Required(ErrorMessage = "Engineer is required")]
        public string Engineer { get; set; }

        [Required(ErrorMessage = "Verify is required")]
        public string Verify { get; set; }

        [Required(ErrorMessage = "Customer is required")]
        public string Customer { get; set; }
    }
}
