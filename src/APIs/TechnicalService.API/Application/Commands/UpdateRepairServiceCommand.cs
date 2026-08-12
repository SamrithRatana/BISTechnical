using MediatR;
using TechnicalService.API.Application.DTOs; // ✅ use shared DTO instead of static import

namespace TechnicalService.API.Application.Commands;

public record UpdateRepairServiceCommand(
    Guid Id,
    Guid CustomerId,
    string CompanyName,
    string Address,
    string ContactName,
    string PhoneNumber,
    Guid? ItemId,
    string ReportNo,
    DateTime ServiceDate,
    string CustomerRequest,
    string Inspection,
    string Solution,
    string ServiceLocation,
    int ServiceTypeId,
    int ServicePriorityId,
    int StatusId,
    bool HasContract,
    IEnumerable<SparepartItemDTO> SparepartItems  // ✅ now comes from shared DTO
) : IRequest<bool>;