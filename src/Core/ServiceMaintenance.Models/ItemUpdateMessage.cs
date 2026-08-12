namespace ServiceMaintenance.Models
{
    public class ItemUpdateMessage
    {
        // statuses ដែលពិតជាត្រូវបានប៉ះពាល់ដោយប្រតិបត្តិការនេះ
        // (ឧ. status ដើម + status ថ្មី)
        public string[] AffectedStatuses { get; set; } = Array.Empty<string>();
    }
}