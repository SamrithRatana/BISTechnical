namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetAwaitingSparepartCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid SetAwaitingSparepartBy { get; private set; }

    [DataMember]
    public DateTime AwaitingSparepartDate { get; private set; }

    public SetAwaitingSparepartCommand(Guid id, Guid setAwaitingCustomerConfirmBy,
        DateTime awaitingCustomerConfirmDate)
    {
        Id = id;
        SetAwaitingSparepartBy = setAwaitingCustomerConfirmBy;
        AwaitingSparepartDate = awaitingCustomerConfirmDate;
    }
}
