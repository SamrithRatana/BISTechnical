namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public interface ITechnicalServiceRepository : IRepository<Service>
{
    Task<Item> GetItemAsync(Guid itemId);

    Item AddItem(Item item);

    void UpdateItem(Item item);

    void DeleteItem(Item item);

    Task<Sparepart> GetSparepartAsync(Guid sparepartId);

    Sparepart AddSparepart(Sparepart sparepart);

    void DeleteSparepart(Sparepart sparepart);

    /// <summary>Ticket lines (<c>SparepartItems</c>) that reference the part.</summary>
    Task<int> CountSparepartTicketLinesAsync(Guid sparepartId);

    /// <summary>Rows in the stock audit ledger for the part; the ledger's FK forbids deleting a part that has any.</summary>
    Task<int> CountSparepartStockMovementsAsync(Guid sparepartId);

    Task<Service> GetServiceAsync(Guid id);

    Service ReceiveItem(Service service);

    void UpdateRepairService(Service repairService);

    void DeleteRepairService(Service repairService);

    Task<Service> GetAsync(Guid id);
    void DeleteService(Service service);
}
