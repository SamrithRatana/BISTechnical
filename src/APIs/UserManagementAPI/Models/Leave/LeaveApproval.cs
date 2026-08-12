namespace UserManagementAPI.Models.Leave
{
    public class LeaveApproval
    {
        public int Id { get; set; }
        public int LeaveRequestId { get; set; }
        public string ManagerId { get; set; } = "";
        public int ApprovalStep { get; set; }  // 1 or 2
        public string? Decision { get; set; }  // Approved | Rejected
        public string? Reason { get; set; }
        public DateTime? DecidedAt { get; set; }

        public LeaveRequest? LeaveRequest { get; set; }
    }

}
