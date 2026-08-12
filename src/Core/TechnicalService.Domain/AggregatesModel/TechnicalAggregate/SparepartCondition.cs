namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SparepartCondition
{
    Replace = 0,
    Fix = 1,
    Free= 2
}
