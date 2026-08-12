namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetRepairCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid RepairBy { get; private set; }

    [DataMember]
    public DateTime RepairDate { get; private set; }

    public SetRepairCommand(Guid id, Guid repairBy, DateTime repairDate)
    {
        Id = id;
        RepairBy = repairBy;
        RepairDate = repairDate;
    }
}
