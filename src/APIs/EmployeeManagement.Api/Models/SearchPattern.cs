using System.Text;

namespace EmployeeManagement.Api.Models
{
    /// <summary>
    /// Builds safe SQL <c>LIKE</c> patterns from free-text search input.
    /// </summary>
    /// <remarks>
    /// EF Core parameterises the pattern, so raw interpolation is not a SQL
    /// injection vector - but it is a wildcard injection vector: a user
    /// searching for "100%" or "a_b" previously had those characters treated
    /// as LIKE metacharacters, silently matching far more rows than asked for
    /// (and forcing a full scan). These helpers escape the metacharacters and
    /// pair with <see cref="EscapeCharacter"/> passed to
    /// <c>EF.Functions.Like(column, pattern, escapeChar)</c>.
    /// </remarks>
    internal static class SearchPattern
    {
        private const char Escaper = '\\';

        /// <summary>Escape character supplied to the SQL <c>LIKE ... ESCAPE</c> clause.</summary>
        public const string EscapeCharacter = "\\";

        /// <summary>Builds a <c>%term%</c> pattern with all wildcards escaped.</summary>
        public static string Contains(string term) => "%" + Escape(term) + "%";

        /// <summary>Escapes the SQL <c>LIKE</c> metacharacters in <paramref name="term"/>.</summary>
        public static string Escape(string term)
        {
            if (string.IsNullOrEmpty(term))
            {
                return string.Empty;
            }

            var builder = new StringBuilder(term.Length + 8);
            foreach (var c in term)
            {
                // The escape character itself must be escaped, as must each wildcard.
                if (c == Escaper || c == '%' || c == '_' || c == '[')
                {
                    builder.Append(Escaper);
                }

                builder.Append(c);
            }

            return builder.ToString();
        }
    }
}
