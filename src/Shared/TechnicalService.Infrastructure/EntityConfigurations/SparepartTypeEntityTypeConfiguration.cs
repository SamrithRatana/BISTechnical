namespace TechnicalService.Infrastructure.EntityConfigurations;

/// <summary>
/// Mirrors <c>sql/sparepart-taxonomy.sql</c>. The schema is applied by that
/// script, not by an EF migration — see the script header for why.
/// </summary>
class SparepartTypeEntityTypeConfiguration
    : IEntityTypeConfiguration<SparepartType>
{
    public void Configure(EntityTypeBuilder<SparepartType> builder)
    {
        builder.ToTable("SparepartTypes");

        builder.Ignore(b => b.DomainEvents);

        builder.HasKey(b => b.Id);

        builder.Property(b => b.CategoryId)
            .IsRequired();

        builder.Property(b => b.Name)
            .HasMaxLength(SparepartTaxonomyRules.NameMaxLength)
            .IsRequired();

        builder.Property(b => b.Description)
            .HasMaxLength(SparepartTaxonomyRules.DescriptionMaxLength);

        builder.Property(b => b.SortOrder)
            .HasDefaultValue(0);

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        // A category that still has types cannot be deleted (Restrict), so a
        // delete never silently orphans or cascades through the taxonomy.
        builder.HasOne(b => b.Category)
            .WithMany()
            .HasForeignKey(b => b.CategoryId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_SparepartTypes_SparepartCategories_CategoryId");

        // Unique per category; the leading CategoryId column also serves the
        // "types for this category" lookup, so no separate index on it.
        builder.HasIndex(b => new { b.CategoryId, b.Name })
            .IsUnique()
            .HasDatabaseName("UX_SparepartTypes_CategoryId_Name");
    }
}
