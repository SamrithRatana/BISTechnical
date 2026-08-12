using TechnicalService.API.Application.Queries;

namespace TechnicalService.API.Application.Commands;

[DataContract]
public class CreateRentalServiceCommand : IRequest<bool>
{
    private readonly List<SparepartItem> _spareparts;

    [DataMember]
    public Guid RentalItemId { get; private set; }

    [DataMember]
    public DateTime Date { get; private set; }

    [DataMember]
    public string Action { get; private set; }

    [DataMember]
    public string Note { get; private set; }

    [DataMember]
    public Guid UserId { get; private set; }

    [DataMember]
    public IEnumerable<SparepartItem> Spareparts => _spareparts;

    public CreateRentalServiceCommand(Guid rentalItemId, DateTime date, string action, string note,
        Guid userId, List<SparepartItem> spareparts)
    {
        RentalItemId = rentalItemId;
        Date = date;
        Action = action;
        Note = note;
        UserId = userId;
        _spareparts = spareparts;
    }
}
