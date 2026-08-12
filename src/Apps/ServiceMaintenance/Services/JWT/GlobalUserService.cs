using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.JWT
{
    /// <summary>
    /// ✅ OPTIMIZED: Efficient User Service with Memory Caching
    ///
    /// ✅ TTL INCREASED: 30 minutes -> 24 hours.
    /// User data (name, email, role, phone) rarely changes, so a short TTL
    /// only causes unnecessary API crawls without any real benefit. Instead
    /// of relying on a short TTL to keep data "fresh", freshness is now
    /// guaranteed by INVALIDATING the cache immediately whenever a user is
    /// created, updated, or deleted (see InvalidateUser() / ClearCache()
    /// below). This gives you both: fast reads (cache almost always hits)
    /// AND correctness (no stale data after a real change).
    ///
    /// ✅ GetUsersAsync() and GetUsersWithDetailsAsync() share a single
    /// private crawl (LoadAllUsersFromApiAsync) so they don't each hit the
    /// API separately for the same data.
    ///
    /// ✅ The load lock is STATIC. GlobalUserService is typically resolved
    /// per-scope (e.g. one instance inside LoginModel's background Task.Run
    /// scope, a different instance inside the Blazor circuit's scope). An
    /// instance-level SemaphoreSlim can't coordinate between two different
    /// instances of the same class, so both could pass the "cache miss"
    /// check at nearly the same time and both crawl the API. A static lock
    /// is shared by every instance in the process, so concurrent callers -
    /// regardless of which DI scope resolved them - correctly queue behind
    /// one crawl and then read from cache.
    /// </summary>
    public class GlobalUserService
    {
        private readonly JwtUserManagementService _jwtUserManagementService;
        private readonly ILogger<GlobalUserService> _logger;
        private readonly IMemoryCache _cache;

        // ✅ STATIC - shared across ALL instances/DI scopes of GlobalUserService
        private static readonly SemaphoreSlim _loadLock = new SemaphoreSlim(1, 1);

        private const string USERS_CACHE_KEY = "global_users_dict";
        private const string USERS_DETAILS_CACHE_KEY = "global_users_details";

        // ✅ CHANGED: 30 minutes -> 24 hours.
        // User list/details rarely change, so a long TTL is safe as long as
        // every write path (create/update/delete user) calls
        // InvalidateUser()/ClearCache() immediately after the write succeeds.
        private const int CACHE_DURATION_MINUTES = 24 * 60; // 1440 minutes = 24 hours

        public GlobalUserService(
            JwtUserManagementService jwtUserManagementService,
            ILogger<GlobalUserService> logger,
            IMemoryCache cache)
        {
            _jwtUserManagementService = jwtUserManagementService ?? throw new ArgumentNullException(nameof(jwtUserManagementService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        }

        public class UserFullInfo
        {
            public string Id { get; set; }
            public string UserName { get; set; }
            public string Email { get; set; }
            public string FullName { get; set; }
            public string FirstName { get; set; }
            public string LastName { get; set; }
            public string PhoneNumber { get; set; }
            public List<string> Roles { get; set; } = new();
            public bool EmailConfirmed { get; set; }
            public bool IsLocked { get; set; }
        }

        /// <summary>
        /// ✅ Get all users as dictionary - uses cache
        /// </summary>
        public async Task<Dictionary<string, string>> GetUsersAsync(bool forceRefresh = false)
        {
            if (!forceRefresh && _cache.TryGetValue(USERS_CACHE_KEY, out Dictionary<string, string> cached))
            {
                _logger.LogDebug($"✅ Returning {cached.Count} users from cache");
                return cached;
            }

            var (dict, _) = await LoadAllUsersFromApiAsync(forceRefresh);
            return dict;
        }

        /// <summary>
        /// ✅ Get all users with full details - uses cache
        /// </summary>
        public async Task<Dictionary<string, UserFullInfo>> GetUsersWithDetailsAsync(bool forceRefresh = false)
        {
            if (!forceRefresh && _cache.TryGetValue(USERS_DETAILS_CACHE_KEY, out Dictionary<string, UserFullInfo> cached))
            {
                _logger.LogDebug($"✅ Returning {cached.Count} user details from cache");
                return cached;
            }

            var (_, details) = await LoadAllUsersFromApiAsync(forceRefresh);
            return details;
        }

        /// <summary>
        /// ✅ Single shared crawl of the Users API.
        /// Populates BOTH the simple id→name dictionary and the full-details
        /// dictionary from one paginated pass, instead of two independent passes.
        /// Uses a STATIC lock so concurrent callers across different DI scopes
        /// (e.g. login warm-up task vs. page render) share one API call instead
        /// of racing each other.
        /// </summary>
        private async Task<(Dictionary<string, string> dict, Dictionary<string, UserFullInfo> details)> LoadAllUsersFromApiAsync(bool forceRefresh)
        {
            await _loadLock.WaitAsync();
            try
            {
                // Double-check after acquiring lock — another caller (possibly a
                // different GlobalUserService instance in a different scope) may
                // have just finished loading.
                if (!forceRefresh
                    && _cache.TryGetValue(USERS_CACHE_KEY, out Dictionary<string, string> cachedDict)
                    && _cache.TryGetValue(USERS_DETAILS_CACHE_KEY, out Dictionary<string, UserFullInfo> cachedDetails))
                {
                    _logger.LogDebug("✅ Cache populated while waiting for lock - skipping API crawl");
                    return (cachedDict, cachedDetails);
                }

                _logger.LogInformation("📥 Loading users from API...");

                var allUsers = new List<UserDto>();
                int currentPage = 1;
                int pageSize = 100;
                bool hasMorePages = true;

                while (hasMorePages)
                {
                    var usersResponse = await _jwtUserManagementService.GetAllUsersAsync(
                        page: currentPage,
                        pageSize: pageSize
                    );

                    if (usersResponse?.Status == "Success" && usersResponse.Data != null && usersResponse.Data.Any())
                    {
                        allUsers.AddRange(usersResponse.Data);
                        _logger.LogDebug($"Loaded {usersResponse.Data.Count} users from page {currentPage}");
                        hasMorePages = usersResponse.Pagination?.HasNext ?? false;
                        currentPage++;
                    }
                    else
                    {
                        hasMorePages = false;
                    }
                }

                if (!allUsers.Any())
                {
                    _logger.LogWarning("No users loaded from API");
                    return (new Dictionary<string, string>(), new Dictionary<string, UserFullInfo>());
                }

                var userDictionary = allUsers.ToDictionary(
                    u => u.Id,
                    u => $"{u.FirstName} {u.LastName}".Trim()
                );

                var userDetails = allUsers.ToDictionary(
                    u => u.Id,
                    u => new UserFullInfo
                    {
                        Id = u.Id,
                        UserName = u.UserName,
                        Email = u.Email,
                        FullName = $"{u.FirstName} {u.LastName}".Trim(),
                        FirstName = u.FirstName,
                        LastName = u.LastName,
                        PhoneNumber = u.PhoneNumber ?? "N/A",
                        Roles = u.Roles ?? new List<string>(),
                        EmailConfirmed = u.EmailConfirmed,
                        IsLocked = u.IsLocked
                    }
                );

                // ✅ Cache both for 24 hours from a single crawl
                var expiry = TimeSpan.FromMinutes(CACHE_DURATION_MINUTES);
                _cache.Set(USERS_CACHE_KEY, userDictionary, expiry);
                _cache.Set(USERS_DETAILS_CACHE_KEY, userDetails, expiry);

                _logger.LogInformation($"✅ Loaded and cached {userDictionary.Count} users (dict + details) from a single API crawl. TTL = {CACHE_DURATION_MINUTES} minutes");

                return (userDictionary, userDetails);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading users from API");
                return (new Dictionary<string, string>(), new Dictionary<string, UserFullInfo>());
            }
            finally
            {
                _loadLock.Release();
            }
        }

        /// <summary>
        /// ✅ OPTIMIZED: Get user name by ID - uses cache
        /// </summary>
        public async Task<string> GetUserNameByIdAsync(Guid? userId)
        {
            if (!userId.HasValue || userId.Value == Guid.Empty)
            {
                return "Unknown User";
            }

            try
            {
                string userIdString = userId.Value.ToString();

                var users = await GetUsersAsync(forceRefresh: false);

                if (users.TryGetValue(userIdString, out string userName))
                {
                    return userName;
                }

                _logger.LogDebug($"Cache miss for user {userIdString}, loading from API");

                var userResponse = await _jwtUserManagementService.GetUserByIdAsync(userIdString);

                if (userResponse?.Status == "Success" && userResponse.Data != null)
                {
                    var name = $"{userResponse.Data.FirstName} {userResponse.Data.LastName}".Trim();

                    users[userIdString] = name;
                    _cache.Set(USERS_CACHE_KEY, users, TimeSpan.FromMinutes(CACHE_DURATION_MINUTES));

                    return name;
                }

                _logger.LogWarning($"User not found: {userIdString}");
                return "Unknown User";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user name for {userId}");
                return "Error";
            }
        }

        /// <summary>
        /// Synchronous version - for compatibility
        /// </summary>
        public string GetUserNameById(Guid? userId)
        {
            return GetUserNameByIdAsync(userId).GetAwaiter().GetResult();
        }

        /// <summary>
        /// ✅ Get user phone number - uses cache
        /// </summary>
        public async Task<string> GetUserPhoneNumberByIdAsync(Guid? userId, bool autoLoad = true)
        {
            if (!userId.HasValue || userId.Value == Guid.Empty)
            {
                return "N/A";
            }

            try
            {
                string userIdString = userId.Value.ToString();

                var usersDetails = await GetUsersWithDetailsAsync(forceRefresh: false);

                if (usersDetails.TryGetValue(userIdString, out var userInfo))
                {
                    return userInfo.PhoneNumber ?? "N/A";
                }

                var userResponse = await _jwtUserManagementService.GetUserByIdAsync(userIdString);

                if (userResponse?.Status == "Success" && userResponse.Data != null)
                {
                    return userResponse.Data.PhoneNumber ?? "N/A";
                }

                return "N/A";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting phone number for {userId}");
                return "Error";
            }
        }

        /// <summary>
        /// ✅ Refresh cache - loads fresh data (single crawl now, not two)
        /// Use this for a full, immediate reload (e.g. an admin "Refresh Users"
        /// button). For a single user changing, prefer InvalidateUser() below,
        /// which is cheaper (no crawl now - next reader triggers exactly one
        /// crawl, lazily).
        /// </summary>
        public async Task RefreshUsersAsync()
        {
            _logger.LogInformation("🔄 Refreshing user cache...");
            await LoadAllUsersFromApiAsync(forceRefresh: true);
            _logger.LogInformation("✅ User cache refreshed");
        }

        /// <summary>
        /// ✅ Clear cache - forces reload on next access.
        /// Call this from any Create/Update/Delete user flow immediately
        /// after the write succeeds, so the long 24h TTL never serves stale
        /// data. The next caller (login warm-up, page render, etc.) will
        /// transparently trigger exactly one fresh crawl via the static lock.
        /// </summary>
        public void ClearCache()
        {
            _cache.Remove(USERS_CACHE_KEY);
            _cache.Remove(USERS_DETAILS_CACHE_KEY);
            _logger.LogInformation("🗑️ User cache cleared");
        }

        /// <summary>
        /// ✅ NEW: Invalidate cache after a single user was created, updated,
        /// or deleted. Semantically the same as ClearCache() today (both
        /// dictionaries are all-or-nothing), but named for the call site so
        /// intent is clear at the point of use:
        ///
        ///   await _userManagementService.UpdateUserAsync(id, dto);
        ///   _globalUserCache.InvalidateUser(id); // <-- keep cache correct
        ///
        /// If you later want surgical (per-user) invalidation instead of
        /// clearing the whole cache, this is the method to extend - e.g.
        /// remove just `userId` from the cached dictionaries in place instead
        /// of calling ClearCache().
        /// </summary>
        public void InvalidateUser(string userId)
        {
            // Simple + safe: clear both caches so the next read does one
            // fresh crawl and every consumer (dict + details) stays in sync.
            ClearCache();
            _logger.LogInformation($"🗑️ Cache invalidated after change to user {userId}");
        }
    }
}