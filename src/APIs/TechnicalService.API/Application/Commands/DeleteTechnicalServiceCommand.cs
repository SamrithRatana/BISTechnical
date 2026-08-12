using MediatR;

namespace TechnicalService.API.Application.Commands;

public record DeleteTechnicalServiceCommand(Guid ServiceId) : IRequest<bool>;
