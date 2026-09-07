namespace TechnicalService.Infrastructure.EntityConfigurations;

class SparepartEntityTypeConfiguration
    : IEntityTypeConfiguration<Sparepart>
{
    public void Configure(EntityTypeBuilder<Sparepart> sparepartConfiguration)
    {
        sparepartConfiguration.ToTable("Spareparts", t =>
        {
            // The actual trigger on the table (verified in sys.triggers
            // 2026-09-05). EF only needs to know one exists so it avoids the
            // OUTPUT clause, but the declared name should match the database.
            t.HasTrigger("trg_Spareparts_AuditQuantity");
        });

        sparepartConfiguration.Ignore(b => b.DomainEvents);

        // Matches the live column (decimal(38,2), verified in sys.columns
        // 2026-09-05). Without this EF warned at every start-up that values
        // could be silently truncated.
        sparepartConfiguration.Property(b => b.DefaultPrice).HasPrecision(38, 2);

        sparepartConfiguration.HasIndex(b => b.ItemName);
        sparepartConfiguration.HasIndex(b => b.SerialNumber);
        sparepartConfiguration.HasIndex(b => b.UserFor);
        sparepartConfiguration.HasIndex(b => b.Quantity);
        sparepartConfiguration.HasIndex(b => b.LinkItemId);

        // ── Classification: nullable FKs to the taxonomy tables ──────────
        // Restrict on every one: a category/type/brand still referenced by a
        // part cannot be deleted (the handler reports "in use" as a 409).
        // Mirrors sql/sparepart-taxonomy.sql.
        sparepartConfiguration.HasOne(b => b.Category)
            .WithMany()
            .HasForeignKey(b => b.CategoryId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Spareparts_SparepartCategories_CategoryId");

        sparepartConfiguration.HasOne(b => b.Type)
            .WithMany()
            .HasForeignKey(b => b.TypeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Spareparts_SparepartTypes_TypeId");

        sparepartConfiguration.HasOne(b => b.Brand)
            .WithMany()
            .HasForeignKey(b => b.BrandId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Spareparts_SparepartBrands_BrandId");

        // Every list-filter column is indexed (§4 / §11).
        sparepartConfiguration.HasIndex(b => b.CategoryId).HasDatabaseName("IX_Spareparts_CategoryId");
        sparepartConfiguration.HasIndex(b => b.TypeId).HasDatabaseName("IX_Spareparts_TypeId");
        sparepartConfiguration.HasIndex(b => b.BrandId).HasDatabaseName("IX_Spareparts_BrandId");
    }
}
