namespace UserManagementAPI.Models.Leave
{
    public class LeaveRequest
    {
        public int Id { get; set; }
        public string UserId { get; set; } = "";
        public int LeaveTypeId { get; set; }
        public DateOnly FromDate { get; set; }
        public DateOnly ToDate { get; set; }
        public decimal TotalHours { get; set; }   // working days x 8
        public string? Reason { get; set; }
        public string Status { get; set; } = "Pending";
        // Pending | ApprovedByM1 | Approved | Rejected
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public LeaveType? LeaveType { get; set; }
        public ICollection<LeaveApproval> Approvals { get; set; } = new List<LeaveApproval>();
    }
}
