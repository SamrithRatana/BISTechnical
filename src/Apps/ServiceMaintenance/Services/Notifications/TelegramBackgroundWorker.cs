using Microsoft.Extensions.Options;
using ServiceMaintenance.Services.BISServices;
using System.Net.Http.Json;
using System.Text.Json;

namespace ServiceMaintenance.Services.Notifications;

public class TelegramBackgroundWorker : BackgroundService
{
    private readonly TelegramNotificationQueue _queue;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TelegramOptions _options;
    private readonly ILogger<TelegramBackgroundWorker> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    // ✅ Retention window for the ServiceTelegramMessages table. Rows older
    // than this AND already soft-deleted are hard-deleted so the table
    // (and its indexes) don't grow forever — keeps DB memory/cache footprint
    // bounded regardless of how many years the app has been running.
    private static readonly TimeSpan CleanupRetention = TimeSpan.FromDays(90);
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(6);

    public TelegramBackgroundWorker(
        TelegramNotificationQueue queue,
        IHttpClientFactory httpClientFactory,
        IOptions<TelegramOptions> options,
        ILogger<TelegramBackgroundWorker> logger,
        IServiceScopeFactory scopeFactory)
    {
        _queue = queue;
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ✅ Cleanup runs on its own timer, independent of message throughput,
        // so it fires even during quiet periods with no new notifications.
        using var cleanupTimer = new PeriodicTimer(CleanupInterval);
        _ = RunCleanupLoopAsync(cleanupTimer, stoppingToken);

        await foreach (var message in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                // ✅ CHANGED — added SendDocument branch alongside the existing
                // Delete / Send (default) branches.
                switch (message.Action)
                {
                    case TelegramAction.Delete:
                        await DeleteWithRetryAsync(message, stoppingToken);
                        break;
                    case TelegramAction.SendDocument:
                        await SendDocumentWithRetryAsync(message, stoppingToken);
                        break;
                    case TelegramAction.SendPhoto:                              // ✅ NEW
                        await SendPhotoWithRetryAsync(message, stoppingToken);   // ✅ NEW
                        break;
                    case TelegramAction.Edit:                              // ✅ NEW
                        await EditWithRetryAsync(message, stoppingToken);   // ✅ NEW
                        break;
                    default:
                        await SendWithRetryAsync(message, stoppingToken);
                        break;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break; // graceful shutdown, not an error
            }
            catch (Exception ex)
            {
                // ✅ A single bad message must never take down the worker loop —
                // that would silently stop ALL future Telegram notifications
                // (a much worse "leak" than any memory issue).
                _logger.LogError(ex, "Unhandled error processing Telegram message (Action={Action})", message.Action);
            }
        }
    }

    private async Task SendWithRetryAsync(TelegramMessage message, CancellationToken ct)
    {
        const int maxAttempts = 3;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var client = _httpClientFactory.CreateClient("TelegramApi");

                var payload = new Dictionary<string, object>
                {
                    ["chat_id"] = _options.ChatId,
                    ["text"] = message.Text,
                    ["parse_mode"] = message.ParseMode
                };

                if (!string.IsNullOrEmpty(message.TopicKey)
                    && _options.Topics.TryGetValue(message.TopicKey, out var threadId))
                {
                    payload["message_thread_id"] = threadId;
                }
                else if (!string.IsNullOrEmpty(message.TopicKey))
                {
                    // ✅ ADDED — was previously silent; a mismatched TopicKey
                    // used to fall through with no trace, causing messages to
                    // land in General with no indication why.
                    _logger.LogWarning("Telegram TopicKey '{TopicKey}' not found in configured Topics — message will post to General", message.TopicKey);
                }

                using var response = await client.PostAsJsonAsync($"/bot{_options.BotToken}/sendMessage", payload, ct);

                if (response.IsSuccessStatusCode)
                {
                    if (message.ItemId.HasValue && message.ItemId.Value != Guid.Empty)
                    {
                        try
                        {
                            // ✅ Stream + dispose promptly — don't hold the full
                            // response body alive longer than needed.
                            await using var stream = await response.Content.ReadAsStreamAsync(ct);
                            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

                            if (doc.RootElement.TryGetProperty("result", out var result)
                                && result.TryGetProperty("message_id", out var msgIdProp))
                            {
                                int telegramMessageId = msgIdProp.GetInt32();
                                await PersistSentMessageAsync(
                                    message.ItemId.Value, message.TopicKey, telegramMessageId, ct);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to parse/save Telegram message_id");
                        }
                    }
                    return;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }

                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Telegram send failed ({Status}): {Body}", response.StatusCode, body);
                return; // non-429 errors: don't retry
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Telegram send attempt {Attempt} failed", attempt);
                if (attempt == maxAttempts)
                    _logger.LogError(ex, "Telegram send failed after {Max} attempts", maxAttempts);
                else
                    await Task.Delay(TimeSpan.FromMilliseconds(500 * attempt), ct);
            }
        }
    }

    // ✅ NEW — sends a file (PDF/JPG/PNG) via Telegram's sendDocument endpoint.
    // Uses multipart/form-data (required by the Bot API for file uploads,
    // unlike sendMessage's plain JSON). message.FileBytes is only referenced
    // for the duration of this call — once it returns, nothing keeps it
    // alive, so it's eligible for GC immediately like any other local byte[].
    private async Task SendDocumentWithRetryAsync(TelegramMessage message, CancellationToken ct)
    {
        if (message.FileBytes == null || message.FileBytes.Length == 0)
        {
            _logger.LogWarning("Telegram SendDocument skipped — no file bytes provided (ItemId={ItemId})", message.ItemId);
            return;
        }

        const int maxAttempts = 3;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var client = _httpClientFactory.CreateClient("TelegramApi");

                using var form = new MultipartFormDataContent();
                form.Add(new StringContent(_options.ChatId), "chat_id");
                form.Add(new StringContent(message.ParseMode ?? "HTML"), "parse_mode");

                if (!string.IsNullOrEmpty(message.Caption))
                    form.Add(new StringContent(message.Caption), "caption");

                if (!string.IsNullOrEmpty(message.TopicKey)
                    && _options.Topics.TryGetValue(message.TopicKey, out var threadId))
                {
                    form.Add(new StringContent(threadId.ToString()), "message_thread_id");
                }
                else if (!string.IsNullOrEmpty(message.TopicKey))
                {
                    _logger.LogWarning("Telegram TopicKey '{TopicKey}' not found in configured Topics — document will post to General", message.TopicKey);
                }

                var fileName = message.FileName ?? "report.pdf";
                var contentType = fileName.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase)
                    || fileName.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)
                    ? "image/jpeg"
                    : fileName.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
                        ? "image/png"
                        : "application/pdf";

                var fileContent = new ByteArrayContent(message.FileBytes);
                fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
                form.Add(fileContent, "document", fileName);

                using var response = await client.PostAsync($"/bot{_options.BotToken}/sendDocument", form, ct);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Telegram document sent (ItemId={ItemId}, Topic={Topic}, File={File})",
                        message.ItemId, message.TopicKey, fileName);
                    return;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }

                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Telegram sendDocument failed ({Status}): {Body}", response.StatusCode, body);
                return; // non-429 errors: don't retry
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Telegram sendDocument attempt {Attempt} failed", attempt);
                if (attempt == maxAttempts)
                    _logger.LogError(ex, "Telegram sendDocument failed after {Max} attempts", maxAttempts);
                else
                    await Task.Delay(TimeSpan.FromMilliseconds(500 * attempt), ct);
            }
        }
    }
    // ✅ NEW — sends an image via Telegram's sendPhoto endpoint so it renders
    // inline in chat (with Telegram's own compression) instead of as a file
    // attachment. Same retry/topic logic as SendDocumentWithRetryAsync, but
    // field name is "photo" and endpoint is /sendPhoto.
    private async Task SendPhotoWithRetryAsync(TelegramMessage message, CancellationToken ct)
    {
        if (message.FileBytes == null || message.FileBytes.Length == 0)
        {
            _logger.LogWarning("Telegram SendPhoto skipped — no file bytes provided (ItemId={ItemId})", message.ItemId);
            return;
        }

        const int maxAttempts = 3;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var client = _httpClientFactory.CreateClient("TelegramApi");

                using var form = new MultipartFormDataContent();
                form.Add(new StringContent(_options.ChatId), "chat_id");
                form.Add(new StringContent(message.ParseMode ?? "HTML"), "parse_mode");

                if (!string.IsNullOrEmpty(message.Caption))
                    form.Add(new StringContent(message.Caption), "caption");

                if (!string.IsNullOrEmpty(message.TopicKey)
                    && _options.Topics.TryGetValue(message.TopicKey, out var threadId))
                {
                    form.Add(new StringContent(threadId.ToString()), "message_thread_id");
                }
                else if (!string.IsNullOrEmpty(message.TopicKey))
                {
                    _logger.LogWarning("Telegram TopicKey '{TopicKey}' not found in configured Topics — photo will post to General", message.TopicKey);
                }

                var fileName = message.FileName ?? "report.png";
                var fileContent = new ByteArrayContent(message.FileBytes);
                fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
                form.Add(fileContent, "photo", fileName); // ✅ field name "photo", not "document"

                using var response = await client.PostAsync($"/bot{_options.BotToken}/sendPhoto", form, ct); // ✅ endpoint /sendPhoto

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Telegram photo sent (ItemId={ItemId}, Topic={Topic}, File={File})",
                        message.ItemId, message.TopicKey, fileName);
                    return;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }

                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Telegram sendPhoto failed ({Status}): {Body}", response.StatusCode, body);
                return; // non-429 errors: don't retry
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Telegram sendPhoto attempt {Attempt} failed", attempt);
                if (attempt == maxAttempts)
                    _logger.LogError(ex, "Telegram sendPhoto failed after {Max} attempts", maxAttempts);
                else
                    await Task.Delay(TimeSpan.FromMilliseconds(500 * attempt), ct);
            }
        }
    }
    // ✅ NEW — edits the text of an already-sent message in place, instead of
    // sending a new one. Reuses the same MessageId-resolution logic as
    // DeleteWithRetryAsync (either an explicit message.MessageId, or resolved
    // via GetLiveTelegramMessageIdAsync when ResolveMessageIdFromTopic is set).
    // Telegram's editMessageText does not trigger a push notification the way
    // sendMessage does, so this also satisfies "no repeat alert" for free.
    private async Task EditWithRetryAsync(TelegramMessage message, CancellationToken ct)
    {
        int? messageId = message.MessageId;

        if (!messageId.HasValue && message.ResolveMessageIdFromTopic
            && message.ItemId.HasValue && !string.IsNullOrEmpty(message.TopicKey))
        {
            const int maxResolveAttempts = 5;

            for (int attempt = 1; attempt <= maxResolveAttempts && !messageId.HasValue; attempt++)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var repairItemService = scope.ServiceProvider.GetRequiredService<RepairItemService>();
                    messageId = await repairItemService.GetLiveTelegramMessageIdAsync(
                        message.ItemId.Value, message.TopicKey);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to resolve MessageId for edit, attempt {Attempt}/{Max} (ItemId={ItemId}, Topic={Topic})",
                        attempt, maxResolveAttempts, message.ItemId, message.TopicKey);
                }

                if (!messageId.HasValue && attempt < maxResolveAttempts)
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
            }
        }

        if (!messageId.HasValue)
        {
            // ✅ Fallback: if there's nothing to edit (e.g. the original message
            // was never sent, or was already deleted), fall back to sending a
            // fresh message so the remark is never silently lost.
            _logger.LogWarning("Telegram edit skipped — no MessageId resolved, falling back to Send (ItemId={ItemId}, Topic={Topic})",
                message.ItemId, message.TopicKey);
            await SendWithRetryAsync(message, ct);
            return;
        }

        const int maxAttempts = 3;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var client = _httpClientFactory.CreateClient("TelegramApi");

                var payload = new Dictionary<string, object>
                {
                    ["chat_id"] = _options.ChatId,
                    ["message_id"] = messageId.Value,
                    ["text"] = message.Text,
                    ["parse_mode"] = message.ParseMode
                };

                using var response = await client.PostAsJsonAsync($"/bot{_options.BotToken}/editMessageText", payload, ct);

                if (response.IsSuccessStatusCode)
                    return;

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }

                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Telegram edit failed ({Status}): {Body}", response.StatusCode, body);

                // ✅ If the message content is identical, Telegram returns 400
                // "message is not modified" — that's not a real failure, treat as success.
                if (body.Contains("message is not modified", StringComparison.OrdinalIgnoreCase))
                    return;

                // ✅ If the original message no longer exists (deleted/too old to
                // edit), fall back to sending fresh rather than losing the update.
                if (body.Contains("message to edit not found", StringComparison.OrdinalIgnoreCase))
                {
                    await SendWithRetryAsync(message, ct);
                    return;
                }

                return; // other non-429 errors: don't retry
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Telegram edit attempt {Attempt} failed", attempt);
                if (attempt == maxAttempts)
                    _logger.LogError(ex, "Telegram edit failed after {Max} attempts", maxAttempts);
                else
                    await Task.Delay(TimeSpan.FromMilliseconds(500 * attempt), ct);
            }
        }
    }
    private async Task DeleteWithRetryAsync(TelegramMessage message, CancellationToken ct)
    {
        int? messageId = message.MessageId; // ✅ ឥឡូវនេះជា null ពិតប្រាកដ ពេលមិន set
        Guid? resolvedRowServiceId = message.ItemId;
        string resolvedTopicKey = message.TopicKey;

        // Fallback path: resolve MessageId now via the child table, with retry
        // to survive the race where Delete is dequeued before the matching
        // Send has finished persisting its row.
        if (!messageId.HasValue && message.ResolveMessageIdFromTopic
            && message.ItemId.HasValue && !string.IsNullOrEmpty(message.TopicKey))
        {
            const int maxResolveAttempts = 5;

            for (int attempt = 1; attempt <= maxResolveAttempts && !messageId.HasValue; attempt++)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var repairItemService = scope.ServiceProvider.GetRequiredService<RepairItemService>();
                    messageId = await repairItemService.GetLiveTelegramMessageIdAsync(
                        message.ItemId.Value, message.TopicKey);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to resolve MessageId for delete, attempt {Attempt}/{Max} (ItemId={ItemId}, Topic={Topic})",
                        attempt, maxResolveAttempts, message.ItemId, message.TopicKey);
                }

                if (!messageId.HasValue && attempt < maxResolveAttempts)
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct); // 2s, 4s, 6s, 8s
            }
        }

        if (!messageId.HasValue)
        {
            _logger.LogWarning("Telegram delete skipped — no MessageId resolved after retries (ItemId={ItemId}, Topic={Topic})",
                message.ItemId, message.TopicKey);
            return;
        }

        const int maxAttempts = 3;
        bool deletedOnTelegram = false;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var client = _httpClientFactory.CreateClient("TelegramApi");

                var payload = new Dictionary<string, object>
                {
                    ["chat_id"] = _options.ChatId,
                    ["message_id"] = messageId.Value
                };

                using var response = await client.PostAsJsonAsync($"/bot{_options.BotToken}/deleteMessage", payload, ct);

                if (response.IsSuccessStatusCode)
                {
                    deletedOnTelegram = true;
                    break;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }

                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Telegram delete failed ({Status}): {Body}", response.StatusCode, body);

                if (body.Contains("message to delete not found", StringComparison.OrdinalIgnoreCase))
                    deletedOnTelegram = true;

                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Telegram delete attempt {Attempt} failed", attempt);
                if (attempt == maxAttempts)
                    _logger.LogError(ex, "Telegram delete failed after {Max} attempts", maxAttempts);
                else
                    await Task.Delay(TimeSpan.FromMilliseconds(500 * attempt), ct);
            }
        }

        if (deletedOnTelegram)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repairItemService = scope.ServiceProvider.GetRequiredService<RepairItemService>();
                await repairItemService.MarkTelegramMessageDeletedAsync(messageId.Value);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to mark ServiceTelegramMessage as deleted for MessageId={MessageId}", messageId);
            }
        }
    }

    private async Task PersistSentMessageAsync(Guid serviceId, string topicKey, int telegramMessageId, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repairItemService = scope.ServiceProvider.GetRequiredService<RepairItemService>();
            await repairItemService.SaveTelegramMessageAsync(serviceId, topicKey ?? "Unknown", telegramMessageId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to save Telegram message_id for item {ItemId}", serviceId);
        }
    }

    // ✅ Periodic cleanup — keeps ServiceTelegramMessages from growing forever.
    // Only removes rows that are ALREADY soft-deleted (DeletedAt set) and
    // older than the retention window, so live/undeleted rows are never
    // touched regardless of age.
    private async Task RunCleanupLoopAsync(PeriodicTimer timer, CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken))
                    break;

                using var scope = _scopeFactory.CreateScope();
                var repairItemService = scope.ServiceProvider.GetRequiredService<RepairItemService>();
                var cutoff = DateTime.UtcNow - CleanupRetention;
                var removed = await repairItemService.PurgeOldTelegramMessageRecordsAsync(cutoff, stoppingToken);

                if (removed > 0)
                    _logger.LogInformation("Telegram message cleanup: purged {Count} old records older than {Cutoff}", removed, cutoff);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Telegram message cleanup cycle failed");
            }
        }
    }
}