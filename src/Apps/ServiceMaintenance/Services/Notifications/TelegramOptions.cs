namespace ServiceMaintenance.Services.Notifications;

public class TelegramOptions
{
    public string BotToken { get; set; } = string.Empty;
    public string ChatId { get; set; } = string.Empty;
    // Key = ឈ្មោះខាងក្នុង code (e.g. "ItemReceived"), Value = message_thread_id
    public Dictionary<string, int> Topics { get; set; } = new();
}