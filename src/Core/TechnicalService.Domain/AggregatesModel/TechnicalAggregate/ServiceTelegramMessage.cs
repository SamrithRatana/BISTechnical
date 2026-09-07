namespace TechnicalService.Domain;

public class ServiceTelegramMessage
{
    public Guid Id { get; private set; }
    public Guid ServiceId { get; private set; }
    public string TopicKey { get; private set; }
    public int MessageId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    protected ServiceTelegramMessage() { }

    public ServiceTelegramMessage(Guid serviceId, string topicKey, int messageId)
    {
        Id = Guid.NewGuid();
        ServiceId = serviceId;
        TopicKey = topicKey;
        MessageId = messageId;
        CreatedAt = DateTime.UtcNow;
    }

    public void MarkDeleted() => DeletedAt = DateTime.UtcNow;
}
