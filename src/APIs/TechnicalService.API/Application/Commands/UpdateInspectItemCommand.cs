using System.Runtime.Serialization;
using MediatR;
using TechnicalService.API.Application.DTOs;  // ✅ use shared DTO

namespace TechnicalService.API.Application.Commands;

[DataContract]
public class UpdateInspectItemCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid InspectBy { get; set; }

    [DataMember]
    public string Inspection { get; set; }

    [DataMember]
    public string Solution { get; set; }

    [DataMember]
    public int ServiceTypeId { get; set; }

    [DataMember]
    public List<SparepartItemDTO> Spareparts { get; set; }

    public UpdateInspectItemCommand()
    {
        Spareparts = new List<SparepartItemDTO>();
    }

    // ✅ REMOVED nested SparepartItemDTO record
}