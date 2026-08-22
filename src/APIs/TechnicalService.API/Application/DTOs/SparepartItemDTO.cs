namespace TechnicalService.API.Application.DTOs;

public record SparepartItemDTO
{
    public Guid SparepartId { get; init; }
    public string Description { get; init; }
    public int Quantity { get; init; }
    public string Condition { get; init; }
    public bool IsHoldStatus { get; init; } = false;
    public string Remarks { get; init; }
    public DateTime? RemarksUpdatedAt { get; init; }

}