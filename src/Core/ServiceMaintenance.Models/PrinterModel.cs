using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class PrinterModel
    {
        [Key]
        public int PrinterModelID { get; set; }

        [MaxLength(100)]
        public string ModelName { get; set; }

        [MaxLength(255)]
        public string Photo { get; set; }
        public string Description { get; set; }
    }
}
