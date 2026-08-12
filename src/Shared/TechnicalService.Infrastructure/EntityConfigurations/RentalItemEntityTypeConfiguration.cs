namespace TechnicalService.Infrastructure.EntityConfigurations;

class RentalItemEntityTypeConfiguration : IEntityTypeConfiguration<RentalItem>
{
    public void Configure(EntityTypeBuilder<RentalItem> rentalItemConfiguration)
    {
        rentalItemConfiguration.ToTable("RentalItems");

        rentalItemConfiguration.Ignore(b => b.DomainEvents);

        rentalItemConfiguration
            .Property(r => r.CustomerId)
            .IsRequired();

        rentalItemConfiguration.Property(r => r.CustomerName)
            .HasMaxLength(1000)
            .IsRequired();

        rentalItemConfiguration.Property(r => r.ItemName)
            .HasMaxLength(1000)
            .IsRequired();

        rentalItemConfiguration
            .Property(r => r.SerialNumber)
            .HasMaxLength(50);

        rentalItemConfiguration
            .Property(r => r.Condition)
            .HasMaxLength(12)
            .IsRequired();

        rentalItemConfiguration
            .Property(r => r.Location)
            .HasMaxLength(1000);
    }
}
