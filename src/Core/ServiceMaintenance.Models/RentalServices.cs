using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class RentalServices
    {
        public string RentalItemId { get; set; } = string.Empty;
        public DateTime Date { get; set; } = DateTime.Now;
        public string Action { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public List<SparePartOb> SpareParts { get; set; }  = new();

        public RentalServices()
        {
            SpareParts = new List<SparePartOb>();
        }
    }

    public class SparePartOb
    {
        public Guid? SparePartId { get; set; }
        public string Description { get; set; }
        public int Quantity { get; set; }
        public string Condition { get; set; }

        // ✅ ADD THESE FIELDS
        public string ItemName { get; set; }
        public string SerialNumber { get; set; }
        public string UseFor { get; set; }
    }
    public enum ActionType
    {
        PreCheck = 1,
        Install = 2,
        Check = 3,
        Repair = 4,       
    }
    public enum SparePartCondition
    {
        Fix = 1,
        Replace = 2,
       
    }
}