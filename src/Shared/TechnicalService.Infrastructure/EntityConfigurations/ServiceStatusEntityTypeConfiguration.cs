namespace TechnicalService.Infrastructure.EntityConfigurations;

class ServiceStatusEntityTypeConfiguration : IEntityTypeConfiguration<ServiceStatus>
{
    public void Configure(EntityTypeBuilder<ServiceStatus> serviceStatusConfiguration)
    {
        serviceStatusConfiguration.ToTable("ServiceStatuses");

        serviceStatusConfiguration.Property(st => st.Id)
            .ValueGeneratedNever();

        serviceStatusConfiguration.Property(st => st.Name)
            .HasMaxLength(30);
    }
}
