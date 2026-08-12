using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using ServiceMaintenance.Models;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.JWT
{
    /// <summary>
    /// ⚠️ This class previously handled SignalR notifications and article
    /// visibility updates. Those responsibilities have been removed along
    /// with the IHubContext and GlobalArticleCacheService dependencies.
    /// If you still need to notify clients of create/update/delete actions,
    /// you'll need to reintroduce a hub context (or another mechanism) and
    /// rebuild the corresponding methods.
    /// </summary>
    public class StateManagementAction
    {
        private readonly AuthenticationStateProvider _authenticationStateProvider;
        private readonly NavigationManager _navigationManager;
        private readonly ILogger<StateManagementAction> _logger;

        public StateManagementAction(
            AuthenticationStateProvider authenticationStateProvider,
            NavigationManager navigationManager,
            ILogger<StateManagementAction> logger)
        {
            _authenticationStateProvider = authenticationStateProvider;
            _navigationManager = navigationManager;
            _logger = logger;
        }
    }
}