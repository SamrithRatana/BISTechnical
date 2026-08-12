using TechnicalService.API.Application.Queries;
using TechnicalService.API.Infrastructure;
using TechnicalService.Domain.AggregatesModel.RentalAggregate;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

internal static class Extensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        var services = builder.Services;

        builder.Services.AddDbContext<TechnicalServiceContext>(options =>
            options.UseSqlServer(builder.Configuration.GetConnectionString("TechnicalServiceConnectionString")));

        services.AddMigration<TechnicalServiceContext, TechnicalServiceContextSeed>();
        services.AddHttpContextAccessor();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
        });

        services.AddScoped<ITechnicalServiceQueries, TechnicalServiceQueries>();
        services.AddScoped<ITechnicalServiceRepository, TechnicalServiceRepository>();
        services.AddScoped<IRentalServiceRepository, RentalServiceRepository>();
    }
}