using TechnicalService.Domain.AggregatesModel.RentalAggregate;

namespace TechnicalService.Infrastructure.EntityConfigurations;

class RentalServiceEntityTypeConfiguration
    : IEntityTypeConfiguration<RentalService>
{
    public void Configure(EntityTypeBuilder<RentalService> rentalServiceConfiguration)
    {
        rentalServiceConfiguration.ToTable("RentalServices");

        rentalServiceConfiguration.Ignore(b => b.DomainEvents);

        rentalServiceConfiguration
            .Property(r => r.Action)
            .HasConversion<string>()
            .HasMaxLength(12);

        //rentalServiceConfiguration
        //    .Property(r => r.Note)
        //    .HasMaxLength(5000);

        rentalServiceConfiguration.HasOne(r => r.RentalItem)
            .WithMany()
            .HasForeignKey(r => r.RentalItemId);
    }
}
