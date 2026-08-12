namespace UserManagementAPI.Models.Leave
{
    public class LeaveType
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public decimal? HoursPerMonth { get; set; }   // null = on-time
        public decimal? TotalHoursYear { get; set; }   // null = on-time
        public bool IsOnTime { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }

        public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
        public ICollection<LeaveBalance> LeaveBalances { get; set; } = new List<LeaveBalance>();
    }
}
