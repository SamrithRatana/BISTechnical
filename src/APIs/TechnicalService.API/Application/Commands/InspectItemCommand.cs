using System.Runtime.Serialization;
using MediatR;
using TechnicalService.API.Application.DTOs;  // ✅ use shared DTO
using TechnicalService.API.Application.Queries;
using TechnicalService.API.Extensions;

namespace TechnicalService.API.Application.Commands;

[DataContract]
public class InspectItemCommand : IRequest<bool>
{
    [DataMember]
    private readonly List<SparepartItemDTO> _sparepartItems;

    [DataMember]
    public Guid Id { get; set; }

    [DataMember]
    public Guid InspectBy { get; private set; }

    [DataMember]
    public DateTime InspectDate { get; private set; }

    [DataMember]
    public string Inspection { get; private set; }

    [DataMember]
    public string Solution { get; private set; }

    [DataMember]
    public int ServiceTypeId { get; private set; }

    [DataMember]
    public IEnumerable<SparepartItemDTO> SparepartItems => _sparepartItems;

    public InspectItemCommand()
    {
        _sparepartItems = new List<SparepartItemDTO>();
    }

    public InspectItemCommand(Guid id, Guid inspectBy, DateTime inspectDate,
        string inspection, string solution, int serviceTypeId,
        List<SparepartItem> spareparts)
    {
        _sparepartItems = spareparts.ToSparepartItemsDTO().ToList();
        Id = id;
        InspectDate = inspectDate;
        InspectBy = inspectBy;
        Inspection = inspection;
        Solution = solution;
        ServiceTypeId = serviceTypeId;
    }

    // ✅ REMOVED nested SparepartItemDTO record
}