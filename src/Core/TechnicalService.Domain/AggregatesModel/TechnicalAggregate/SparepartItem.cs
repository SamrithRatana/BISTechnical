using System.ComponentModel.DataAnnotations;
namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
public class SparepartItem : Entity
{
    [Required]
    public Guid SparepartId { get; private set; }
    // ✅ ADD: promote shadow property to a real mapped property
    public Guid ServiceId { get; private set; }
    public string Description { get; private set; }
    public int Quantity { get; private set; }
    public SparepartCondition Condition { get; private set; }
    public bool IsHoldStatus { get; private set; } = false;
    public string Remarks { get; private set; } // ✅ NEW
    public DateTime? RemarksUpdatedAt { get; private set; } // ✅ NEW — set whenever Remarks changes

    protected SparepartItem() { }
    public SparepartItem(
        Guid sparepartId,
        string description,
        int quantity = 1,
        SparepartCondition condition = default,
        bool isHoldStatus = false,
        string remarks = null)
    {
        if (quantity < 0)
            throw new TechnicalServiceDomainException(
                "Invalid number of quantity: Cannot be negative");
        SparepartId = sparepartId;
        Description = description;
        Quantity = quantity;
        Condition = condition;
        IsHoldStatus = isHoldStatus;
        Remarks = remarks;
        RemarksUpdatedAt = remarks != null ? DateTime.UtcNow.AddHours(7) : null; // ✅ Cambodia time, matches the rest of the codebase
    }
    public void Update(Guid id)
    {
        Id = id;
    }
    public void UpdateDetails(
        string description,
        int quantity,
        SparepartCondition condition,
        bool isHoldStatus = false)
    {
        if (quantity < 0)
            throw new TechnicalServiceDomainException(
                "Invalid number of quantity: Cannot be negative");
        Description = description;
        Quantity = quantity;
        Condition = condition;
        IsHoldStatus = isHoldStatus;
    }
    public void UpdateRemarks(string remarks)
    {
        Remarks = remarks;
        RemarksUpdatedAt = DateTime.UtcNow.AddHours(7); // ✅ Cambodia time (UTC+7), same convention as SetInspectingAsync etc.
    }
}