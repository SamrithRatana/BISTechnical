namespace TechnicalService.Infrastructure.EntityConfigurations;

/// <summary>
/// Mirrors <c>sql/sparepart-taxonomy.sql</c>. The schema is applied by that
/// script, not by an EF migration — see the script header for why. The
/// upper-case rule on <c>Name</c> is a CHECK constraint in the script and is
/// not expressible here; the domain constructor enforces it for API writes.
/// </summary>
class SparepartBrandEntityTypeConfiguration
    : IEntityTypeConfiguration<SparepartBrand>
{
    public void Configure(EntityTypeBuilder<SparepartBrand> builder)
    {
        builder.ToTable("SparepartBrands");

        builder.Ignore(b => b.DomainEvents);

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name)
            .HasMaxLength(SparepartTaxonomyRules.NameMaxLength)
            .IsRequired();

        builder.Property(b => b.LogoUrl)
            .HasMaxLength(SparepartTaxonomyRules.LogoUrlMaxLength);

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        builder.HasIndex(b => b.Name)
            .IsUnique()
            .HasDatabaseName("UX_SparepartBrands_Name");
    }
}
