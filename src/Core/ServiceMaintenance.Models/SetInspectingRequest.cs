namespace ServiceMaintenance.Models
{
    public class SetInspectingRequest
    {
        public Guid Id { get; set; }
        public Guid InspectingBy { get; set; }
    }
}