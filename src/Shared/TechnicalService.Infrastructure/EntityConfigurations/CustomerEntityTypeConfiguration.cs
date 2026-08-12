namespace TechnicalService.Infrastructure.EntityConfigurations
{
    class CustomerEntityTypeConfiguration : IEntityTypeConfiguration<Customer>
    {
        public void Configure(EntityTypeBuilder<Customer> customerConfiguration)
        {
            customerConfiguration.ToTable("Customers");

            customerConfiguration.Ignore(c => c.DomainEvents);

            //customerConfiguration.Property(c => c.Id)
            //    .UseHiLo("customerseq");

            customerConfiguration.Property(c => c.IdentityGuid)
                .HasMaxLength(200);

            customerConfiguration.HasIndex("IdentityGuid")
                .IsUnique(true);
        }
    }
}
