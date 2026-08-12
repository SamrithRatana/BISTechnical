namespace TechnicalService.Infrastructure.EntityConfigurations;

class ItemEntityTypeConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> itemConfiguration)
    {
        itemConfiguration.ToTable("Items");

        itemConfiguration.Ignore(i => i.DomainEvents);

        //itemConfiguration.Property(i => i.Id)
        //    .UseHiLo("itemseq");

        // ProductType value object persisted as owned entity type supported since EF Core 2.0
        itemConfiguration
            .OwnsOne(p => p.ItemType);
    }
}
