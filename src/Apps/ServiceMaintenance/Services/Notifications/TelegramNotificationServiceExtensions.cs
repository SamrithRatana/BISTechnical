namespace ServiceMaintenance.Services.Notifications;

public static class TelegramNotificationServiceExtensions
{
    public static IServiceCollection AddTelegramNotificationService(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<TelegramOptions>(configuration.GetSection("Telegram"));

        services.AddHttpClient("TelegramApi", client =>
        {
            client.BaseAddress = new Uri("https://api.telegram.org");
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        services.AddSingleton<TelegramNotificationQueue>();
        services.AddHostedService<TelegramBackgroundWorker>();

        return services;
    }
}