namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetAwaitingCustomerConfirmCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid SetAwaitingCustomerConfirmBy { get; private set; }

    [DataMember]
    public DateTime AwaitingCustomerConfirmDate { get; private set; }

    public SetAwaitingCustomerConfirmCommand(Guid id, Guid setAwaitingCustomerConfirmBy,
        DateTime awaitingCustomerConfirmDate)
    {
        Id = id;
        SetAwaitingCustomerConfirmBy = setAwaitingCustomerConfirmBy;
        AwaitingCustomerConfirmDate = awaitingCustomerConfirmDate;
    }
}
