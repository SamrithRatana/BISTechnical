namespace UserManagementAPI.Models.Leave
{
    public class LeaveBalance
    {
        public int Id { get; set; }
        public string UserId { get; set; } = "";
        public int LeaveTypeId { get; set; }
        public int Year { get; set; }
        public decimal TotalHours { get; set; }
        public decimal UsedHours { get; set; }

        // Computed — not stored in DB
        public decimal RemainingHours => TotalHours - UsedHours;

        // Navigation
        public LeaveType? LeaveType { get; set; }

        // ✅ ADD — computed from navigation property
        public string LeaveTypeName => LeaveType?.Name ?? "";
    }
}
