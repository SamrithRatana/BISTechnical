namespace TechnicalService.Domain.AggregatesModel.RentalAggregate;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ActionType
{
    PreCheck = 1,
    Install = 2,
    Check = 3,
    Repair = 4
}