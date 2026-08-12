namespace TechnicalService.Domain.AggregatesModel.RentalAggregate;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SparepartCondition
{
    Replace = 0,
    Fix = 1,
    Free=2
}
