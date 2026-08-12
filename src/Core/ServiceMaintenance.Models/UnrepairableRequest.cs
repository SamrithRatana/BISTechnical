namespace ServiceMaintenance.Models
{
    public class UnrepairableRequest
    {
        public Guid Id { get; set; }
        public Guid SetUnrepairableBy { get; set; }
    }
}
