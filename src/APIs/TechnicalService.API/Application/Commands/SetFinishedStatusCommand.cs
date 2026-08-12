namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetFinishedStatusCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; private set; }

    [DataMember]
    public DateTime FinishedDate { get; private set; }

    [DataMember]
    public Guid VerifiedBy { get; private set; }

    public SetFinishedStatusCommand(Guid id, DateTime finishedDate, Guid verifiedBy)
    {
        Id = id;
        FinishedDate = finishedDate;
        VerifiedBy = verifiedBy;
    }
}
