namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class ServiceType : Enumeration
{
    public static ServiceType Free = new(1, nameof(Free));
    public static ServiceType Charge = new(2, nameof(Charge));

    public ServiceType(int id, string name) : base(id, name)
    {
    }
}
