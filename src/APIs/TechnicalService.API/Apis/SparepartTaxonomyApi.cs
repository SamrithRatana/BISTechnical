using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.OutputCaching;
using TechnicalService.API.Application.Commands;
using TechnicalService.API.Application.Queries;

namespace TechnicalService.API.Apis;

/// <summary>
/// Spare-part Category / Type / Brand maintenance, plus the catalogue
/// <c>DELETE</c> both clients already called but nothing served.
///
/// Kept out of <c>TechnicalServiceApi.cs</c> (1,600 lines) on purpose. Mapped
/// from the same versioned builder in <c>Program.cs</c>, so the
/// <c>RequireAuthorization()</c> applied there under <c>Jwt:Enabled</c> covers
/// these routes too.
///
/// Errors are exceptions, mapped by the registered handlers: 404 (missing
/// row), 400 (bad field, domain rule), 409 (duplicate name, still in use, or a
/// raced database constraint). Every write evicts both output-cache tags — the
/// taxonomy lists carry <c>PartCount</c>, and the spare-part list will carry
/// these names — and does so with <see cref="CancellationToken.None"/>: the
/// write has already committed by then, and a client that disconnects in that
/// window must not leave the cache serving the pre-commit lists.
/// </summary>
public static class SparepartTaxonomyApi
{
    private const string CategoriesPath = "/api/spareparts/categories";
    private const string TypesPath = "/api/spareparts/types";
    private const string BrandsPath = "/api/spareparts/brands";

    public static RouteGroupBuilder MapSparepartTaxonomyApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/spareparts");

        // Literal segments are registered here; the Guid-constrained
        // "/spareparts/{sparepartId:Guid}" routes elsewhere cannot match them.
        api.MapGet("/categories", GetCategoriesAsync)
           .CacheOutput(global::Extensions.SparepartTaxonomyCachePolicy);
        Write(api.MapPost("/categories", CreateCategoryAsync));
        Write(api.MapPut("/categories/{id:guid}", UpdateCategoryAsync));
        Write(api.MapDelete("/categories/{id:guid}", DeleteCategoryAsync));

        api.MapGet("/types", GetTypesAsync)
           .CacheOutput(global::Extensions.SparepartTaxonomyCachePolicy);
        Write(api.MapPost("/types", CreateTypeAsync));
        Write(api.MapPut("/types/{id:guid}", UpdateTypeAsync));
        Write(api.MapDelete("/types/{id:guid}", DeleteTypeAsync));

        api.MapGet("/brands", GetBrandsAsync)
           .CacheOutput(global::Extensions.SparepartTaxonomyCachePolicy);
        Write(api.MapPost("/brands", CreateBrandAsync));
        Write(api.MapPut("/brands/{id:guid}", UpdateBrandAsync));
        Write(api.MapDelete("/brands/{id:guid}", DeleteBrandAsync));

        Write(api.MapDelete("/{sparepartId:guid}", DeleteSparepartAsync));

        return api;
    }

    /// <summary>
    /// The typed results only advertise the success shape; the ProblemDetails
    /// responses (with their <c>code</c> / <c>count</c> extensions) have to be
    /// declared for OpenAPI, which §11 makes the contract of record.
    /// </summary>
    private static RouteHandlerBuilder Write(RouteHandlerBuilder builder) =>
        builder.ProducesProblem(StatusCodes.Status400BadRequest)
               .ProducesProblem(StatusCodes.Status404NotFound)
               .ProducesProblem(StatusCodes.Status409Conflict);

    // ── Categories ────────────────────────────────────────────────────────

    public static async Task<Ok<List<SparepartCategoryDto>>> GetCategoriesAsync(
        ISparepartTaxonomyQueries queries, CancellationToken cancellationToken) =>
        TypedResults.Ok(await queries.GetCategoriesAsync(cancellationToken));

    public static async Task<Created<TaxonomyCreatedResponse>> CreateCategoryAsync(
        SparepartCategoryRequest request,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        var id = await Send(services,
            new CreateSparepartCategoryCommand(request.Name, request.Description, request.SortOrder),
            cancellationToken);
        await EvictAsync(cache);
        return TypedResults.Created(CategoriesPath, new TaxonomyCreatedResponse(id));
    }

    public static async Task<NoContent> UpdateCategoryAsync(
        Guid id,
        SparepartCategoryRequest request,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        await Send(services,
            new UpdateSparepartCategoryCommand(id, request.Name, request.Description, request.SortOrder),
            cancellationToken);
        await EvictAsync(cache);
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteCategoryAsync(
        Guid id,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        await Send(services, new DeleteSparepartCategoryCommand(id), cancellationToken);
        await EvictAsync(cache);
        return TypedResults.NoContent();
    }

    // ── Types ─────────────────────────────────────────────────────────────

    public static async Task<Ok<List<SparepartTypeDto>>> GetTypesAsync(
        Guid? categoryId, ISparepartTaxonomyQueries queries, CancellationToken cancellationToken) =>
        TypedResults.Ok(await queries.GetTypesAsync(categoryId, cancellationToken));

    public static async Task<Created<TaxonomyCreatedResponse>> CreateTypeAsync(
        SparepartTypeRequest request,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        var id = await Send(services,
            new CreateSparepartTypeCommand(request.CategoryId, request.Name, request.Description, request.SortOrder),
            cancellationToken);
        await EvictAsync(cache);
        return TypedResults.Created(TypesPath, new TaxonomyCreatedResponse(id));
    }

    public static async Task<NoContent> UpdateTypeAsync(
        Guid id,
        SparepartTypeRequest request,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        await Send(services,
            new UpdateSparepartTypeCommand(id, request.CategoryId, request.Name, request.Description, request.SortOrder),
            cancellationToken);
        await EvictAsync(cache);
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteTypeAsync(
        Guid id,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        await Send(services, new DeleteSparepartTypeCommand(id), cancellationToken);
        await EvictAsync(cache);
        return TypedResults.NoContent();
    }

    // ── Brands ────────────────────────────────────────────────────────────

    public static async Task<Ok<List<SparepartBrandDto>>> GetBrandsAsync(
        ISparepartTaxonomyQueries queries, CancellationToken cancellationToken) =>
        TypedResults.Ok(await queries.GetBrandsAsync(cancellationToken));

    public static async Task<Created<TaxonomyCreatedResponse>> CreateBrandAsync(
        SparepartBrandRequest request,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        var id = await Send(services,
            new CreateSparepartBrandCommand(request.Name, request.LogoUrl), cancellationToken);
        await EvictAsync(cache);
        return TypedResults.Created(BrandsPath, new TaxonomyCreatedResponse(id));
    }

    public static async Task<NoContent> UpdateBrandAsync(
        Guid id,
        SparepartBrandRequest request,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        await Send(services,
            new UpdateSparepartBrandCommand(id, request.Name, request.LogoUrl), cancellationToken);
        await EvictAsync(cache);
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteBrandAsync(
        Guid id,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        await Send(services, new DeleteSparepartBrandCommand(id), cancellationToken);
        await EvictAsync(cache);
        return TypedResults.NoContent();
    }

    // ── Catalogue delete ──────────────────────────────────────────────────

    public static async Task<NoContent> DeleteSparepartAsync(
        Guid sparepartId,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache,
        CancellationToken cancellationToken)
    {
        await Send(services, new DeleteSparepartCommand(sparepartId), cancellationToken);
        // Both tags: a classified part leaving the catalogue changes the
        // PartCount on its category / type / brand rows.
        await EvictAsync(cache);
        return TypedResults.NoContent();
    }

    // ── Plumbing ──────────────────────────────────────────────────────────

    private static async Task<TResponse> Send<TResponse>(
        TechnicalServices services, IRequest<TResponse> command, CancellationToken cancellationToken)
    {
        services.Logger.LogInformation("Sending command: {CommandName}: {@Command}",
            command.GetType().Name, command);
        return await services.Mediator.Send(command, cancellationToken);
    }

    private static async Task EvictAsync(IOutputCacheStore cache)
    {
        await cache.EvictByTagAsync(global::Extensions.SparepartTaxonomyCacheTag, CancellationToken.None);
        await cache.EvictByTagAsync(global::Extensions.SparepartsCacheTag, CancellationToken.None);
    }
}

/// <remarks><paramref name="Description"/> is optional.</remarks>
public record SparepartCategoryRequest(string Name, string? Description, int SortOrder = 0);
/// <remarks><paramref name="Description"/> is optional.</remarks>
public record SparepartTypeRequest(Guid CategoryId, string Name, string? Description, int SortOrder = 0);
/// <remarks><paramref name="LogoUrl"/> is optional; the name is stored upper-case.</remarks>
public record SparepartBrandRequest(string Name, string? LogoUrl);
public record TaxonomyCreatedResponse(Guid Id);
