namespace TechnicalService.Infrastructure.EntityConfigurations;

/// <summary>
/// Mirrors <c>sql/sparepart-taxonomy.sql</c>. The schema is applied by that
/// script, not by an EF migration — see the script header for why.
/// </summary>
class SparepartCategoryEntityTypeConfiguration
    : IEntityTypeConfiguration<SparepartCategory>
{
    public void Configure(EntityTypeBuilder<SparepartCategory> builder)
    {
        builder.ToTable("SparepartCategories");

        builder.Ignore(b => b.DomainEvents);

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name)
            .HasMaxLength(SparepartTaxonomyRules.NameMaxLength)
            .IsRequired();

        builder.Property(b => b.Description)
            .HasMaxLength(SparepartTaxonomyRules.DescriptionMaxLength);

        builder.Property(b => b.SortOrder)
            .HasDefaultValue(0);

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        builder.HasIndex(b => b.Name)
            .IsUnique()
            .HasDatabaseName("UX_SparepartCategories_Name");

        builder.HasIndex(b => b.SortOrder)
            .HasDatabaseName("IX_SparepartCategories_SortOrder");
    }
}
