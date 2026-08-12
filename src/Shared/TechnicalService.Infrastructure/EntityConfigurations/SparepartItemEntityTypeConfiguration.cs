using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.Infrastructure.EntityConfigurations
{
    class SparepartItemEntityTypeConfiguration : IEntityTypeConfiguration<SparepartItem>
    {
        public void Configure(EntityTypeBuilder<SparepartItem> builder)
        {
            builder.ToTable("SparepartItems");

            // Primary Key
            builder.HasKey(si => si.Id);

            // ✅ CHANGED: was builder.Property<Guid>("ServiceId") (shadow property)
            //             now maps to the real C# property on the entity
            builder.Property(si => si.ServiceId)
                .HasColumnName("ServiceId")
                .IsRequired();

            // ✅ CHANGED: HasForeignKey now uses the real property lambda
            builder.HasOne<Service>()
                .WithMany(s => s.SparepartItems)
                .HasForeignKey(si => si.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);

            // SparepartId
            builder.Property(si => si.SparepartId)
                .HasColumnName("SparepartId")
                .IsRequired();

            // Description
            builder.Property(si => si.Description)
                .HasColumnName("Description")
                .HasMaxLength(500);

            // Quantity
            builder.Property(si => si.Quantity)
                .HasColumnName("Quantity")
                .IsRequired();

            // Condition
            builder.Property(si => si.Condition)
                .HasColumnName("Condition")
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            // ✅ ADD: IsHoldStatus
            builder.Property(si => si.IsHoldStatus)
                .HasColumnName("IsHoldStatus")
                .HasDefaultValue(false)
                .IsRequired();

            // ✅ CHANGED: index now uses lambda instead of string
            builder.HasIndex(si => si.ServiceId)
                .HasDatabaseName("IX_SparepartItems_ServiceId");

            builder.HasIndex(si => si.SparepartId)
                .HasDatabaseName("IX_SparepartItems_SparepartId");
        }
    }
}