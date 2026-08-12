using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace ServiceMaintenance.Infrastructure.Shared.Caching
{
    public class IdempotencyHelper
    {
        private readonly IRedisService _redis;
        private readonly ILogger<IdempotencyHelper> _logger;
        private static readonly TimeSpan DeduplicationExpiry = TimeSpan.FromHours(24);

        public IdempotencyHelper(IRedisService redis, ILogger<IdempotencyHelper> logger)
        {
            _redis = redis;
            _logger = logger;
        }

        /// <summary>
        /// ពិនិត្យថា message នេះ (តាម MessageId) processed រួចហើយឬនៅ
        /// true = processed រួចហើយ → Skip
        /// false = ថ្មី → Process it
        ///
        /// ⚠️ NOTE: នេះជា "check-only" — មិន lock អ្វីទេ។ បើអ្នកចង់ការពារ
        /// concurrent processing ពិតប្រាកដ (2 message handlers ដំណើរការស្រប
        /// ពេលគ្នាសម្រាប់ MessageId ដូចគ្នា) សូមប្រើ TryClaimAsync() ខាងក្រោម
        /// ជំនួស ដែលជា atomic operation តែមួយ។
        /// </summary>
        public async Task<bool> IsAlreadyProcessedAsync(string queue, Guid messageId)
        {
            string key = BuildKey(queue, messageId);
            try
            {
                bool exists = await _redis.ExistsAsync(key);
                if (exists)
                    _logger.LogDebug("⏭️ Duplicate skipped: [{Queue}] MessageId={MessageId}", queue, messageId);
                return exists;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("⚠️ Idempotency check failed [{Queue}]: {Message} — allowing", queue, ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Mark message ថា processed រួចហើយ — Call AFTER successful processing
        /// </summary>
        public async Task MarkAsProcessedAsync(string queue, Guid messageId)
        {
            string key = BuildKey(queue, messageId);
            try
            {
                await _redis.SetAsync(key, "1", DeduplicationExpiry);
                _logger.LogDebug("✅ Marked processed: [{Queue}] MessageId={MessageId}", queue, messageId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("⚠️ Failed to mark processed [{Queue}]: {Message}", queue, ex.Message);
            }
        }

        /// <summary>
        /// ✅ NEW — Atomic "claim" in one round-trip: returns true only for the
        /// FIRST caller for this (queue, messageId). Every subsequent caller
        /// (even if racing concurrently) gets false immediately, with no gap
        /// between check-and-mark like the two-step IsAlreadyProcessedAsync +
        /// MarkAsProcessedAsync pattern has.
        ///
        /// Usage:
        ///   if (!await idempotency.TryClaimAsync(queue, messageId)) return; // duplicate, skip
        ///   // ... do the actual work ...
        ///   // no need to call MarkAsProcessedAsync separately — already marked.
        ///
        /// If processing FAILS after claiming, call ReleaseAsync() so a retry
        /// isn't permanently blocked for 24h.
        /// </summary>
        public async Task<bool> TryClaimAsync(string queue, Guid messageId)
        {
            string key = BuildKey(queue, messageId);
            try
            {
                bool claimed = await _redis.SetIfNotExistsAsync(key, "1", DeduplicationExpiry);
                if (!claimed)
                    _logger.LogDebug("⏭️ Duplicate skipped (atomic): [{Queue}] MessageId={MessageId}", queue, messageId);
                else
                    _logger.LogDebug("✅ Claimed: [{Queue}] MessageId={MessageId}", queue, messageId);
                return claimed;
            }
            catch (Exception ex)
            {
                // Redis unavailable — fail open so message processing isn't blocked,
                // matching the fail-open behavior of IsAlreadyProcessedAsync above.
                _logger.LogWarning("⚠️ Idempotency claim failed [{Queue}]: {Message} — allowing", queue, ex.Message);
                return true;
            }
        }

        /// <summary>
        /// ✅ NEW — Undo a claim so a failed message can be retried instead of
        /// being silently swallowed for the full 24h TTL. Call this from the
        /// catch block if processing fails after TryClaimAsync() returned true.
        /// </summary>
        public async Task ReleaseAsync(string queue, Guid messageId)
        {
            string key = BuildKey(queue, messageId);
            try
            {
                await _redis.DeleteAsync(key);
                _logger.LogDebug("↩️ Released claim: [{Queue}] MessageId={MessageId}", queue, messageId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("⚠️ Failed to release claim [{Queue}]: {Message}", queue, ex.Message);
            }
        }

        // Key: "idempotent:{queue}:{messageId}"
        private static string BuildKey(string queue, Guid messageId)
            => $"idempotent:{queue}:{messageId}";
    }
}