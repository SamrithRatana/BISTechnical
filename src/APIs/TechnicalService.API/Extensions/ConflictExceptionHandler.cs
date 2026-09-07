using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace TechnicalService.API.Extensions;

/// <summary>
/// Turns a state conflict into a 409 instead of a 500.
/// </summary>
/// <remarks>
/// Two sources:
/// <list type="bullet">
/// <item><see cref="ConflictException"/> — the handler checked first (duplicate
/// name, lookup still in use) and composed a message with the count. Its
/// <c>code</c> is <c>duplicate</c> or <c>inUse</c>.</item>
/// <item>A <see cref="DbUpdateException"/> whose SQL error is a constraint
/// violation — the check-then-write above is not atomic, so a lost race lands
/// here. 2601 / 2627 (unique index / key) become <c>duplicate</c>; 547 (FK or
/// CHECK) becomes <c>constraint</c>, deliberately NOT <c>inUse</c>: on an
/// insert path 547 means the client named a row that does not exist, and on a
/// trigger path it can mean the stock CHECKs fired — neither is "in use". The
/// client message is generic (SQL Server's own text names tables and
/// constraints); the full server message is logged so the constraint that
/// fired is on record.</item>
/// </list>
/// </remarks>
internal sealed class ConflictExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ConflictExceptionHandler> logger)
    : IExceptionHandler
{
    private const int ForeignKeyOrCheckViolation = 547;
    private const int DuplicateIndex = 2601;
    private const int DuplicateKey = 2627;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ProblemDetails? problem;
        switch (exception)
        {
            case ConflictException conflict:
                problem = Describe(conflict);
                break;
            case DbUpdateException { InnerException: SqlException sql } when IsConstraintViolation(sql.Number):
                logger.LogWarning(sql,
                    "Database constraint violation ({SqlErrorNumber}) on {Method} {Path}: {SqlMessage}",
                    sql.Number, httpContext.Request.Method, httpContext.Request.Path, sql.Message);
                problem = DescribeConstraint(sql.Number);
                break;
            default:
                return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status409Conflict;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
        });
    }

    private static bool IsConstraintViolation(int number) =>
        number is ForeignKeyOrCheckViolation or DuplicateIndex or DuplicateKey;

    private static ProblemDetails Describe(ConflictException conflict)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title = "Conflict",
            Detail = conflict.Message,
        };
        problem.Extensions["code"] = conflict.Code;
        if (conflict.Count.HasValue)
        {
            problem.Extensions["count"] = conflict.Count.Value;
        }
        return problem;
    }

    private static ProblemDetails DescribeConstraint(int number)
    {
        var duplicate = number is DuplicateIndex or DuplicateKey;
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title = "Conflict",
            Detail = duplicate
                ? "A record with the same value already exists."
                : "The change violates a database rule (a referenced record is missing or still in use).",
        };
        problem.Extensions["code"] = duplicate ? ConflictException.Duplicate : ConflictException.Constraint;
        return problem;
    }
}
