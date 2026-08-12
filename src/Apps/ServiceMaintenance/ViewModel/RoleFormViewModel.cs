using System.ComponentModel.DataAnnotations;

namespace ServiceMaintenance.ViewModel
{
    public class RoleFormViewModel
    {
        [Required, StringLength(256)]
        public string Name { get; set; }
    }
}