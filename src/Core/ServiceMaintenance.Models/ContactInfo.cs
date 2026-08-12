using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ServiceMaintenance.Models
{
    public class ContactInfo
    {
        public Guid Id { get; set; }
        public string EngineerName { get; set; }
        public string Tel { get; set; }
/*        public string DisplayName => $"{EngineerName} - {Tel}"; // Example: "John Doe - 123-456-7890"
*/
    }

}
