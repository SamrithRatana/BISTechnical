namespace ServiceMaintenance.Components;

/// <summary>
/// One named group of rows in a <see cref="ReportGroupedDocument{TItem}"/>,
/// e.g. a Customer Type bucket in the monthly report, or (for daily report)
/// a Service Location / Status bucket — whatever the page groups by.
/// </summary>
/// <typeparam name="TItem">The row model, e.g. RepairServices.</typeparam>
public class ReportGroup<TItem>
{
    public string GroupName { get; set; } = "Unknown";
    public List<TItem> Items { get; set; } = new();
}

/// <summary>
/// One label/value pair shown in the grand-total breakdown line at the
/// bottom of the document (e.g. "Fixed: 81", "Customer Rejected: 3").
/// Pages supply whatever breakdown makes sense for their data.
/// </summary>
public class ReportSummaryStat
{
    public string Label { get; set; } = string.Empty;
    public int Value { get; set; }
}
