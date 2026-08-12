using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.Infrastructure.EntityConfigurations;

class ServiceEntityTypeConfiguration : IEntityTypeConfiguration<Service>
{
    public void Configure(EntityTypeBuilder<Service> serviceConfiguration)
    {
        serviceConfiguration.ToTable("Services");
        serviceConfiguration.Ignore(b => b.DomainEvents);

        serviceConfiguration
            .Property(r => r.CustomerId)
            .IsRequired();

        serviceConfiguration
            .Property(r => r.ServiceLocation)
            .HasConversion<string>()
            .HasMaxLength(30);

        serviceConfiguration
            .Property("_serviceTypeId")
            .HasColumnName("ServiceTypeId");
        serviceConfiguration.HasOne(rs => rs.ServiceType)
            .WithMany()
            .HasForeignKey("_serviceTypeId");

        serviceConfiguration
            .Property("_servicePriorityId")
            .HasColumnName("ServicePriorityId")
            .IsRequired();
        serviceConfiguration.HasOne(rs => rs.ServicePriority)
            .WithMany()
            .HasForeignKey("_servicePriorityId");

        serviceConfiguration
            .Property("_serviceStatusId")
            .HasColumnName("ServiceStatusId");
        serviceConfiguration.HasOne(rs => rs.Status)
            .WithMany()
            .HasForeignKey("_serviceStatusId");

        serviceConfiguration.HasOne(r => r.Item)
            .WithMany()
            .HasForeignKey(r => r.ItemId);

        // ✅ FIX: Use "ServiceId" - matches actual DB column
        serviceConfiguration
            .HasMany("_sparepartItems")
            .WithOne()
            .HasForeignKey("ServiceId")
            .OnDelete(DeleteBehavior.Cascade);

        serviceConfiguration
            .Navigation("_sparepartItems")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}