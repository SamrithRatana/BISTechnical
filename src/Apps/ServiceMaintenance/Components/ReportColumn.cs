using Microsoft.AspNetCore.Components;

namespace ServiceMaintenance.Components;

/// <summary>
/// Describes a single column of a <see cref="ReportGroupedDocument{TItem}"/>.
/// Each page (daily report, monthly report, future reports) builds its own
/// list of these instead of duplicating the table markup.
/// </summary>
/// <typeparam name="TItem">The row model, e.g. RepairServices.</typeparam>
public class ReportColumn<TItem>
{
    /// <summary>Header text, e.g. "Date", "Report #".</summary>
    public string Header { get; set; } = string.Empty;

    /// <summary>CSS width, e.g. "12%".</summary>
    public string? Width { get; set; }

    /// <summary>Text alignment for header + cells: "left" | "right" | "center".</summary>
    public string Align { get; set; } = "left";

    /// <summary>
    /// Main cell content for a row. Return a RenderFragment so columns can
    /// contain more than plain text (buttons, badges, etc.) when needed.
    /// </summary>
    public required RenderFragment<TItem> CellTemplate { get; set; }

    /// <summary>
    /// Optional smaller subtext rendered under the main cell content
    /// (used e.g. for "Item Name" + company name underneath, like the
    /// existing monthly report layout).
    /// </summary>
    public RenderFragment<TItem>? SubTextTemplate { get; set; }

    // ── Convenience factory for the common case: a plain string getter ──
    public static ReportColumn<TItem> Text(
        string header,
        Func<TItem, string?> valueSelector,
        string? width = null,
        string align = "left",
        Func<TItem, string?>? subTextSelector = null)
    {
        return new ReportColumn<TItem>
        {
            Header = header,
            Width = width,
            Align = align,
            CellTemplate = item => builder =>
            {
                builder.AddContent(0, valueSelector(item));
            },
            SubTextTemplate = subTextSelector is null
                ? null
                : item => builder =>
                {
                    var text = subTextSelector(item);
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        builder.OpenElement(0, "div");
                        builder.AddAttribute(1, "class", "report-item-subtext");
                        builder.AddContent(2, text);
                        builder.CloseElement();
                    }
                }
        };
    }
}
