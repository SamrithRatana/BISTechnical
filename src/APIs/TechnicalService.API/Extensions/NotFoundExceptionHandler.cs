using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace TechnicalService.API.Extensions;

/// <summary>
/// Turns "this record does not exist" into a 404 instead of a 500.
///
/// The read methods on <c>TechnicalServiceQueries</c> signal a missing row by
/// throwing <see cref="KeyNotFoundException"/>, while the endpoint handlers are
/// declared as <c>Results&lt;Ok&lt;T&gt;, NotFound&gt;</c> and check for a null
/// return that never comes — so their <c>NotFound()</c> branch was unreachable
/// and asking for a rental item by an id that isn't there produced a 500.
///
/// Handling it here rather than editing each query keeps one rule for the whole
/// API and leaves the queries' existing contract alone. It also matters now
/// that errors are reported: without this, every mistyped id would arrive in
/// Sentry as a server fault and bury the real ones.
/// </summary>
internal sealed class NotFoundExceptionHandler(IProblemDetailsService problemDetailsService)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not KeyNotFoundException)
        {
            // Not ours — let the next handler (and the default 500 path) run,
            // which is also what reports the exception to Sentry.
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status404NotFound;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Not Found",
                Detail = "The requested record does not exist.",
            },
        });
    }
}
