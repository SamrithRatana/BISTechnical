namespace TechnicalService.API.Extensions;

/// <summary>
/// Bounds caller-supplied paging values before they reach a query.
/// </summary>
/// <remarks>
/// Nothing validated these. Two concrete failures came out of that:
/// <list type="bullet">
/// <item><c>pageNumber=0</c> produced <c>Skip(-10)</c>, which SQL Server
/// rejects, so the request surfaced as a 500.</item>
/// <item><c>pageSize=0</c> produced <c>Math.Ceiling(count / 0.0)</c> in
/// <c>PagedResult</c>; the cast of infinity to int is unchecked, so
/// <c>TotalPages</c> came back as -2147483648.</item>
/// </list>
/// A large <c>pageSize</c> was also honoured verbatim, letting one request pull
/// the whole table across the public internet.
/// </remarks>
public static class Pagination
{
    /// <summary>Page size used when a caller supplies a non-positive one.</summary>
    public const int DefaultPageSize = 10;

    /// <summary>
    /// Largest page a single request may ask for. The heaviest legitimate
    /// caller is the spare-parts table, which loads 665 rows.
    /// </summary>
    public const int MaxPageSize = 1000;

    /// <summary>Clamps a page number to 1 or greater.</summary>
    public static int Page(int pageNumber) => pageNumber < 1 ? 1 : pageNumber;

    /// <summary>Clamps a page size into <c>[1, <see cref="MaxPageSize"/>]</c>.</summary>
    public static int Size(int pageSize) =>
        pageSize < 1 ? DefaultPageSize :
        pageSize > MaxPageSize ? MaxPageSize :
        pageSize;

    /// <summary>Clamps both values together.</summary>
    public static (int PageNumber, int PageSize) Normalize(int pageNumber, int pageSize) =>
        (Page(pageNumber), Size(pageSize));
}
