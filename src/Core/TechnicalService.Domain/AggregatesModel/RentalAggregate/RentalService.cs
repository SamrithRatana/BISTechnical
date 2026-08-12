namespace TechnicalService.Domain.AggregatesModel.RentalAggregate;

public class RentalService : Entity, IAggregateRoot
{
    public Guid RentalItemId { get; private set; }

    public RentalItem RentalItem { get; }

    public DateTime Date { get; private set; }

    public ActionType Action { get; private set; }

    public string Note { get; private set; }

    public Guid UserId { get; private set; }

    private List<RentalSparepart> _spareparts;

    public IReadOnlyList<RentalSparepart> Spareparts => _spareparts.AsReadOnly();

    protected RentalService()
    {
        _spareparts = new List<RentalSparepart>();
    }

    public RentalService(Guid rentalItemId, DateTime date, string note, ActionType action, Guid userId) : this()
    {   
        RentalItemId = rentalItemId;
        Date = date;
        Action = action;
        Note = note;
        UserId = userId;
    }

    public void AddSparepart(Guid sparepartId, string description, int quantity, SparepartCondition condition)
    {
        // add validate new sparepart item
        var sparepart = new RentalSparepart(sparepartId, description, quantity, condition);
        _spareparts.Add(sparepart);
    }
    // For Update
    public void Update(Guid id)
    {
        Id = id;
    }
}
