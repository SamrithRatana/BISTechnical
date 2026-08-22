using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using UserManagementAPI.Data;

namespace UserManagementAPI.Authorization
{
    /// <summary>
    /// Requires the caller to hold a specific "Permission" claim through one of
    /// their roles.
    /// </summary>
    /// <remarks>
    /// NOTE: nothing in this API currently uses this. Neither the
    /// "PermissionPolicy" registered in Program.cs nor
    /// <see cref="RequirePermissionAttribute"/> is applied to a single endpoint,
    /// so the permissions managed by PermissionManagementController are enforced
    /// only by the frontend hiding UI. See the review notes.
    /// </remarks>
    public class PermissionRequirement : IAuthorizationRequirement
    {
        public string Permission { get; }

        public PermissionRequirement(string permission)
        {
            Permission = permission;
        }
    }

    public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
    {
        private readonly UserManagementContext _context;

        public PermissionAuthorizationHandler(UserManagementContext context)
        {
            _context = context;
        }

        protected override async Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            PermissionRequirement requirement)
        {
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                context.Fail();
                return;
            }

            // One query joining the user's roles to their permission claims.
            // This used to load the user, call GetRolesAsync, then for EVERY
            // role issue a FindByNameAsync plus a GetClaimsAsync - so an
            // authorisation check on a user with four roles cost nine round
            // trips, on every request that used it.
            var hasPermission = await _context.UserRoles
                .Where(ur => ur.UserId == userId)
                .Join(_context.RoleClaims,
                    ur => ur.RoleId,
                    rc => rc.RoleId,
                    (ur, rc) => rc)
                .AnyAsync(rc => rc.ClaimType == "Permission" && rc.ClaimValue == requirement.Permission);

            if (hasPermission)
            {
                context.Succeed(requirement);
                return;
            }

            context.Fail();
        }
    }

    // Custom attribute for easier use
    public class RequirePermissionAttribute : TypeFilterAttribute
    {
        public RequirePermissionAttribute(string permission) : base(typeof(PermissionFilter))
        {
            Arguments = new object[] { new PermissionRequirement(permission) };
        }
    }

    public class PermissionFilter : IAsyncAuthorizationFilter
    {
        private readonly IAuthorizationService _authorizationService;
        private readonly PermissionRequirement _requirement;

        public PermissionFilter(
            IAuthorizationService authorizationService,
            PermissionRequirement requirement)
        {
            _authorizationService = authorizationService;
            _requirement = requirement;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            // An anonymous caller has not been refused the resource, they have
            // not identified themselves: that is a 401, and it tells the client
            // to authenticate rather than to give up. Returning Forbid for both
            // cases made a missing token indistinguishable from a real denial.
            if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var result = await _authorizationService.AuthorizeAsync(
                context.HttpContext.User,
                null,
                _requirement);

            if (!result.Succeeded)
            {
                context.Result = new ForbidResult();
            }
        }
    }
}
