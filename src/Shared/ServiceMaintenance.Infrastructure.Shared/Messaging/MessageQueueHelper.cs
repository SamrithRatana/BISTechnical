using System;
using System.Threading.Tasks;

namespace ServiceMaintenance.Infrastructure.Shared.Messaging;

public enum QueueAction
{
    Create,
    Update,
    Delete,
    StatusChange
}

public class QueueMessage
{
    public string MessageId { get; set; } = Guid.NewGuid().ToString();
    public string EntityId { get; set; } = string.Empty;
    public string ReportNo { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class MessageQueueHelper
{
    public static class Queues
    {
        public const string ReceiveItem = "receive-item";
        public const string AwaitCustomer = "await-customer";
        public const string AwaitSparePart = "await-spare-part";
        public const string InspectItem = "inspect-item";
        public const string InspectionItem = "inspection-item";
        public const string RepairItem = "repair-item";
        public const string FinishItem = "finish-item";
        public const string SparePart = "spare-part";
        public const string ItemModule = "item-module";
        public const string Order = "order";
    }

    public Task PublishCreateAsync(object? queueName = null, object? entityId = null, object? reportNo = null, object? extra = null, object? arg5 = null, object? arg6 = null) => Task.CompletedTask;
    public Task PublishUpdateAsync(object? queueName = null, object? entityId = null, object? reportNo = null, object? extra = null, object? arg5 = null, object? arg6 = null) => Task.CompletedTask;
    public Task PublishDeleteAsync(object? queueName = null, object? entityId = null, object? extra = null, object? arg4 = null, object? arg5 = null, object? arg6 = null) => Task.CompletedTask;
    public Task PublishStatusChangeAsync(object? queueName = null, object? entityId = null, object? reportNo = null, object? status = null, object? newStatus = null, object? context = null, object? arg7 = null) => Task.CompletedTask;
    public Task PublishAsync(object? queueName = null, object? action = null, object? entityId = null, object? reportNo = null, object? status = null, object? arg6 = null) => Task.CompletedTask;
}
