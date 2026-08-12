namespace ServiceMaintenance.Models
{
    public class MenuItem
    {
        public string Text { get; set; }
        public string NavigateUrl { get; set; }
        public string IconCssClass { get; set; }
        public string BadgeText { get; set; }
        public List<string> AllowedRoles { get; set; } = new();
    }

    public class MenuSection
    {
        public string Title { get; set; }              // null = no header (top-level items like Home)
        public List<MenuItem> Items { get; set; } = new();
    }
}