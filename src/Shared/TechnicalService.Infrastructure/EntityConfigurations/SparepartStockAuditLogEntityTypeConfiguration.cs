using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.Infrastructure.EntityConfigurations;

public class SparepartStockAuditLogEntityTypeConfiguration
    : IEntityTypeConfiguration<SparepartStockAuditLog>
{
    public void Configure(EntityTypeBuilder<SparepartStockAuditLog> builder)
    {
        builder.ToTable("SparepartStockAuditLog");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.OperationType).HasMaxLength(50);
        builder.Property(x => x.Remarks).HasColumnType("nvarchar(max)");
    }
}