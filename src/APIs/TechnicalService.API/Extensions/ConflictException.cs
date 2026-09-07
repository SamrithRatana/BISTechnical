namespace TechnicalService.API.Extensions;

/// <summary>
/// The request is well-formed but conflicts with current state: a duplicate
/// name, or a lookup row that is still referenced and cannot be deleted.
/// </summary>
/// <remarks>
/// Mapped to a 409 by <see cref="ConflictExceptionHandler"/>. <see cref="Code"/>
/// is a stable machine-readable reason (<c>duplicate</c>, <c>inUse</c>) the
/// UI keys its translation off, and <see cref="Count"/> carries the number of
/// referencing rows when that is what the user needs to hear ("used by 12
/// spare parts"). The message is composed here from our own field names and
/// counts, never from a database error.
/// </remarks>
public sealed class ConflictException : Exception
{
    public const string Duplicate = "duplicate";
    public const string InUse = "inUse";
    /// <summary>A database FK / CHECK constraint refused the write (raced check, or a client-named row that does not exist).</summary>
    public const string Constraint = "constraint";

    public string Code { get; }
    public int? Count { get; }

    public ConflictException(string message, string code, int? count = null) : base(message)
    {
        Code = code;
        Count = count;
    }
}
