using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class UserRolesViewModel
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public List<CheckBoxViewModel> Roles { get; set; }
    }

    public class RolePermissionsDto
    {
        public string RoleId { get; set; }
        public string RoleName { get; set; }
        public List<PermissionDto> Permissions { get; set; } = new();
    }

    // Permission DTO
    public class PermissionDto
    {
        public string Module { get; set; }
        public string Permission { get; set; }
        public string DisplayName { get; set; }
        public string Icon { get; set; }
        public bool IsAssigned { get; set; }
    }

    // Update Role Permissions Request
    public class UpdateRolePermissionsRequest
    {
        [Required]
        public string RoleId { get; set; }

        [Required]
        public List<string> Permissions { get; set; } = new();
    }

    // Permission Check Request
    public class PermissionCheckRequest
    {
        [Required]
        public string UserId { get; set; }

        [Required]
        public string Permission { get; set; }
    }

    // Permission Check Response
    public class PermissionCheckResponse
    {
        public bool HasPermission { get; set; }
        public string UserId { get; set; }
        public string Permission { get; set; }
    }

    // User Permissions Response
    public class UserPermissionsResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public UserPermissionsData Data { get; set; }
    }

    public class UserPermissionsData
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public List<string> Roles { get; set; } = new();
        public List<PermissionDto> Permissions { get; set; } = new();
    }

    // Module Permissions Response
    public class ModulePermissionsResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public List<ModulePermissionGroup> Data { get; set; }
    }

    public class ModulePermissionGroup
    {
        public string Module { get; set; }
        public List<PermissionDto> Permissions { get; set; } = new();
    }
}