namespace TechnicalService.Domain.AggregatesModel.RentalAggregate;

public interface IRentalServiceRepository : IRepository<RentalService>
{
    Task<RentalItem> GetRentalItemAsync(Guid itemId);

    RentalItem AddRentalItem(RentalItem item);

    void UpdateRentalItem(RentalItem item);

    void DeleteRentalItem(RentalItem item);

    RentalService CreateRentalService(RentalService rentalService);

    //Task<Sparepart> GetSparepartAsync(Guid sparepartId);

    //Sparepart AddSparepart(Sparepart sparepart);

    //void UpdateSparepart(Sparepart sparepart);

    //Task<Service> GetServiceAsync(Guid id);

    //Service ReceiveItem(Service service);

    //void UpdateRepairService(Service repairService);

    //void DeleteRepairService(Service repairService);
}
