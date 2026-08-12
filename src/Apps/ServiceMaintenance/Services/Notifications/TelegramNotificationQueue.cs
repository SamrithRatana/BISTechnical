using System.Threading.Channels;

namespace ServiceMaintenance.Services.Notifications;

public class TelegramNotificationQueue
{
    private readonly Channel<TelegramMessage> _channel;

    public TelegramNotificationQueue()
    {
        // Bounded capacity + DropOldest: guarantees this channel can NEVER
        // grow unbounded in memory even if Telegram is down for a long time
        // or the worker falls behind — old, less-relevant notifications are
        // dropped first rather than the process's memory growing forever.
        var options = new BoundedChannelOptions(500)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,   // only TelegramBackgroundWorker reads → cheaper, lock-free path
            SingleWriter = false,  // many Blazor circuits/API requests can enqueue concurrently
            AllowSynchronousContinuations = false // never let a slow consumer block the enqueueing request/UI thread
        };
        _channel = Channel.CreateBounded<TelegramMessage>(options);
    }

    public async ValueTask EnqueueAsync(TelegramMessage message, CancellationToken ct = default)
        => await _channel.Writer.WriteAsync(message, ct);

    public IAsyncEnumerable<TelegramMessage> ReadAllAsync(CancellationToken ct)
        => _channel.Reader.ReadAllAsync(ct);
}