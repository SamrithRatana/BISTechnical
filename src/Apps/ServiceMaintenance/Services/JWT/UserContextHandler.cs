using ServiceMaintenance.Services.JWT;

namespace ServiceMaintenance.Services;

public class UserContextHandler : DelegatingHandler
{
    private readonly JwtSessionService _jwtSessionService;

    public UserContextHandler(JwtSessionService jwtSessionService)
    {
        _jwtSessionService = jwtSessionService;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var userId = _jwtSessionService.GetCurrentUserId();
        if (userId.HasValue)
            request.Headers.Add("X-User-Id", userId.Value.ToString());

        var userName = _jwtSessionService.GetCurrentUsername();
        if (!string.IsNullOrWhiteSpace(userName))
            request.Headers.Add("X-User-Name", userName);

        return base.SendAsync(request, cancellationToken);
    }
}