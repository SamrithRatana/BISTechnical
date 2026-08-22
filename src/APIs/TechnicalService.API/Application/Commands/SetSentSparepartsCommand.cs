namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetSentSparepartsCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; private set; }
    [DataMember]
    public DateTime SentSparepartsDate { get; private set; }
    [DataMember]
    public Guid SetSentSparepartsBy { get; private set; }

    public SetSentSparepartsCommand(Guid id, DateTime sentSparepartsDate, Guid setSentSparepartsBy)    {
        Id = id;
        SentSparepartsDate = sentSparepartsDate;
        SetSentSparepartsBy = setSentSparepartsBy;
    }
}