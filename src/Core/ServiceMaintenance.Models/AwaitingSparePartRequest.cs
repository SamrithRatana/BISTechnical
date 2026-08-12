using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class AwaitingSparePartRequest
    {
        public Guid Id { get; set; } 
        public Guid SetAwaitingSparepartBy { get; set; } 
    }
}
