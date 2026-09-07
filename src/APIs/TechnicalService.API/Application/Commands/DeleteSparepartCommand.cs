namespace TechnicalService.API.Application.Commands;

/// <summary>
/// Deletes a catalogue spare part. Both clients (web and CAM ID) already
/// called <c>DELETE /api/spareparts/{id}</c>; until 2026-09-05 there was no
/// such endpoint and the deletion silently never happened.
/// </summary>
public record DeleteSparepartCommand(Guid SparepartId) : IRequest<bool>;
