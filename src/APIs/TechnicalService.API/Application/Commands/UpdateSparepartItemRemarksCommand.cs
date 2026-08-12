using MediatR;

namespace TechnicalService.API.Application.Commands;

public record UpdateSparepartItemRemarksCommand(
    Guid SparepartItemId,
    string Remarks) : IRequest<bool>;