using System.ComponentModel.DataAnnotations;

namespace TechnicalService.Domain.AggregatesModel.CustomerAggregate;

public class Customer
    : Entity, IAggregateRoot
{
    [Required]
    public string IdentityGuid { get; private set; }

    public string CompanyName { get; private set; }
    public string Category { get; private set; }

    protected Customer() { }

    public Customer(string identity, string companyName, string category)
    {
        IdentityGuid = !string.IsNullOrWhiteSpace(identity) ? identity : throw new ArgumentNullException(nameof(identity));
        CompanyName = !string.IsNullOrWhiteSpace(companyName) ? companyName : throw new ArgumentNullException(nameof(companyName));
        Category = !string.IsNullOrWhiteSpace(category) ? category : throw new ArgumentNullException(nameof(category));
    }
}
