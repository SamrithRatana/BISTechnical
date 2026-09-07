using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TechnicalService.Domain.Exceptions;

namespace TechnicalService.API.Extensions;

/// <summary>
/// Turns a rejected request value into a 400 instead of a 500.
/// </summary>
/// <remarks>
/// Counterpart to <c>NotFoundExceptionHandler</c>. The command handlers parse
/// enums out of the request body (<c>Condition</c>, <c>ServiceLocation</c>,
/// rental <c>Action</c>); before this, an unrecognised value threw out of the
/// handler and the caller got a server error for what is a client mistake.
///
/// <see cref="TechnicalServiceDomainException"/> is mapped the same way: it is
/// what an aggregate throws when a value breaks one of its own rules (an empty
/// name, a negative quantity, a type without a category) — a client mistake
/// by definition, and its message is composed by our domain code.
///
/// Both messages are safe to return: they are produced from field names and
/// our own rule text, never from an exception the framework or the database
/// raised.
/// </remarks>
internal sealed class ValidationExceptionHandler(IProblemDetailsService problemDetailsService)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not (RequestValidationException or TechnicalServiceDomainException))
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Bad Request",
                Detail = exception.Message,
            },
        });
    }
}
