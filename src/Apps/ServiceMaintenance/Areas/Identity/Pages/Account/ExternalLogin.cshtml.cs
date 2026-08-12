// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.
#nullable disable

using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ServiceMaintenance.Areas.Identity.Pages.Account
{
    /// <summary>
    /// ✅ DISABLED — this app signs users in via a JWT API + the "Cookies"
    /// authentication scheme (see LoginModel.cs), not ASP.NET Core Identity.
    /// This page's SignInManager&lt;IdentityUser&gt;/UserManager&lt;IdentityUser&gt;
    /// calls create sign-in state under Identity's own scheme
    /// ("Identity.External" / "Identity.Application"), completely disconnected
    /// from the JWT session the rest of the app relies on — a user who
    /// completed this flow would end up with a cookie that most of the app
    /// doesn't recognize as authenticated.
    ///
    /// There are no external-login buttons wired up in Login.cshtml, so this
    /// route shouldn't normally be reached, but every handler now redirects
    /// to plain Login instead of running the mismatched Identity flow, in
    /// case the route is ever hit directly.
    ///
    /// To support real external login (Google/Facebook/etc.), this needs to
    /// be rebuilt against the JWT API so a successful external login results
    /// in a JWT token + the same "Cookies" scheme sign-in as normal login.
    /// </summary>
    [AllowAnonymous]
    public class ExternalLoginModel : PageModel
    {
        public IActionResult OnGet() => RedirectToPage("./Login");

        public IActionResult OnPost(string provider, string returnUrl = null)
            => RedirectToPage("./Login", new { returnUrl });

        public Task<IActionResult> OnGetCallbackAsync(string returnUrl = null, string remoteError = null)
            => Task.FromResult<IActionResult>(RedirectToPage("./Login", new { returnUrl }));

        public Task<IActionResult> OnPostConfirmationAsync(string returnUrl = null)
            => Task.FromResult<IActionResult>(RedirectToPage("./Login", new { returnUrl }));
    }
}