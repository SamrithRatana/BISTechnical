using TechnicalService.Domain;
using TechnicalService.Infrastructure.EntityConfigurations;
using Microsoft.EntityFrameworkCore;

namespace TechnicalService.Infrastructure;

public class TechnicalServiceContext : DbContext, IUnitOfWork
{
    public DbSet<Service> Services { get; set; }
    public DbSet<SparepartItem> SparepartItems { get; set; }
    public DbSet<Sparepart> Spareparts { get; set; }
    public DbSet<Item> Items { get; set; }
    public DbSet<ServiceType> ServiceTypes { get; set; }
    public DbSet<ServicePriority> ServicePriorities { get; set; }
    public DbSet<ServiceStatus> ServiceStatuses { get; set; }
    public DbSet<RentalItem> RentalItems { get; set; }
    public DbSet<RentalService> RentalServices { get; set; }
    public DbSet<RentalSparepart> RentalSpareparts { get; set; }
    public DbSet<SparepartManualStockOut> SparepartManualStockOuts { get; set; }
    public DbSet<SparepartStockAuditLog> SparepartStockAuditLogs { get; set; }

    private readonly IMediator _mediator;

    public TechnicalServiceContext(DbContextOptions<TechnicalServiceContext> options) : base(options) { }

    public TechnicalServiceContext(DbContextOptions<TechnicalServiceContext> options, IMediator mediator) : base(options)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        System.Diagnostics.Debug.WriteLine("RepairingContext::ctor ->" + this.GetHashCode());
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new ServiceEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SparepartEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SparepartItemEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ItemEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ServiceTypeEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ServicePriorityEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new ServiceStatusEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RentalItemEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RentalServiceEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new RentalSparepartEntityTypeConfiguration());
        modelBuilder.ApplyConfiguration(new SparepartStockAuditLogEntityTypeConfiguration());

        modelBuilder.Entity<Service>()
            .ToTable("Services", t =>
            {
                t.HasTrigger("trg_Services_AfterUpdate_StatusToRepairing");
            });

        modelBuilder.Entity<SparepartItem>()
            .ToTable("SparepartItems", t =>
            {
                t.HasTrigger("trg_Sparepartitems_AfterInsert_StockOut");
                t.HasTrigger("trg_Sparepartitems_AfterUpdate_StockAdjust");
                t.HasTrigger("trg_Sparepartitems_AfterDelete_StockIn");
            });

        modelBuilder.Entity<SparepartManualStockOut>()
            .ToTable("SparepartManualStockOut", t =>
            {
                t.HasTrigger("trg_SparepartManualStockOut_AfterInsert");
            });
    }

    public async Task<bool> SaveEntitiesAsync(CancellationToken cancellationToken = default)
    {
        _ = await base.SaveChangesAsync(cancellationToken);
        return true;
    }
}