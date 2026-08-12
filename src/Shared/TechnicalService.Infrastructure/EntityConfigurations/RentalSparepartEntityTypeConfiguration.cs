namespace TechnicalService.Infrastructure.EntityConfigurations;

class RentalSparepartEntityTypeConfiguration
    : IEntityTypeConfiguration<RentalSparepart>
{
    public void Configure(EntityTypeBuilder<RentalSparepart> rentalSparepartConfiguration)
    {
        rentalSparepartConfiguration.ToTable("RentalSpareparts");

        rentalSparepartConfiguration.Ignore(b => b.DomainEvents);

        rentalSparepartConfiguration.Property<Guid>("RentalServiceId");

        rentalSparepartConfiguration
            .Property(p => p.Condition)
            .HasConversion<string>()
            .HasMaxLength(10);
    }
}
