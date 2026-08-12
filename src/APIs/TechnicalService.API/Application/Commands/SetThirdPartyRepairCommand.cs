namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetThirdPartyRepairCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid ThirdPartyRepairBy { get; private set; }

    [DataMember]
    public DateTime ThirdPartyRepairDate { get; private set; }

    public SetThirdPartyRepairCommand(Guid id, Guid thirdPartyRepairBy, DateTime thirdPartyRepairDate)
    {
        Id = id;
        ThirdPartyRepairBy = thirdPartyRepairBy;
        ThirdPartyRepairDate = thirdPartyRepairDate;
    }
}
