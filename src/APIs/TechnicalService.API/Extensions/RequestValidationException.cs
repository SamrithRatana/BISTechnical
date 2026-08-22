namespace TechnicalService.API.Extensions;

/// <summary>
/// A request carried a value the API cannot accept.
/// </summary>
/// <remarks>
/// Mapped to a 400 by <see cref="ValidationExceptionHandler"/>, the same way
/// <see cref="KeyNotFoundException"/> is mapped to a 404 by
/// <c>NotFoundExceptionHandler</c>. Having a dedicated type means a bad value
/// is distinguishable from a genuine server fault, so it neither returns a 500
/// to the caller nor lands in Sentry as one.
/// </remarks>
public sealed class RequestValidationException : Exception
{
    public RequestValidationException(string message) : base(message)
    {
    }
}

/// <summary>
/// Parses caller-supplied strings into enums without throwing a raw
/// <see cref="ArgumentException"/> out of a command handler.
/// </summary>
/// <remarks>
/// Every <c>Enum.Parse&lt;T&gt;</c> in the command handlers took a string
/// straight off the request body. A value that did not match a member threw
/// <c>ArgumentException</c>, which nothing caught, so a typo in a client
/// payload (a condition, a service location, a rental action) came back as a
/// 500 rather than a 400 naming the bad field.
/// </remarks>
public static class EnumParsing
{
    /// <summary>
    /// Parses <paramref name="value"/> as <typeparamref name="TEnum"/>, or
    /// throws <see cref="RequestValidationException"/> naming the field and
    /// listing the values that would have been accepted.
    /// </summary>
    public static TEnum Parse<TEnum>(string value, string fieldName) where TEnum : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new RequestValidationException(
                $"'{fieldName}' is required. Valid values: {string.Join(", ", Enum.GetNames<TEnum>())}.");
        }

        if (!Enum.TryParse<TEnum>(value.Trim(), ignoreCase: true, out var parsed) ||
            !Enum.IsDefined(parsed))
        {
            throw new RequestValidationException(
                $"'{value}' is not a valid {fieldName}. Valid values: {string.Join(", ", Enum.GetNames<TEnum>())}.");
        }

        return parsed;
    }
}
