using Microsoft.Extensions.Localization;
using ServiceMaintenance;
using ServiceMaintenance.Models;

namespace ServiceMaintenance.Services.AsyncServices
{
    public class MenuService
    {
        private readonly IStringLocalizer<App> _loc;

        public MenuService(IStringLocalizer<App> loc)
        {
            _loc = loc;
        }

        public List<MenuSection> GetMenuSections(IEnumerable<string> userRoles)
        {
            var roles = userRoles.ToList();

            // Empty AllowedRoles list means "visible to everyone" (see Allowed() below)
            bool Allowed(List<string> allowedRoles) =>
                allowedRoles.Count == 0 || roles.Intersect(allowedRoles).Any();

            var sections = new List<MenuSection>
            {
                new MenuSection
                {
                    Title = null,
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextHome)], NavigateUrl = "/", IconCssClass = "fas fa-home", AllowedRoles = new() { "Admin", "User", "Sales", "SuperAdmin", "Engineer", "Stock" } }
                    }
                },

                new MenuSection
                {
                    Title = "Inventory Items",
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextReceiveItemsInventory)],   NavigateUrl = "/itemModel",                IconCssClass = "fas fa-archive", AllowedRoles = new() { "Admin", "User", "Sales", "SuperAdmin", "Engineer", "Stock","Manager" } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextSparePartItemsInventory)], NavigateUrl = "/SparePart Inventory Page", IconCssClass = "fas fa-cogs",    AllowedRoles = new() { "Admin", "User", "Sales", "SuperAdmin", "Engineer", "Stock","Manager" } }
                    }
                },
                new MenuSection
                {
                Title = "Customer Information",
                Items = new List<MenuItem>
                {
                    new MenuItem { Text = "Customer Center", NavigateUrl = "/customer-center", IconCssClass = "fas fa-address-book", AllowedRoles = new() { "Admin", "User", "Sales", "SuperAdmin", "Engineer", "Manager" } }
                }
             },
                new MenuSection
                {
                    Title = "Technical",
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextReceivedItems)],    NavigateUrl = "/receive-item",    IconCssClass = "fas fa-inbox",           AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Engineer", "Manager" } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextInspectItem)],      NavigateUrl = "/inspect-item",    IconCssClass = "fas fa-search",          AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Engineer", "Manager" } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextInspection)],       NavigateUrl = "/inspection-list", IconCssClass = "fas fa-clipboard-check", AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Engineer", "Manager" } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextApproveRepairing)], NavigateUrl = "/reapairItem",     IconCssClass = "fas fa-wrench",          AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Engineer", "Manager" } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextApproveVerify)],    NavigateUrl = "/finishItem",      IconCssClass = "fas fa-check-square",    AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Engineer", "Manager" } }
                    }
                },

                new MenuSection
                {
                    Title = "Stock",
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TechnicalRequestSpare)], NavigateUrl = "/await-sparepart", IconCssClass = "fas fa-shipping-fast", AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Stock" } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextSaleConfirm)],       NavigateUrl = "/sale-confirmed",  IconCssClass = "fas fa-check-circle",  AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Stock", } }
                    }
                },

                new MenuSection
                {
                    Title = "Sale",
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextSetWaitCustomer)], NavigateUrl = "/await-customer", IconCssClass = "fas fa-user-clock", AllowedRoles = new() { "Admin", "User", "Sales", "SuperAdmin" } }
                    }
                },

                new MenuSection
                {
                    Title = "Rejected Service Tracker",
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextCusrej)],       NavigateUrl = "/customer-reject", IconCssClass = "fas fa-ban", AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Engineer", "Sales", "Manager" } },
                        // Unrepairable is now visible to ALL users, regardless of role
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextUnrepairable)], NavigateUrl = "/unrepairable",    IconCssClass = "fas fa-ban",  AllowedRoles = new() { "Admin", "User", "SuperAdmin", "Engineer", "Sales", "Manager" } }
                    }
                },

                new MenuSection
                {
                    // Reports section is visible to ALL users, regardless of role
                    Title = "Reports",
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextDailyandCheck)],  NavigateUrl = "daily-report",     IconCssClass = "fas fa-calendar-day", AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextMonthlyReport)],  NavigateUrl = "monthly-report",   IconCssClass = "fas fa-chart-line",   AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextCustomerReport)], NavigateUrl = "customer-report",  IconCssClass = "fas fa-users",        AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextRepairHistory)],  NavigateUrl = "history-report",   IconCssClass = "fas fa-history",      AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextServiceReport)],  NavigateUrl = "/repairservices",  IconCssClass = "fas fa-toolbox",      AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextEngineerReport)], NavigateUrl = "/engineer-report", IconCssClass = "fas fa-user-tie",     AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextSummaryReport)],  NavigateUrl = "/repair-report",   IconCssClass = "fas fa-chart-bar",    AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.Textusagesparepart)], NavigateUrl = "/sparepart-usage", IconCssClass = "fas fa-wrench",       AllowedRoles = new() { } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.Testholdsparepart)],  NavigateUrl = "/sparepart-hold",  IconCssClass = "fas fa-hand-paper",   AllowedRoles = new() { } }
                    }
                },

                new MenuSection
                {
                    Title = "System Settings",
                    Items = new List<MenuItem>
                    {
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextUserAssign)],     NavigateUrl = "users",              IconCssClass = "fas fa-user-tag",    AllowedRoles = new() { "SuperAdmin" } },
                        new MenuItem { Text = _loc[nameof(ResourceStrings.TextRolePermission)], NavigateUrl = "manage-permissions", IconCssClass = "fas fa-user-shield", AllowedRoles = new() { "SuperAdmin" } },
                        new MenuItem { Text = "Activity Log", NavigateUrl = "/activity-log", IconCssClass = "fas fa-history", AllowedRoles = new() { "Admin", "User", "Sales", "SuperAdmin", "Engineer", "Stock", "Manager" } },
                        new MenuItem { Text = "Theme Settings", NavigateUrl = "/admin/theme-settings", IconCssClass = "fas fa-palette", AllowedRoles = new() { "Admin", "User", "Sales", "SuperAdmin", "Engineer", "Stock", "Manager" } }
                    }
                }
            };

            foreach (var section in sections)
            {
                section.Items = section.Items.Where(i => Allowed(i.AllowedRoles)).ToList();
            }

            return sections.Where(s => s.Items.Count > 0).ToList();
        }
    }
}