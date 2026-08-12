namespace TechnicalService.Infrastructure.EntityConfigurations;

class ServiceTypeEntityTypeConfiguration : IEntityTypeConfiguration<ServiceType>
{
    public void Configure(EntityTypeBuilder<ServiceType> serviceTypeConfiguration)
    {
        serviceTypeConfiguration.ToTable("ServiceTypes");

        serviceTypeConfiguration.Property(st => st.Id)
            .ValueGeneratedNever();

        serviceTypeConfiguration.Property(st => st.Name)
            .HasMaxLength(25);
    }
}
