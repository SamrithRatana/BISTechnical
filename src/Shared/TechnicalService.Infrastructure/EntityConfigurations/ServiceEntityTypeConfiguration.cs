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

        // ReportNo defaulted to nvarchar(max), which SQL Server refuses to use
        // as an index key (1700-byte limit) — so the sort column below could
        // not be indexed at all until it was bounded. 100 is far above the
        // report-number format actually in use.
        serviceConfiguration
            .Property(s => s.ReportNo)
            .HasMaxLength(100);

        // ── Indexes for the search/list queries ──────────────────────────────
        // Every ticket list the UI renders runs the same shape: filter by
        // status, order by ReportNo descending, page. ServiceStatusId already
        // had an FK index, but the sort column had none — so SQL Server sorted
        // the whole filtered set on every request, on every scroll batch, for
        // every user.
        //
        // The composite covers that query directly: seek the status, then read
        // ReportNo already in order, skipping the sort entirely. The
        // single-column ReportNo index serves lookups that don't filter by
        // status (e.g. the header's global search).
        serviceConfiguration
            .HasIndex("_serviceStatusId", nameof(Service.ReportNo))
            .HasDatabaseName("IX_Services_Status_ReportNo");

        serviceConfiguration
            .HasIndex(s => s.ReportNo)
            .HasDatabaseName("IX_Services_ReportNo");

        // ServiceDate is the fallback sort and the column every report date
        // range filters on.
        serviceConfiguration
            .HasIndex(s => s.ServiceDate)
            .HasDatabaseName("IX_Services_ServiceDate");
    }
}