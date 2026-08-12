using System;
using System.Collections.Generic;
using System.Linq;

namespace UserManagementAPI.Contants
{
    public static class Permissions
    {
        // List of modules that only have Access permission
        private static readonly HashSet<string> AccessOnlyModules = new HashSet<string>
        {
            "DailyReportPage",
            "MonthlyReportPage",
            "CustomerReportPage",
            "HistoryRepairReport",
            "TechnicalServiceList",
            "EngineerReportList",
            "SummaryReportPage",
               

        };

        public static List<string> GeneratePermissionsList(string module)
        {
            // Check if this module only has Access permission
            if (AccessOnlyModules.Contains(module))
            {
                return new List<string>()
                {
                    $"Permissions.{module}.Access"
                };
            }

            // Return full permission list for regular modules
            return new List<string>()
            {
                $"Permissions.{module}.Access",  // Module-level permission
                $"Permissions.{module}.View",
                $"Permissions.{module}.Create",
                $"Permissions.{module}.Edit",
                $"Permissions.{module}.Delete",
                $"Permissions.{module}.Print",
                $"Permissions.{module}.Export"
            };
        }

        public static List<string> GenerateAllPermissions()
        {
            var allPermissions = new List<string>();
            var modules = Enum.GetValues(typeof(Modules));  // ← ERROR: Modules enum doesn't exist!

            foreach (var module in modules)
                allPermissions.AddRange(GeneratePermissionsList(module.ToString()));

            return allPermissions;
        }

        // Helper method to check if a module is access-only
        public static bool IsAccessOnlyModule(string moduleName)
        {
            return AccessOnlyModules.Contains(moduleName);
        }

        // Helper method to get available permission types for a module
        public static List<string> GetAvailablePermissionTypes(string moduleName)
        {
            if (IsAccessOnlyModule(moduleName))
            {
                return new List<string> { "Access" };
            }

            return new List<string> { "Access", "View", "Create", "Edit", "Delete", "Print", "Export" };
        }

        public static class ItemModelList
        {
            public const string Access = "Permissions.ItemModelList.Access";
            public const string View = "Permissions.ItemModelList.View";
            public const string Create = "Permissions.ItemModelList.Create";
            public const string Edit = "Permissions.ItemModelList.Edit";
            public const string Delete = "Permissions.ItemModelList.Delete";
            public const string Print = "Permissions.ItemModelList.Print";
            public const string Export = "Permissions.ItemModelList.Export";
        }

        public static class SparePartList
        {
            public const string Access = "Permissions.SparePartList.Access";
            public const string View = "Permissions.SparePartList.View";
            public const string Create = "Permissions.SparePartList.Create";
            public const string Edit = "Permissions.SparePartList.Edit";
            public const string Delete = "Permissions.SparePartList.Delete";
            public const string Print = "Permissions.SparePartList.Print";
            public const string Export = "Permissions.SparePartList.Export";
        }

        public static class ReceiveItemList
        {
            public const string Access = "Permissions.ReceiveItemList.Access";
            public const string View = "Permissions.ReceiveItemList.View";
            public const string Create = "Permissions.ReceiveItemList.Create";
            public const string Edit = "Permissions.ReceiveItemList.Edit";
            public const string Delete = "Permissions.ReceiveItemList.Delete";
            public const string Print = "Permissions.ReceiveItemList.Print";
            public const string Export = "Permissions.ReceiveItemList.Export";
        }

        public static class InspectItemList
        {
            public const string Access = "Permissions.InspectItemList.Access";
            public const string View = "Permissions.InspectItemList.View";
            public const string Create = "Permissions.InspectItemList.Create";
            public const string Edit = "Permissions.InspectItemList.Edit";
            public const string Delete = "Permissions.InspectItemList.Delete";
            public const string Print = "Permissions.InspectItemList.Print";
            public const string Export = "Permissions.InspectItemList.Export";
        }

        public static class AwaitCustomerList
        {
            public const string Access = "Permissions.AwaitCustomerList.Access";
            public const string View = "Permissions.AwaitCustomerList.View";
            public const string Create = "Permissions.AwaitCustomerList.Create";
            public const string Edit = "Permissions.AwaitCustomerList.Edit";
            public const string Delete = "Permissions.AwaitCustomerList.Delete";
            public const string Print = "Permissions.AwaitCustomerList.Print";
            public const string Export = "Permissions.AwaitCustomerList.Export";
        }

        public static class AwaitSparePartList
        {
            public const string Access = "Permissions.AwaitSparePartList.Access";
            public const string View = "Permissions.AwaitSparePartList.View";
            public const string Create = "Permissions.AwaitSparePartList.Create";
            public const string Edit = "Permissions.AwaitSparePartList.Edit";
            public const string Delete = "Permissions.AwaitSparePartList.Delete";
            public const string Print = "Permissions.AwaitSparePartList.Print";
            public const string Export = "Permissions.AwaitSparePartList.Export";
        }
        public static class SaleConfirmedList
        {
            public const string Access = "Permissions.SaleConfirmedList.Access";
            public const string View = "Permissions.SaleConfirmedList.View";
            public const string Create = "Permissions.SaleConfirmedList.Create";
            public const string Edit = "Permissions.SaleConfirmedList.Edit";
            public const string Delete = "Permissions.SaleConfirmedList.Delete";
            public const string Print = "Permissions.SaleConfirmedList.Print";
            public const string Export = "Permissions.SaleConfirmedList.Export";
        }
        public static class ThirdPartyList
        {
            public const string Access = "Permissions.ThirdPartyList.Access";
            public const string View = "Permissions.ThirdPartyList.View";
            public const string Create = "Permissions.ThirdPartyList.Create";
            public const string Edit = "Permissions.ThirdPartyList.Edit";
            public const string Delete = "Permissions.ThirdPartyList.Delete";
            public const string Print = "Permissions.ThirdPartyList.Print";
            public const string Export = "Permissions.ThirdPartyList.Export";
        }

        public static class CustomerReject
        {
            public const string Access = "Permissions.CustomerReject.Access";
            public const string View = "Permissions.CustomerReject.View";
            public const string Create = "Permissions.CustomerReject.Create";
            public const string Edit = "Permissions.CustomerReject.Edit";
            public const string Delete = "Permissions.CustomerReject.Delete";
            public const string Print = "Permissions.CustomerReject.Print";
            public const string Export = "Permissions.CustomerReject.Export";
        }

        public static class Unrepair
        {
            public const string Access = "Permissions.UnrepairList.Access";
            public const string View = "Permissions.UnrepairList.View";
            public const string Create = "Permissions.UnrepairList.Create";
            public const string Edit = "Permissions.UnrepairList.Edit";
            public const string Delete = "Permissions.UnrepairList.Delete";
            public const string Print = "Permissions.UnrepairList.Print";
            public const string Export = "Permissions.UnrepairList.Export";
        }

        public static class RepairItemList
        {
            public const string Access = "Permissions.RepairItemList.Access";
            public const string View = "Permissions.RepairItemList.View";
            public const string Create = "Permissions.RepairItemList.Create";
            public const string Edit = "Permissions.RepairItemList.Edit";
            public const string Delete = "Permissions.RepairItemList.Delete";
            public const string Print = "Permissions.RepairItemList.Print";
            public const string Export = "Permissions.RepairItemList.Export";
        }

        public static class FinishItem
        {
            public const string Access = "Permissions.FinishItem.Access";
            public const string View = "Permissions.FinishItem.View";
            public const string Create = "Permissions.FinishItem.Create";
            public const string Edit = "Permissions.FinishItem.Edit";
            public const string Delete = "Permissions.FinishItem.Delete";
            public const string Print = "Permissions.FinishItem.Print";
            public const string Export = "Permissions.FinishItem.Export";
        }
        public static class InspectionList
        {
            public const string Access = "Permissions.InspectionList.Access";
            public const string View = "Permissions.InspectionList.View";
            public const string Create = "Permissions.InspectionList.Create";
            public const string Edit = "Permissions.InspectionList.Edit";
            public const string Delete = "Permissions.InspectionList.Delete";
            public const string Print = "Permissions.InspectionList.Print";
            public const string Export = "Permissions.InspectionList.Export";
        }
        public static class DailyReportPage
        {
            public const string Access = "Permissions.DailyReportPage.Access";
        }

        public static class MonthlyReportPage
        {
            public const string Access = "Permissions.MonthlyReportPage.Access";
        }

        public static class CustomerReportPage
        {
            public const string Access = "Permissions.CustomerReportPage.Access";
        }

        public static class HistoryRepairReport
        {
            public const string Access = "Permissions.HistoryRepairReport.Access";
        }

        public static class TechnicalServiceList
        {
            public const string Access = "Permissions.TechnicalServiceList.Access";
        }

        public static class EngineerReportList
        {
            public const string Access = "Permissions.EngineerReportList.Access";
        }

        public static class SummaryReportPage
        {
            public const string Access = "Permissions.SummaryReportPage.Access";
        }
    }
}