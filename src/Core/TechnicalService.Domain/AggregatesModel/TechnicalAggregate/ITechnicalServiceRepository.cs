namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public interface ITechnicalServiceRepository : IRepository<Service>
{
    Task<Item> GetItemAsync(Guid itemId);

    Item AddItem(Item item);

    void UpdateItem(Item item);

    void DeleteItem(Item item);

    Task<Sparepart> GetSparepartAsync(Guid sparepartId);

    Sparepart AddSparepart(Sparepart sparepart);

    //void UpdateSparepart(Sparepart sparepart);

    Task<Service> GetServiceAsync(Guid id);

    Service ReceiveItem(Service service);

    void UpdateRepairService(Service repairService);

    void DeleteRepairService(Service repairService);

    Task<Service> GetAsync(Guid id);
    void DeleteService(Service service);
}
