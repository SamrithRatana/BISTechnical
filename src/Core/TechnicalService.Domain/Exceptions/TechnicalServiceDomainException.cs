namespace TechnicalService.Domain.Exceptions;

/// <summary>
/// Exception type for domain exceptions
/// </summary>
public class TechnicalServiceDomainException : Exception
{
    public TechnicalServiceDomainException()
    { }

    public TechnicalServiceDomainException(string message)
        : base(message)
    { }

    public TechnicalServiceDomainException(string message, Exception innerException)
        : base(message, innerException)
    { }
}
