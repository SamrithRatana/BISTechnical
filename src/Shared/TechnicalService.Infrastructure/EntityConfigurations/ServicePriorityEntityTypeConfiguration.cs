namespace TechnicalService.Infrastructure.EntityConfigurations;

class ServicePriorityEntityTypeConfiguration : IEntityTypeConfiguration<ServicePriority>
{
    public void Configure(EntityTypeBuilder<ServicePriority> servicePriorityConfiguration)
    {
        servicePriorityConfiguration.ToTable("ServicePriorities");

        servicePriorityConfiguration.Property(st => st.Id)
            .ValueGeneratedNever();

        servicePriorityConfiguration.Property(st => st.Name)
            .HasMaxLength(25);
    }
}
