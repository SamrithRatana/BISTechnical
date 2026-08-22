using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace TechnicalService.API.Extensions;

/// <summary>
/// Turns a rejected request value into a 400 instead of a 500.
/// </summary>
/// <remarks>
/// Counterpart to <c>NotFoundExceptionHandler</c>. The command handlers parse
/// enums out of the request body (<c>Condition</c>, <c>ServiceLocation</c>,
/// rental <c>Action</c>); before this, an unrecognised value threw out of the
/// handler and the caller got a server error for what is a client mistake -
/// and Sentry got an issue for it.
///
/// The message is safe to return: it is produced by
/// <see cref="EnumParsing"/> from the field name and the enum's own member
/// names, never from an exception the framework or the database raised.
/// </remarks>
internal sealed class ValidationExceptionHandler(IProblemDetailsService problemDetailsService)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not RequestValidationException validationException)
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
                Detail = validationException.Message,
            },
        });
    }
}
