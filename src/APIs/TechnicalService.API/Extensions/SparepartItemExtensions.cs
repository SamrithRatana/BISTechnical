using TechnicalService.API.Application.Commands;
using TechnicalService.API.Application.DTOs;  // ✅ shared DTO
using TechnicalService.API.Application.Queries;
namespace TechnicalService.API.Extensions;
public static class SparepartItemExtensions
{
    public static IEnumerable<SparepartItemDTO> ToSparepartItemsDTO(this IEnumerable<SparepartItem> sparepartItems)
    {
        foreach (var item in sparepartItems)
        {
            yield return item.ToSparepartItemDTO();
        }
    }
    public static SparepartItemDTO ToSparepartItemDTO(this SparepartItem item)
    {
        return new SparepartItemDTO()
        {
            SparepartId = item.SparepartId,
            Description = item.Description,
            Quantity = item.Quantity,
            Condition = item.Condition,
            IsHoldStatus = item.IsHoldStatus,
            Remarks = item.Remarks, // ✅ NEW
            RemarksUpdatedAt = item.RemarksUpdatedAt // ✅ NEW
        };
    }
}