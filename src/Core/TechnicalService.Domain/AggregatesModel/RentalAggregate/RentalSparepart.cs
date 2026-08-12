using System.ComponentModel.DataAnnotations;

namespace TechnicalService.Domain.AggregatesModel.RentalAggregate;

public class RentalSparepart
    : Entity
{
    [Required]
    public Guid SparepartId { get; private set; }

    public string Description { get; private set; }

    public int Quantity { get; private set; }

    public SparepartCondition Condition { get; private set; }

    protected RentalSparepart() { }

    public RentalSparepart(Guid sparepartId, string description, int quantity = 1, SparepartCondition condition = default)
    {
        if (quantity <= 0)
        {
            throw new TechnicalServiceDomainException("Invalid number of quantity");
        }

        SparepartId = sparepartId;
        Description = description;
        Quantity = quantity;
        Condition = condition;
    }

    // For Update
    public void Update(Guid id)
    {
        Id = id;
    }
}
