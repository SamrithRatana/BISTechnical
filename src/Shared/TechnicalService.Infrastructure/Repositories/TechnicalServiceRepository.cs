
namespace TechnicalService.Infrastructure.Repositories;

public class TechnicalServiceRepository
    : ITechnicalServiceRepository
{
    private readonly TechnicalServiceContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public async Task<Item> GetItemAsync(Guid itemId)
    {
        var item = await _context.Items.FindAsync(itemId);

        if (item != null)
        {
            //await _context.Entry(item)
            //.Collection(i => i.T`)
        }

        return item;
    }

    public Service ReceiveItem(Service service)
    {
        return _context.Services.Add(service).Entity;
    }

    public Item AddItem(Item item)
    {
        return _context.Items.Add(item).Entity;
    }

    public void UpdateItem(Item item)
    {
        _context.Items.Update(item);
    }

    public void DeleteItem(Item item)
    {
        _context.Items.Remove(item);
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
    public async Task<Service> GetAsync(Guid id)
    {
        var service = await _context.Services
            .Include(s => s.Item)
            .Include(s => s.ServiceType)
            .Include(s => s.ServicePriority)
            .Include(s => s.Status)
            .Include(s => s.SparepartItems)
            .FirstOrDefaultAsync(s => s.Id == id);

        return service;
    }

    // ✅ ADD THIS METHOD:
    public void DeleteService(Service service)
    {
        if (service == null)
            throw new ArgumentNullException(nameof(service));

        _context.Services.Remove(service);
    }
    public Sparepart AddSparepart(Sparepart sparepart)
    {
        return _context.Spareparts.Add(sparepart).Entity;
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

    public TechnicalServiceRepository(TechnicalServiceContext context)

    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
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
