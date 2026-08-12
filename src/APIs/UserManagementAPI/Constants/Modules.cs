namespace UserManagementAPI.Contants  // Same namespace as Permissions
{
    /// <summary>
    /// Enum defining all modules in the system
    /// Used by Permissions.GenerateAllPermissions()
    /// </summary>
    public enum Modules
    {
        ItemModelList,
        SparePartList,
        ReceiveItemList,
        InspectItemList,
        InspectionList,
        AwaitCustomerList,
        AwaitSparePartList,
        ThirdPartyList,
        CustomerReject,
        UnrepairList,
        RepairItemList,
        FinishItem,
        DailyReportPage,
        MonthlyReportPage,
        CustomerReportPage,
        HistoryRepairReport,
        TechnicalServiceList,
        EngineerReportList,
        SaleConfirmedList,
        SummaryReportPage,
    }
}