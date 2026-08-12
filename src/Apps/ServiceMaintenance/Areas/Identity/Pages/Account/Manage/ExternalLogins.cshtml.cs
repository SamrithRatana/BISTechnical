// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.
#nullable disable

using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ServiceMaintenance.Areas.Identity.Pages.Account.Manage
{
    /// <summary>
    /// ✅ DISABLED — this page manages external logins via
    /// UserManager&lt;IdentityUser&gt;/SignInManager&lt;IdentityUser&gt;, but this
    /// application authenticates via a separate JWT API + cookie scheme
    /// ("Cookies") that never creates or populates an AspNetUsers/Identity
    /// record for the signed-in user. As a result:
    ///   - _userManager.GetUserAsync(User) reliably returns null here, so the
    ///     page always 404'd via NotFound(...) — it was already broken.
    ///   - If it somehow succeeded, OnPostLinkLoginAsync/OnGetLinkLoginCallbackAsync
    ///     would create Identity-side state (AspNetUserLogins rows) with no
    ///     relationship to the JWT-based session that actually drives auth,
    ///     which is worse than doing nothing.
    /// Rather than leave a route that either 404s or silently does the wrong
    /// thing, every handler now redirects to the account index / login page.
    /// If external login support is needed, it should be re-built against the
    /// JWT API (the backend must support linking external providers to JWT
    /// user records) rather than against ASP.NET Core Identity directly.
    /// </summary>
    public class ExternalLoginsModel : PageModel
    {
        public IActionResult OnGetAsync() => RedirectToPage("./Index");

        public IActionResult OnPostRemoveLoginAsync(string loginProvider, string providerKey)
            => RedirectToPage("./Index");

        public IActionResult OnPostLinkLoginAsync(string provider)
            => RedirectToPage("./Index");

        public IActionResult OnGetLinkLoginCallbackAsync()
            => RedirectToPage("./Index");
    }
}