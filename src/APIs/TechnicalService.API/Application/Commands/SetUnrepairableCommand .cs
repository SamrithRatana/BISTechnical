namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetUnrepairableCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid SetUnrepairableBy { get; private set; }

    [DataMember]
    public DateTime UnreparableDate { get; private set; }

    public SetUnrepairableCommand(Guid id, Guid setUnrepairableBy, DateTime unrepairableDate)
    {
        Id = id;
        SetUnrepairableBy = setUnrepairableBy;
        UnreparableDate = unrepairableDate;
    }
}
