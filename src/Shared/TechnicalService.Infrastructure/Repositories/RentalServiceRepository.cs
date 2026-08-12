
namespace TechnicalService.Infrastructure.Repositories;

public class RentalServiceRepository
    : IRentalServiceRepository
{
    private readonly TechnicalServiceContext _context;

    public RentalServiceRepository(TechnicalServiceContext context)

    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public IUnitOfWork UnitOfWork => _context;

    public async Task<RentalItem> GetRentalItemAsync(Guid itemId)
    {
        var item = await _context.RentalItems.FindAsync(itemId);

        if (item != null)
        {
            //await _context.Entry(item)
            //.Collection(i => i.T`)
        }

        return item;
    }

    public RentalItem AddRentalItem(RentalItem item)
    {
        return _context.RentalItems.Add(item).Entity;
    }

    public void UpdateRentalItem(RentalItem item)
    {
        _context.RentalItems.Update(item);
    }

    public void DeleteRentalItem(RentalItem item)
    {
        _context.RentalItems.Remove(item);
    }

    public async Task<Sparepart> GetSparepartAsync(Guid sparepartId)
    {
        var part = await _context.Spareparts.FindAsync(sparepartId);

        if (part != null)
        {
            //await _context.Entry(item)
            //.Collection(i => i.T`)
        }

        return part;
    }

    public RentalService CreateRentalService(RentalService rentalService)
    {
        return _context.RentalServices.Add(rentalService).Entity;
    }

    //public void UpdateSparepart(Sparepart sparepart)
    //{
    //    _context.Spareparts.Update(sparepart);
    //}

    public async Task<Service> GetServiceAsync(Guid id)
    {
        var rs = await _context.Services
            .Include(p => p.SparepartItems)
            .FirstOrDefaultAsync(rs => rs.Id == id);

        if (rs != null)
        {
            //await _context.Entry(item)
            //.Collection(i => i.T`)
        }

        return rs;
    }

    public void UpdateRepairService(Service repairService)
    {
        _context.Services.Update(repairService);
    }

    public void DeleteRepairService(Service repairService)
    {
        _context.Services.Remove(repairService);
    }
}
