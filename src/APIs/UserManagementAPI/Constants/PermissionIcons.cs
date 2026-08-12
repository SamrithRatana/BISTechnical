namespace UserManagementAPI.Contants
{
    public static class PermissionIcons
    {
        public static Dictionary<string, string> Icons = new Dictionary<string, string>
    {
        { "Access", "fas fa-lock" },        
        { "View", "fas fa-eye" },          
        { "Create", "fas fa-plus" },        
        { "Edit", "fas fa-edit" },         
        { "Delete", "fas fa-trash" }       
    };

        public static string GetIcon(string permission)
        {
            var key = permission.Split('.').Last();
            return Icons.ContainsKey(key) ? Icons[key] : "fas fa-question";
        }
    }
}
