namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ServiceLocation
{
    CompanyService = 0,
    OnSite = 1
}
