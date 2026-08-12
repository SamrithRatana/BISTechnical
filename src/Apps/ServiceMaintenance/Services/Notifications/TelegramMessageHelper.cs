using ServiceMaintenance.Models;

namespace ServiceMaintenance.Services.Notifications;

// ✅ NEW — shared, page-agnostic helper for building the
// "គ្រឿងបន្លាស់ត្រូវការ:" section of Telegram notifications. Every page
// (await-sparepart.razor, inspection-list.razor, await-customer.razor, etc.)
// calls this instead of each declaring its own local copy of the same logic.
public static class TelegramMessageHelper
{
    // Standard version — just name/qty/condition, used when SENDING a new
    // status-change notification (no remarks captured yet at that point).
    // `resolveSparePart` lets each page plug in its own catalog lookup
    // (e.g. GetSparePartById backed by that page's _spareParts list),
    // since each page loads/caches its spare-part catalog differently.
    public static string BuildSparePartsSection(
        IEnumerable<SparePartItem> sparePartItems,
        Func<Guid?, SparePartObject> resolveSparePart)
    {
        if (sparePartItems == null || !sparePartItems.Any())
            return string.Empty;

        var lines = sparePartItems.Select(sp =>
        {
            var resolvedName = resolveSparePart?.Invoke(sp.SparePartId)?.ItemName;
            var displayName = !string.IsNullOrWhiteSpace(resolvedName)
                ? resolvedName
                : "Unknown Item";

            return $"- {displayName} x{sp.Quantity}" +
                   (!string.IsNullOrWhiteSpace(sp.Condition) ? $" ({sp.Condition})" : "");
        });

        return "\n\n<b>គ្រឿងបន្លាស់ត្រូវការ:</b>\n" + string.Join("\n", lines);
    }

    // Remarks version — used when REBUILDING a notification after a remark
    // is saved (e.g. await-sparepart.razor's SaveRemarks), where each line
    // also needs its own Remarks value beneath it.
    public static string BuildSparePartsSectionWithRemarks(
        IEnumerable<(string ItemName, int Quantity, string Condition, string Remarks)> parts)
    {
        if (parts == null || !parts.Any())
            return string.Empty;

        var lines = parts.Select(sp =>
            $"- {sp.ItemName} x{sp.Quantity}" +
            (!string.IsNullOrWhiteSpace(sp.Condition) ? $" ({sp.Condition})" : "") +
            $"\n  Remarks: {(string.IsNullOrWhiteSpace(sp.Remarks) ? "-" : sp.Remarks)}");

        return "\n\n<b>គ្រឿងបន្លាស់ត្រូវការ:</b>\n" + string.Join("\n", lines);
    }
}