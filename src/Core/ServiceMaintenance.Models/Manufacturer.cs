using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class Manufacturer
    {
        [Key]
        public int ManufacturerID { get; set; }


        [MaxLength(255)]
        public string Type { get; set; }
        [MaxLength(255)]
        public string Name { get; set; }
        


        [MaxLength(255)]
        public string Logo { get; set; } // Store the file path for the logo image

        public string Description { get; set; }
    }
}
