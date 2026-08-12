# ServiceMaintenance — Index (root, Areas, Components, Controllers, Shared, Models, ViewModel, Authentication, Middleware, Configuration, Resources)

This is the legacy Blazor Server UI for the service maintenance app (old full-stack side, see repo-root CLAUDE.md). `Program.cs` is the entry point — read it directly for the full DI/middleware wiring (JWT + cookie auth, EF Core contexts, DevExpress/Syncfusion/SignalR/session/localization setup, response caching/compression, CORS, Kestrel limits, and the full HTTP-pipeline order down to `app.Run()`). `Pages/` and `Services/` are documented separately at `Pages/CLAUDE.md` and `Services/CLAUDE.md` — not covered here.

Namespace root: `ServiceMaintenance` (Areas/Identity legacy pieces are split between `ServiceMaintenance.Areas.Identity` and `BlazorServer.Areas.Identity`, see below).

---

## Root-level files

- `src/Apps/ServiceMaintenance/Program.cs` — app entry point / composition root.
  - Top-level statements build `WebApplication`, register: Redis/memory cache, JWT auth (cookie default scheme + JWT bearer scheme for SignalR), EF Core (`UserManagementContext`, `TechnicalServiceContext`), Identity core, DataProtection (keys persisted to `/app/servicemaintenance/dataprotection-keys`), Razor Pages/Components, Blazor Server, DevExpress Blazor + Reporting, Syncfusion Blazor, SignalR, localization (`en-US`/`km-KH` via `RequestLocalizationOptions`, cookie-based), session, response caching/compression, typed `HttpClient`s (Polly retry+timeout), Kestrel limits (2GB max body, HTTP/1.1 only), form options (5GB multipart), CORS policy `"JwtCorsPolicy"`.
  - Middleware pipeline order: exception handler/HSTS (prod) or dev exception page → `UseWebSockets` → `UseRequestLocalization` (must run before any component renders) → response compression (prod) → response caching → static files → routing → CORS → session → authentication → authorization → `TokenExpiryMiddleware` → SignalR hub maps → Razor Pages/Controllers/BlazorHub/fallback to `_Host`.
  - `ConfigureJwtServices(IServiceCollection)` — registers `JwtSessionService`, `JwtHttpClientService`, `JwtApiService`, `JwtUserManagementService`, `GlobalUserService`, `UserService`.
  - `ConfigureApplicationServices(IServiceCollection)` — registers `MenuService`, `RolesService`, `PermissionService`, `StateManagementAction`, `SignalRService`, `MonthlyReportService`, `R2StorageService` (singleton), `KoompiStorageService`, `SparepartUsageService`, `SparepartHoldService`, `PrintPreviewService`, `ItemHubConnectionService`, plus `AddUserActivityBackgroundService()`.
  - `ConfigureHttpClients(IServiceCollection)` — registers ~19 typed `HttpClient`s (one per domain service, e.g. `ItemService`, `RepairItemService`, `RentalItemService`, `CustomerService`) via `AddHttpClientWithPolicy<T>`, pointed at `TechnicalServicesBaseUrl` or `CustomerApiBaseUrl`.
  - `AddHttpClientWithPolicy<T>(IServiceCollection, string baseUrl)` — shared typed-client factory: JSON accept headers, gzip/deflate/br, dev-only cert bypass, retry+timeout policies, 2-min handler lifetime.
  - `GetRetryPolicy()` — Polly policy: 2 retries on transient HTTP errors/429, exponential-ish backoff (`300ms * attempt`).
  - SignalR hubs mapped: `/itemHub` → `ItemHub`, `/chathub` → `NotificationHub` (both defined under `Services/`, not here).
- `src/Apps/ServiceMaintenance/App.razor` — root Blazor component. `CascadingAuthenticationState` → `Router` → `AuthorizeRouteView` with `MainLayout` as default layout; `NotAuthorized` block is a no-op (redirect line commented out); `NotFound` shows a plain message. Culture is now set entirely server-side via `Program.cs`'s `UseRequestLocalization` (old client-side `OnAfterRenderAsync` culture-setting code was removed — see inline comment for the race it used to cause).
- `src/Apps/ServiceMaintenance/_Imports.razor` — global `@using`s for all Razor components in this project (DevExpress, Syncfusion, Radzen, `ServiceMaintenance.*` namespaces). `@inherits PermissionBase` is applied to every component by default (see `Pages/CLAUDE.md` or `Services/CLAUDE.md` for `PermissionBase`).
- `src/Apps/ServiceMaintenance/ResourceStrings.cs` — `public enum ResourceStrings` in namespace `ServiceMaintenance`; ~170 members, one per localized UI string key (e.g. `TextHome`, `TextCreate`, `TextRepairServiceTracker`). Used as `Loc[nameof(ResourceStrings.XXX)]` against `IStringLocalizer<App>`, resolved from `Resources/App.*.resx`.
- `ServiceMaintenance.csproj` / `.csproj.Backup.tmp` / `.csproj.user` / `DxBlazorApplication1.csproj.bak` — project files (`.bak`/`.Backup.tmp`/`.user` are stale/generated, not authoritative).
- `appsettings.json`, `appsettings.Development.json` — connection strings (`UserManagementConnection`, `TechnicalServiceConnectionString`), JWT config (`JWT:Secret`, `JWT:ValidIssuer`, `JWT:ValidAudience`, `JWT:TokenValidityInHours`), `JwtApi:BaseUrl`.
- `NOTICE.txt`, `ScaffoldingReadMe.txt`, `readme.html` — vendor/scaffold boilerplate, not project docs.
- `wwwroot/` — static assets (css/js/images/lib); not enumerated here.
- Skipped per scope: `bin/`, `obj/`, `Properties/launchSettings.json`, `dataprotection-keys/`, `keys/`, `uploads/`.

---

## Controllers/ (1 file)

- `src/Apps/ServiceMaintenance/Controllers/HomeController.cs` — `ServiceMaintenance.Controllers.HomeController : Controller`. Minimal MVC controller backing the default route (`{controller=Home}/{action=Index}/{id?}`), mostly superseded by the Blazor Router/`_Host` fallback.
  - `Index()` — returns default `View()`.
  - `Privacy()` — returns default `View()`.
  - `Error()` — `[ResponseCache(NoStore=true)]`; returns `View(new ErrorViewModel { RequestId = ... })`.

---

## Middleware/ (1 file)

- `src/Apps/ServiceMaintenance/Middleware/TokenExpiryMiddleware.cs` — `ServiceMaintenance.Middleware.TokenExpiryMiddleware`. Registered via `app.UseMiddleware<TokenExpiryMiddleware>()` after `UseAuthorization`. Checks JWT expiry on every authenticated request (skips `/identity/account/login|register|logout`, `/lib/`, `/css/`, `/js/`, `/favicon`).
  - `InvokeAsync(HttpContext, JwtSessionService)` — if `jwtSession.ShouldLogoutDueToExpiry()`: clears tokens, then for `/api/*` paths returns 401 JSON (`TOKEN_EXPIRED`), otherwise redirects to `/Identity/Account/Login?expired=true`.

---

## Authentication/ (1 file)

- `src/Apps/ServiceMaintenance/Authentication/JwtAuthenticationStateProvider.cs` — `ServiceMaintenance.Authentication.JwtAuthenticationStateProvider : AuthenticationStateProvider`. Registered as the app's `AuthenticationStateProvider` (replaces `RevalidatingIdentityAuthenticationStateProvider<ApplicationUser>`). Drives Blazor's `<AuthorizeView>`/`[Authorize]` based on the session-stored JWT rather than ASP.NET Identity.
  - `GetAuthenticationStateAsync()` — reads token from `JwtSessionService`; returns anonymous state if missing/expired; otherwise parses claims and returns authenticated `AuthenticationState`.
  - `NotifyUserAuthentication(string token)` — call after login; parses claims and raises `NotifyAuthenticationStateChanged`.
  - `NotifyUserLogout()` — raises change with an anonymous principal.
  - `ParseClaimsFromJwt(string jwt)` (private) — decodes JWT via `JwtSecurityTokenHandler`, backfills `ClaimTypes.Name`/`NameIdentifier`/`Email`/`Role` from common alt claim names (`unique_name`, `sub`, `email`, `role`, etc.).
  - `GetCurrentUserIdAsync()` / `GetCurrentUserNameAsync()` — convenience wrappers around `GetAuthenticationStateAsync()`.
  - `IsInRoleAsync(string role)` — checks role membership from current auth state.
  - `GetUserRolesAsync()` — returns all `ClaimTypes.Role` values for current user.

---

## Configuration/ (1 file)

- `src/Apps/ServiceMaintenance/Configuration/ApiConfiguration.cs` — `ServiceMaintenance.Configuration.ApiConfiguration` (static). Central place for backend API base URLs; consumed by `Program.cs`'s `ConfigureHttpClients`.
  - Constants: `TechnicalServicesBaseUrl` (`https://technicalservicesapi.camprotec.com.kh`), `CustomerApiBaseUrl`, `JwtApiBaseUrl`, `ApiVersion` (`"1.0"`).
  - `BuildUrl(string baseUrl, string endpoint)` — appends `?api-version=` (or `&`) if not already present.
  - `BuildTechnicalServicesUrl(string endpoint)` / `BuildCustomerApiUrl(string endpoint)` / `BuildJwtApiUrl(string endpoint)` — thin wrappers over `BuildUrl` for each base.

---

## Models/ (4 files)

- `src/Apps/ServiceMaintenance/Models/ApplicationUser.cs` — `ServiceMaintenance.Models.ApplicationUser : IdentityUser`. `FirstName`, `LastName` (required, max 100), `ProfilePicture` (byte[]), `Messages` (ICollection<Message>, initialized in ctor). Backing type for ASP.NET Identity (used mainly by `Register.cshtml.cs`; most other auth flows now bypass Identity via JWT).
- `src/Apps/ServiceMaintenance/Models/ErrorViewModel.cs` — `ServiceMaintenance.Models.ErrorViewModel`. `RequestId` (string), `ShowRequestId` (bool, computed). Used by `HomeController.Error()`.
- `src/Apps/ServiceMaintenance/Models/MenuItem.cs` — two classes: `MenuItem` (`Text`, `NavigateUrl`, `IconCssClass`, `BadgeText`, `AllowedRoles`) and `MenuSection` (`Title`, `Items: List<MenuItem>`). Built by `MenuService` (Services/), consumed by `Shared/NavMenu.razor`.
- `src/Apps/ServiceMaintenance/Models/Message.cs` — `ServiceMaintenance.Models.Message`. Chat/message entity: `Id`, `UserName`, `Text` (required), `When`, `UserID`, `RecipientID`, `FileUrl`, `AudioURL`, `VideoUrl`, `IsRead`, `ReplyToMessageId`/`ReplyToUserName`/`ReplyToText`, `Sender` (nav property to `ApplicationUser`). Ctor defaults `When = DateTime.Now`.

---

## ViewModel/ (6 files)

- `src/Apps/ServiceMaintenance/ViewModel/CheckBoxViewModel.cs` — `CheckBoxViewModel` (no namespace). `RoleId`, `RoleName`, `DisplayValue`, `IsSelected`. Generic checkbox row used by role/permission forms.
- `src/Apps/ServiceMaintenance/ViewModel/MessageWithSenderViewModel.cs` — `ServiceMaintenance.ViewModel.MessageWithSenderViewModel`. Flattened `Message` + sender info (`SenderProfilePicture`) for chat UI display.
- `src/Apps/ServiceMaintenance/ViewModel/PermissionsFormViewModel.cs` — `ServiceMaintenance.ViewModel.PermissionsFormViewModel`. `RoleId`, `RoleName`, `RoleCalims: List<CheckBoxViewModel>` (note: field name misspelled "Calims").
- `src/Apps/ServiceMaintenance/ViewModel/RoleFormViewModel.cs` — `ServiceMaintenance.ViewModel.RoleFormViewModel`. `Name` (`[Required, StringLength(256)]`) — role create/edit form binding model.
- `src/Apps/ServiceMaintenance/ViewModel/UserRolesViewModel.cs` — `ServiceMaintenance.ViewModel.UserRolesViewModel`. `UserId`, `UserName`, `Roles: List<CheckBoxViewModel>`.
- `src/Apps/ServiceMaintenance/ViewModel/UserViewModel.cs` — `ServiceMaintenance.ViewModel.UserViewModel`. User admin/list view model: identity fields, `Password`/`ConfirmPassword`, `ProfilePicture`/`ProfilePictureUrl`, `Roles`, `IsOnline`, computed `DisplayName`, plus chat-preview fields `LastMessage`/`LastMessageTime`.

---

## Shared/ (8 files — layout & chrome, NOT Pages)

- `src/Apps/ServiceMaintenance/Shared/MainLayout.razor` — `MainLayout : LayoutComponentBase`, the app's default layout (set in `App.razor`). Renders `NavMenu` + `Header` + `@Body`. Tracks `IsSidebarExpanded`; subscribes to `NavigationManager.LocationChanged` to trigger re-render; `Dispose()` unsubscribes.
- `src/Apps/ServiceMaintenance/Shared/NavMenu.razor` — main collapsible sidebar. `[Parameter] IsOpen` (bool, default true, two-way via `IsOpenChanged`). Builds `Sections: List<MenuSection>` from `MenuService.GetMenuSections(userRoles)` in `OnInitializedAsync`. `ToggleAsync()`, `Close()`, `ToggleCollapsed()`, `RefreshPage()` (calls `NavigationManager.Refresh(forceReload:true)`). Has its own `NavMenu.razor.css`/`.css.bak`.
- `src/Apps/ServiceMaintenance/Shared/Header.razor` — top navbar: theme toggle, message/envelope dropdown (unread count, list, relative-time formatting), user profile dropdown (loads profile pic via `JwtHttpClientService` `api/Auth/profile`), language selector slot. `[Parameter] ToggleOn` (bool, two-way) drives sidebar toggle. Note: bell/notification-icon feature was fully removed (see in-file comment) — only the envelope/messages dropdown remains. Helper methods: `IsImageFile`, `IsVideoFile`, `GetMessagePreviewText`, `TruncateMessage`, `ToggleEnvelopeDropdown`, `GetRelativeTime`, `ToggleThemeMode`. Has `Header.razor.css`.
- `src/Apps/ServiceMaintenance/Shared/IbottomNavMenu.razor` + `.razor.cs` (code-behind, partial class `IbottomNavMenu`) — mobile bottom nav bar + slide-out "settings drawer" (profile summary, Help/Privacy/Terms links, logout). Code-behind: `OnAfterRenderAsync` wires `addClickDrawer` JS interop; `OnInitializedAsync` loads user + profile picture (`LoadProfilePictureAsync` via `JwtHttpClient` `api/Auth/profile`); `NavigateToHome()`, `ToggleSettingsDrawer()`, `CloseDrawer()`, `dr1()`/`dr2()`/`dr3()` (drawer item nav stubs — `dr2`/`dr3` both navigate to the same `/another-setting` URL, likely a bug/placeholder).
- `src/Apps/ServiceMaintenance/Shared/ActionToolbox.razor` — reusable CRUD/export toolbar. Parameters: `CanCreate`/`CanEdit`/`CanDelete`/`CanExport`/`CanCheckList` (visibility bools), `IsCreateEnabled`/`IsEditEnabled`/`IsDeleteEnabled`/`IsExportEnabled`/`IsCheckListEnabled` (enabled bools), `IsRowSelected` (computed setter that sets both Edit+Delete enabled), `OnCreate`/`OnEdit`/`OnDelete`/`OnExportExcel`/`OnExportPdf`/`OnCheckList` (`EventCallback`s), `CustomActions` (`RenderFragment`). Internal export dropdown open/close state.
- `src/Apps/ServiceMaintenance/Shared/FooterPortal.razor` — content-projection helper: any page sets `ChildContent`, which gets pushed into `FooterContentService` (`Services/`) on every `OnParametersSet`; `Dispose()` clears it. Used by `FooterPagination`/`FooterReportStats` (Components/) to render into a shared app-level footer region.
- `src/Apps/ServiceMaintenance/Shared/BrowserNotSupported.razor` — static "unsupported browser" notice (IE/Edge Legacy), no code-behind logic.
- `src/Apps/ServiceMaintenance/Shared/MainLayout.razor.css` / `.css.bak`, `NavMenu.razor.css` / `.css.bak`, `Header.razor.css` — scoped CSS for the above; `.bak` files are stale copies.

---

## Components/ (13 files — reusable widgets, NOT Pages)

- `src/Apps/ServiceMaintenance/Components/ActionToolbox.razor` — n/a (lives in Shared/, see above; not duplicated here).
- `src/Apps/ServiceMaintenance/Components/RepairServiceDetailDialog.razor` — English-labeled read-only detail modal (`SfDialog`) for a `RepairServices` record: dates/by-user rows (conditionally rendered per populated field), customer info, machine info, spare-parts table with optional pricing column and `RemarkIndicator` per row. Parameters: `Service` (`RepairServices`), `IsVisible`/`IsVisibleChanged`, `SpareParts` (`IEnumerable<SparePartObject>`), `GetUserName` (`Func<Guid?,string>`), `HeaderText`, `ShowPricing`, `ShowRemarks`, `OnClose`. Methods: `Close()`, `OverlayClick(...)`.
- `src/Apps/ServiceMaintenance/Components/RepairServiceViewDialog.razor` — Khmer-labeled variant of the same detail dialog, with more date fields (`sentSparepartsDate`, `thirdPartyRepairDate`, `verifiedBy`), a `StatusLabelResolver` (`Func<string,string>`) for localized status text, editable remarks (`AllowEditRemarks`, `PresetRemarks`, `OnSaveRemarks`), and a shared `ResolveStockBadge(status, condition, qty)` helper for the stock-status pill (used across inspection-list/await-customer/repairservices pages per in-file comment). Parameters: `Service`, `Visible`/`VisibleChanged`, `SpareParts`, `GetUserNameById`, `StatusLabelResolver`, `ShowRemarks`, `AllowEditRemarks`, `PresetRemarks`, `OnSaveRemarks`.
- `src/Apps/ServiceMaintenance/Components/RepairServiceTabColumnHelper.cs` — `ServiceMaintenance.Components.RepairServiceTabColumnHelper` (static). Maps a repair-service "tab" key (e.g. `"Item Recieved"`, `"Inspection"`, `"Awaiting Sparepart"`, `"Sale Confirmed"`, `"Sent Spareparts"`) to the relevant date field / header / user column, for tab-based grid views.
  - `GetDateFieldForTab(string tabKey)` — returns the `RepairServices` date property name for the tab.
  - `GetDateHeaderForTab(string tabKey)` — Khmer header text for that date column.
  - `GetByUserIdForTab(RepairServices item, string tabKey)` — the relevant "set by" user Guid for the tab.
  - `GetByHeaderForTab(string tabKey)` — Khmer header text for the "by" column.
- `src/Apps/ServiceMaintenance/Components/RemarkIndicator.razor` — inline comment icon + hover tooltip + click-to-edit popup (preset buttons or free-text) for a spare part's remarks. Parameters: `SparePartId` (Guid), `Remarks`, `RemarksUpdatedAt`, `AllowEdit`, `PresetRemarks` (string[]), `OnSave` (`EventCallback<string>` — component does not persist itself, parent owns the save). Viewport-aware popup/tooltip positioning computed from mouse coords + `window.innerWidth/Height` via JS eval.
- `src/Apps/ServiceMaintenance/Components/ReportColumn.cs` — `ServiceMaintenance.Components.ReportColumn<TItem>`. Column descriptor for `ReportGroupedDocument<TItem>`: `Header`, `Width`, `Align`, `CellTemplate` (`RenderFragment<TItem>`, required), `SubTextTemplate` (optional secondary line).
  - `Text(header, valueSelector, width, align, subTextSelector)` (static factory) — builds a `ReportColumn<TItem>` for the common plain-string-cell case.
- `src/Apps/ServiceMaintenance/Components/ReportGroup.cs` — two small classes: `ReportGroup<TItem>` (`GroupName`, `Items: List<TItem>`) and `ReportSummaryStat` (`Label`, `Value`) — grand-total breakdown line entries.
- `src/Apps/ServiceMaintenance/Components/ReportGroupedDocument.razor` — generic `@typeparam TItem` grouped-report table (extracted from the monthly report page): title/subheader → per-group header row → item rows (via `Columns`) → per-group total → grand total + optional `SummaryStats` breakdown footer. Parameters: `Title` (required), `SubHeader`, `Columns` (`List<ReportColumn<TItem>>`, required), `Groups` (`List<ReportGroup<TItem>>`, required), `SummaryStats`, `GrandTotalLabel`.
- `src/Apps/ServiceMaintenance/Components/ReportLoadingIndicator.razor` — simple `SfSpinner`-based loading card. Parameters: `Message` (default "Loading report..."), `Size` (default 46).
- `src/Apps/ServiceMaintenance/Components/ReportPageShell.razor` — "no outer page scrollbar" layout wrapper for report pages (extracted from monthly report page); slots `Toolbar`/`FilterPanel`/`Body`. Parameters: `WrapperId` (required, unique DOM id), `Toolbar`, `FilterPanel`, `Body` (required). Calls JS `reportPageFit.init/adjust/dispose` for viewport-fit sizing.
  - `ReadjustAsync()` (public) — re-measures layout height after data/filter changes (call after async loads).
  - Implements `IAsyncDisposable` — disposes the JS-side fit tracker, swallows `JSDisconnectedException` on navigation-away.
- `src/Apps/ServiceMaintenance/Components/StatusTabMenu.razor` — simple tab strip. Parameters: `Tabs` (`List<TabItem>`), `ActiveTabKey`/`ActiveTabKeyChanged`, `OnTabChanged`. Nested `TabItem` class: `Key`, `Label`, `Count`. `HandleTabClick(string key)` fires both `ActiveTabKeyChanged` and `OnTabChanged`.
- `src/Apps/ServiceMaintenance/Components/FooterPagination.razor` — pagination bar rendered via `FooterPortal` into the shared app footer. Parameters (all `EditorRequired` unless noted): `CurrentPage`, `TotalPages`, `TotalItems`, `PageSize`, `OnFirstPage`/`OnPreviousPage`/`OnNextPage`/`OnLastPage`, optional `PageSizeOptions` (int[]) + `OnPageSizeChanged`. Computed `StartItem`/`EndItem` for the "Showing X-Y of Z" summary.
- `src/Apps/ServiceMaintenance/Components/FooterReportStats.razor` — stat-pill bar (also via `FooterPortal`). Parameters: `Stats` (`List<ReportSummaryStat>`, required), optional `GrandTotalLabel`/`GrandTotalValue` for a highlighted pill.

---

## Resources/ (1 non-resx file + 3 .resx)

- `src/Apps/ServiceMaintenance/Resources/LanguageSelector.razor` — flag-button + modal language switcher (English/Khmer enabled, Chinese disabled placeholder). On change: writes to `Blazored.LocalStorage` (display-only) AND sets the standard ASP.NET Core culture cookie (`CookieRequestCultureProvider.DefaultCookieName`) via JS `document.cookie`, then force-reloads the page so `Program.cs`'s `UseRequestLocalization` picks it up server-side before any component renders. Methods: `ChangeLanguage(ChangeEventArgs)`, `ShowLanguageSelector()`, `CloseModal()`, `GetFlagUrl(culture)`, `GetLanguageText(culture)`.
- `Resources/App.resx`, `Resources/App.en-US.resx`, `Resources/App.km-KH.resx` — resource files backing `IStringLocalizer<App>` / the `ResourceStrings` enum keys; `.resx` content not enumerated (data, not code).

---

## Areas/ (34 files — one area: `Identity`)

Single ASP.NET area, **Identity**, hosting ASP.NET Core Identity's scaffolded Account UI (login/register/2FA/manage-profile pages) plus this app's own auth-state-provider glue. Note the mixed auth model: `Login.cshtml.cs`/`Logout.cshtml.cs`/`Manage/Index.cshtml.cs` were rewritten to talk to a **JWT API** (bypassing ASP.NET Identity's `SignInManager`/`UserManager` entirely and issuing a cookie principal built from JWT claims), while `Register.cshtml.cs` (and most `Manage/*` sub-pages other than `Index`) still use classic Identity (`UserManager<ApplicationUser>`, `SignInManager<ApplicationUser>`) — i.e. registration creates a local Identity user, but login/logout/profile-view authenticate against the external JWT API. Worth checking both paths when debugging auth bugs.

- `src/Apps/ServiceMaintenance/Areas/Identity/IdentityHostingStartup.cs` — `BlazorServer.Areas.Identity.IdentityHostingStartup : IHostingStartup` (note: different root namespace, `BlazorServer`, leftover from scaffolding/template). `[assembly: HostingStartup(...)]`. `Configure(IWebHostBuilder)` — currently an empty no-op service registration hook.
- `src/Apps/ServiceMaintenance/Areas/Identity/RevalidatingIdentityAuthenticationStateProvider.cs` — `ServiceMaintenance.Areas.Identity.RevalidatingIdentityAuthenticationStateProvider<TUser> : RevalidatingServerAuthenticationStateProvider`. **Not currently registered** (superseded by `Authentication/JwtAuthenticationStateProvider.cs`, kept for reference/rollback). Revalidates the security stamp every 30 min (`RevalidationInterval`).
  - `ValidateAuthenticationStateAsync(AuthenticationState, CancellationToken)` — creates a fresh DI scope, delegates to `ValidateSecurityStampAsync`.
  - `ValidateSecurityStampAsync(UserManager<TUser>, ClaimsPrincipal)` (private) — compares the principal's security-stamp claim to the current DB value.

### Areas/Identity/Pages/ — top-level

- `Pages/Error.cshtml` + `.cshtml.cs` — `ErrorModel : PageModel`. `OnGet()` — sets `RequestId` for display.
- `Pages/_ViewImports.cshtml`, `Pages/_ViewStart.cshtml` — Razor Pages plumbing (usings, `_Layout` reference), no logic.

### Areas/Identity/Pages/Account/ — auth flow pages (PageModel class name = filename + "Model" unless noted)

- `Login.cshtml.cs` — **JWT-based** (see area note above). Ctor takes `JwtApiService`, `JwtSessionService`, `AuthenticationStateProvider` (cast to `JwtAuthenticationStateProvider`), `GlobalUserService`, `IServiceScopeFactory`.
  - `OnGet(string returnUrl = null)` — surfaces any `TempData` `ErrorMessage`, stashes `returnUrl`.
  - `OnPostAsync(string returnUrl = null)` — calls `JwtApiService.LoginAsync`; stores tokens via `JwtSessionService`; fires a **non-blocking** background `Task.Run` (own DI scope) to warm `GlobalUserService` cache (`forceRefresh:false`) — deliberately not awaited so login isn't slowed by a full user-cache rebuild; builds `ClaimsIdentity` from JWT response fields (Id/UserName/Email/Roles/FirstName/LastName); `HttpContext.SignInAsync` with cookie scheme (`ExpiresUtc` hardcoded to `+8h` — should track `JWT:TokenValidityInHours` config, currently doesn't); notifies `JwtAuthenticationStateProvider.NotifyUserAuthentication`; redirects to `returnUrl` (validated via `Url.IsLocalUrl`) or `~/`.
- `Logout.cshtml.cs` — **JWT-based**. `[AllowAnonymous]`. In-file comment documents a fixed bug: logout used to happen on `OnGet` (unsafe — any GET, e.g. link prefetch/scanner, would log the user out); now `OnGet()` is a pure no-op render, only `OnPost` logs out.
  - `OnGet()` — no-op (renders confirmation page).
  - `OnPost(string returnUrl = null)` — revokes refresh token via `api/Auth/revoke-token` (best-effort, swallows failure), `JwtSessionService.ClearTokens()`, `HttpContext.SignOutAsync` (cookie scheme), `HttpContext.Session.Clear()`, `JwtAuthenticationStateProvider.NotifyUserLogout()`, `GlobalUserService.ClearCache()` (best-effort), redirects to Login.
- `Register.cshtml.cs` — **classic ASP.NET Identity** (`UserManager<ApplicationUser>`, `SignInManager<ApplicationUser>`, `IUserStore`/`IUserEmailStore`, `IEmailSender`). Standard Identity registration flow (`InputModel` with FirstName/LastName/etc., `OnGetAsync`, `OnPostAsync`, `GetEmailStore()`).
- `ExternalLogin.cshtml.cs` — `ExternalLoginModel`. `OnGet()` → redirects to `./Login` (external login effectively disabled/unused). `OnPost(string provider, string returnUrl = null)` — challenge for external provider (scaffolded, likely unused given JWT-based auth).
- `ForgotPassword.cshtml.cs` / `ForgotPasswordConfirmation.cshtml.cs` — standard Identity password-reset request + confirmation pages (`InputModel`, `OnPostAsync`/`OnGet`).
- `ResetPassword.cshtml.cs` / `ResetPasswordConfirmation.cshtml.cs` — standard Identity reset-with-token flow (`OnGet(code, email)`, `OnPostAsync`).
- `LoginWith2fa.cshtml.cs` — `LoginWith2faModel`. `OnGetAsync(bool rememberMe, returnUrl)`, `OnPostAsync(bool rememberMe, returnUrl)` — 2FA code verification step (scaffolded Identity 2FA; JWT login path above does not currently invoke this).
- `LoginWithRecoveryCode.cshtml.cs` — recovery-code login fallback (`OnGetAsync`/`OnPostAsync`), scaffolded Identity.
- `Lockout.cshtml.cs` — `OnGet()` no-op, static lockout notice page.
- `ConfirmEmail.cshtml.cs` — `OnGetAsync(userId, code)` — confirms email token via Identity.
- `ConfirmEmailChange.cshtml.cs` — `OnGetAsync(userId, email, code)` — confirms an email-change token.
- `ResendEmailConfirmation.cshtml.cs` — `OnGet()`, `OnPostAsync()` — resend confirmation email form.
- `RegisterConfirmation.cshtml.cs` — `OnGetAsync(email, returnUrl)` — post-registration confirmation page (may show confirm-email link in dev).

### Areas/Identity/Pages/Account/Manage/ — authenticated profile-management sub-pages (all `[Authorize]`)

- `Index.cshtml.cs` — **JWT-based** (talks to backend `api/Auth/*` endpoints via `JwtHttpClientService`, not local Identity). Ctor: `JwtSessionService`, `JwtHttpClientService`, `ILogger`.
  - `LoadAsync()` (private) — GETs `api/Auth/profile`, populates `Username`, `ProfilePictureUrl`, `Input` (FirstName/LastName/Email/PhoneNumber).
  - `OnGetAsync()` — redirects to Login if token expired; otherwise loads profile.
  - `OnPostAsync()` — two-step update: (1) if `Input.ProfilePictureFile` present, uploads via multipart POST to `api/Auth/upload-profile-picture`; (2) if name fields present, PUTs `api/Auth/update-profile` (deliberately omits `ProfilePictureUrl` from this call since the upload endpoint already persisted it — see in-file comments); sets a combined `StatusMessage`; reloads profile; redirects to self.
  - `OnPostDeletePictureAsync()` — DELETEs `api/Auth/delete-profile-picture`, reloads, redirects to self.
  - Also declares (in same file, outside the page-model class): `ProfileResponse`, `ProfileData`, `UploadProfilePictureResponse`, `ErrorResponse` DTOs.
- `ManageNavPages.cs` — `ServiceMaintenance.Areas.Identity.Pages.Account.Manage.ManageNavPages` (static). Scaffolded Identity helper providing the "active" CSS class per manage sub-nav page. `Index`/`Email`/`ChangePassword`/`DownloadPersonalData`/`DeletePersonalData`/`ExternalLogins`/`PersonalData`/`TwoFactorAuthentication` (string constants) plus matching `*NavClass(ViewContext)` methods and the shared `PageNavClass(ViewContext, string page)`.
- `Email.cshtml.cs` — `OnGetAsync()`, `OnPostChangeEmailAsync()`, `OnPostSendVerificationEmailAsync()` — classic Identity email-change flow.
- `ChangePassword.cshtml.cs` — `OnGetAsync()`, `OnPostAsync()` — classic Identity password change.
- `SetPassword.cshtml.cs` — `OnGetAsync()`, `OnPostAsync()` — for accounts without a local password yet (e.g. external-login-only).
- `TwoFactorAuthentication.cshtml.cs` — `OnGetAsync()`, `OnPostAsync()` — 2FA status/management page.
- `EnableAuthenticator.cshtml.cs` — `OnGetAsync()`, `OnPostAsync()` — authenticator-app enrollment (QR/shared key).
- `ResetAuthenticator.cshtml.cs` — `OnGet()`, `OnPostAsync()` — resets the authenticator key.
- `Disable2fa.cshtml.cs` — `OnGet()`, `OnPostAsync()` — disables 2FA.
- `GenerateRecoveryCodes.cshtml.cs` — `OnGetAsync()`, `OnPostAsync()` — regenerates 2FA recovery codes.
- `ShowRecoveryCodes.cshtml.cs` — `OnGet()` — displays codes passed via `TempData` from the generate step.
- `ExternalLogins.cshtml.cs` — `OnGetAsync()` → redirects to `./Index` (feature effectively disabled). `OnPostRemoveLoginAsync(loginProvider, providerKey)`, `OnPostLinkLoginAsync(provider)`, `OnGetLinkLoginCallbackAsync()` — scaffolded, likely unused.
- `PersonalData.cshtml.cs` — `OnGet()` — GDPR-style personal-data landing page.
- `DownloadPersonalData.cshtml.cs` — `OnGet()`, `OnPostAsync()` — exports user's personal data as JSON download.
- `DeletePersonalData.cshtml.cs` — `OnGet()`, `OnPostAsync()` — account self-deletion flow.
- `AccessDenied.cshtml.cs` — `OnGet()` — static 403-style page.
- `_Layout.cshtml`, `_ManageNav.cshtml`, `_StatusMessage.cshtml`, `_ViewImports.cshtml` (Manage/ and Account/ each have their own `_ViewImports.cshtml`/`_StatusMessage.cshtml`) — Razor layout/partial plumbing, no C# logic of note.

All `.cshtml` files paired with the `.cshtml.cs` above are their Razor views (markup only, not separately indexed).

---

## Quick lookup — likely bug-hunt entry points

- Login/logout/session-expiry bugs → `Program.cs` (JWT bearer + cookie setup), `Areas/Identity/Pages/Account/Login.cshtml.cs`, `Logout.cshtml.cs`, `Authentication/JwtAuthenticationStateProvider.cs`, `Middleware/TokenExpiryMiddleware.cs`.
- Profile picture / profile update bugs → `Areas/Identity/Pages/Account/Manage/Index.cshtml.cs`, `Shared/Header.razor`, `Shared/IbottomNavMenu.razor.cs` (both fetch `api/Auth/profile` independently).
- Sidebar/menu/role-visibility bugs → `Shared/NavMenu.razor`, `Models/MenuItem.cs`.
- Culture/localization race bugs → `Program.cs` (`UseRequestLocalization`), `App.razor`, `Resources/LanguageSelector.razor` (all three have inline comments about a since-fixed race).
- Repair-service detail/report rendering bugs → `Components/RepairServiceDetailDialog.razor`, `Components/RepairServiceViewDialog.razor`, `Components/RepairServiceTabColumnHelper.cs`, `Components/ReportGroupedDocument.razor` + `ReportColumn.cs`/`ReportGroup.cs`.
- Footer pagination/stats not showing → `Shared/FooterPortal.razor`, `Components/FooterPagination.razor`, `Components/FooterReportStats.razor` (must be nested inside a page that also renders the footer's outlet — check `Pages/CLAUDE.md`/layout for where `FooterPortal`'s content actually gets displayed).
