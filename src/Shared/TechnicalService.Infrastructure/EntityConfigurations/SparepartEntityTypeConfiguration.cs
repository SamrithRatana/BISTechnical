namespace TechnicalService.Infrastructure.EntityConfigurations;

class SparepartEntityTypeConfiguration
    : IEntityTypeConfiguration<Sparepart>
{
    public void Configure(EntityTypeBuilder<Sparepart> sparepartConfiguration)
    {
        sparepartConfiguration.ToTable("Spareparts");

        sparepartConfiguration.Ignore(b => b.DomainEvents);
    }
}
