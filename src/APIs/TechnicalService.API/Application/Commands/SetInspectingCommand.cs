using System.Runtime.Serialization;
using MediatR;

namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetInspectingCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; private set; }

    [DataMember]
    public Guid InspectingBy { get; private set; }

    [DataMember]
    public DateTime InspectingDate { get; private set; }

    public SetInspectingCommand(Guid id, Guid inspectingBy, DateTime inspectingDate)
    {
        Id = id;
        InspectingBy = inspectingBy;
        InspectingDate = inspectingDate;
    }
}