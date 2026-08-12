namespace ServiceMaintenance.Services.Notifications;

public enum TelegramAction
{
    Send,
    Delete,
    SendDocument,
    SendPhoto,
    Edit
}

public class TelegramMessage
{
    public TelegramAction Action { get; set; } = TelegramAction.Send;
    public string Text { get; set; } = string.Empty;
    public string TopicKey { get; set; }
    public string ParseMode { get; set; } = "HTML";

    // Send: which service this message belongs to
    public Guid? ItemId { get; set; }

    // ✅ FIX: ត្រូវជា int? មិនមែន int ទេ
    // ដោយសារ default(int) = 0 ត្រូវបានចាត់ទុកជា "has a value" ពេល assign
    // ទៅ int? ធ្វើឲ្យ ResolveMessageIdFromTopic fallback logic ក្នុង
    // DeleteWithRetryAsync មិនដែលដំណើរការទាល់តែសោះ (delete request
    // ចេញទៅ Telegram ដោយ message_id=0 ជានិច្ច)
    public int? MessageId { get; set; }

    // Delete (fallback path): resolve MessageId at execution time
    public bool ResolveMessageIdFromTopic { get; set; } = false;

    public byte[] FileBytes { get; set; }
    public string FileName { get; set; }
    public string Caption { get; set; }
}