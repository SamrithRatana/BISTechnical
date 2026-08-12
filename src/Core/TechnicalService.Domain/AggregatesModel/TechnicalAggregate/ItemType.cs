namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class ItemType : ValueObject
{
    public string Type { get; private set; }

    public ItemType() { }

    public ItemType(string type)
    {
        Type = type;
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        // Using a yield return statement to return each elecment one at a time
        yield return Type;
    }
}
