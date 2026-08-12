namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetCustomerRejectedCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid SetCustomerRejectedBy { get; private set; }

    [DataMember]
    public DateTime CustomerRejectedDate { get; private set; }

    public SetCustomerRejectedCommand(Guid id, Guid setCustomerRejectedBy,
        DateTime customerRejectedDate)
    {
        Id = id;
        SetCustomerRejectedBy = setCustomerRejectedBy;
        CustomerRejectedDate = customerRejectedDate;
    }
}
