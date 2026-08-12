using MediatR;

namespace TechnicalService.API.Application.Commands;

public record DeleteReceiveItemCommand(Guid ServiceId) : IRequest<bool>;