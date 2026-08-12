# UserManagementAPI — Index

ASP.NET Core Web API (ASP.NET Identity + JWT) providing authentication, user/role/permission
management, an internal messaging inbox, an article/notification feed, and (models-only,
no controller yet) a leave-management module. Consumed by the Next.js frontend
(`TestingReact`) and the old Blazor UI. ~45 .cs files under `src/APIs/UserManagementAPI`.

Note: `Constants/Modules.cs`, `Constants/PermissionIcons.cs`, and `Constants/Permissions.cs`
declare namespace `UserManagementAPI.Contants` (typo, missing "s") even though the folder is
`Constants/` — watch for this when searching/importing.

## Program.cs

`src/APIs/UserManagementAPI/Program.cs` — app composition root (top-level statements).
- DB: `UserManagementContext` registered via `AddDbContext`, SQL Server, connection string
  `UserManagementConnection`, retry-on-failure (3x), 30s command timeout.
- Identity: `AddIdentity<ApplicationUser, IdentityRole>` — password policy (digit/upper/lower
  required, no special char, min length 6), lockout 5 min after 5 failed attempts, unique email
  required.
- Auth: JWT Bearer only (`JwtBearerDefaults`), config keys `JWT:Secret`, `JWT:ValidIssuer`,
  `JWT:ValidAudience`, `JWT:TokenValidityInHours` (default 3h), `JWT:RefreshTokenValidityInDays`
  (default 30d). ClockSkew 5 min.
- Authorization: policy `"PermissionPolicy"` requires `PermissionRequirement("Permission")`;
  handler `PermissionAuthorizationHandler` registered as `IAuthorizationHandler`.
- Data Protection keys persisted to `./dataprotection-keys` (skip — excluded per instructions).
- Response compression (Brotli/Gzip), rate limiters: `"api"` (100 req/min) applied globally via
  `MapControllers().RequireRateLimiting("api")`, `"login"` (10 req/min, no queue) used on
  `AuthController` login/forgot-password endpoints.
- `IFileStorageService` → `LocalFileStorageService` (scoped). `RefreshTokenCleanupService`
  registered as hosted background service.
- CORS policy `"AppCorsPolicy"` — allows `technicalsystemservices.koompi.cloud` and
  `user.koompi.cloud` (http/https), any method/header, credentials allowed.
- Static file serving: `/uploads` mapped to `wwwroot/uploads` (profile pictures live here).
- Middleware order: ResponseCompression → Swagger(dev) → HTTPS redirect → StaticFiles →
  Routing → CORS → RateLimiter → Authentication → Authorization → MapControllers.
- `SeedRolesAndAdmin(IServiceProvider)` — local function run at startup: seeds roles
  `Admin`, `User`, `Manager`; seeds default admin user `admin@usermanagement.com` /
  `Admin@123` (username `admin`) if not present.

## Controllers/

All controllers except `UsersController` are `[ApiController]` + `[Route("api/[controller]")]`
JSON APIs; `UsersController` is a legacy server-rendered MVC controller (returns Views).

`src/APIs/UserManagementAPI/Controllers/AuthController.cs` — route `api/Auth`. JWT login/register,
refresh-token rotation, password reset, profile + profile-picture management. No `[Authorize]`
at class level; per-action.
- `Register(RegisterViewModel)` — POST `register` — create user, assign default `User` role.
- `GenerateJwtTokenWithPermissions(ApplicationUser)` (private) — builds JWT claims: name, id,
  email, jti, each role, and each role's `Permission` claims (from `RoleManager.GetClaimsAsync`).
- `Login(LoginViewModel)` — POST `login`, `[EnableRateLimiting("login")]` — validates password,
  checks lockout, issues JWT + refresh token.
- `RegisterAdmin(RegisterViewModel)` — POST `register-admin`, `[Authorize(Roles="Admin")]` —
  creates a user with both `Admin` and `User` roles.
- `ChangePassword(ChangePasswordApiViewModel)` — POST `change-password`, `[Authorize]`.
- `ForgotPassword(ForgotPasswordViewModel)` — POST `forgot-password`,
  `[EnableRateLimiting("login")]` — always returns success (anti user-enumeration); generates
  reset token but does NOT email it (TODO in code, email sending unwired here).
- `ResetPassword(ResetPasswordViewModel)` — POST `reset-password`.
- `UploadProfilePicture(IFormFile)` — POST `upload-profile-picture`, `[Authorize]`,
  5MB limit — validates via `IFileStorageService`, deletes old picture, saves new, updates
  `ApplicationUser.ProfilePictureUrl` (stores relative path only).
- `DeleteProfilePicture()` — DELETE `delete-profile-picture`, `[Authorize]`.
- `GetProfile()` — GET `profile`, `[Authorize]` — returns current user + roles + full
  profile picture URL.
- `UpdateProfile(UpdateProfileViewModel)` — PUT `update-profile`, `[Authorize]` — does NOT
  touch `ProfilePictureUrl` (deliberately, per inline comment).
- `GenerateRefreshTokenAsync(ApplicationUser, jwtId)` (private) — creates + persists a
  `RefreshToken` row.
- `RefreshToken(RefreshTokenRequest)` — POST `refresh-token` — validates stored token
  (not expired/used/revoked), rotates: marks old used, issues new JWT + refresh token,
  links via `ReplacedByToken`.
- `RevokeToken(RefreshTokenRequest)` — POST `revoke-token`, `[AllowAnonymous]` — logout;
  sets `IsRevoked = true`.
- `GenerateJwtToken(List<Claim>)` (private, unused duplicate of the permissions variant),
  `CreateLoginErrorResponse(string)` (private), `GetFullImageUrl(string)` (private) — helpers.

`src/APIs/UserManagementAPI/Controllers/UserManagementController.cs` — route `api/UserManagement`.
Admin-facing user CRUD (no class-level `[Authorize]` — check individual actions/frontend gating).
- `GetAllUsers(page, pageSize)` — GET `` — paginated list with roles + full profile picture URLs.
- `GetUserById(string id)` — GET `{id}`.
- `CreateUser(CreateUserDto)` — POST `` — admin-created user, `EmailConfirmed = true`
  auto-set; assigns given roles or defaults to `User`.
- `UpdateUser(string id, UpdateUserDto)` — PUT `{id}`.
- `DeleteUser(string id)` — DELETE `{id}` — blocks self-deletion and deleting the last Admin.
- `GetUserRoles(string id)` — GET `{id}/roles` — all roles with `IsAssigned` flag; all-roles
  list cached 5 min in `IMemoryCache` under key `"AllRoles"`.
- `UpdateUserRoles(string id, UpdateRolesDto)` — PUT `{id}/roles` — replaces role set entirely.
- `ResetUserPassword(string id, AdminResetPasswordDto)` — PUT `{id}/password`.
- `SearchUsers(query, page, pageSize)` — GET `search` — matches username/email/first/last name.
- `GetAllRoles()` — GET `roles`.
- `LockUser(string id)` — PUT `{id}/lock` — locks out for 1 year.
- `UnlockUser(string id)` — PUT `{id}/unlock` — clears lockout + resets failed-attempt count.
- `GetFullImageUrl(string)` (private helper, duplicated from `AuthController`).

`src/APIs/UserManagementAPI/Controllers/RoleManagementController.cs` — route
`api/RoleManagement`. Role CRUD + role claims/permissions (no class-level `[Authorize]`).
- `GetAllRoles()` — GET ``.
- `GetRoleById(string id)` — GET `{id}` — includes `UserCount`.
- `CreateRole(CreateRoleDto)` — POST ``.
- `UpdateRole(string id, UpdateRoleDto)` — PUT `{id}`.
- `DeleteRole(string id)` — DELETE `{id}` — blocks deleting `Admin` role or a role with users.
- `GetRoleClaims(string id)` — GET `{id}/claims` — raw `IdentityRoleClaim` list.
- `AddRoleClaim(string id, AddClaimDto)` — POST `{id}/claims`.
- `RemoveRoleClaim(string id, RemoveClaimDto)` — DELETE `{id}/claims`.
- `UpdateRolePermissions(string id, UpdatePermissionsDto)` — PUT `{id}/permissions` — wipes
  ALL existing claims on the role, re-adds one `Permission` claim per string given.

`src/APIs/UserManagementAPI/Controllers/PermissionManagementController.cs` — route
`api/PermissionManagement`, class-level `[Authorize]`. Reads/writes permission claims driven by
`Contants.Permissions` / `Contants.Modules` (module × Access/View/Create/Edit/Delete/Print/Export).
- `GetRolePermissions(string roleId)` — GET `roles/{roleId}/permissions` — full permission
  catalog with `IsAssigned` per role.
- `UpdateRolePermissions(string roleId, UpdateRolePermissionsRequest)` — PUT
  `roles/{roleId}/permissions` — diff-based add/remove (unlike `RoleManagementController`'s
  wipe-and-replace).
- `GetUserPermissions(string userId)` — GET `users/{userId}/permissions` — self or Admin only.
- `CheckPermission(PermissionCheckRequest)` — POST `check` — self or Admin only.
- `GetAllModulePermissions()` — GET `modules` — full catalog grouped by module,
  `IsAssigned = false` always (reference list, not user-specific).
- `GetMyPermissions()` — GET `my-permissions` — current user's effective permissions.
- `ExtractModule(string permission)`, `FormatPermissionName(string permission)` (private) —
  parse `Permissions.{Module}.{Type}` strings.

`src/APIs/UserManagementAPI/Controllers/UsersController.cs` — legacy MVC controller (no route
attribute, returns `View(...)`/`RedirectToAction`), backs old Razor UI at `Users/*`. Duplicates
much of `UserManagementController`/`RoleManagementController` but through
`UserViewModel`/`EditUserViewModel`/`CreateUserViewModel` and `TempData` flash messages.
- `Index()` — GET `Users` — list.
- `Create()` / `Create(CreateUserViewModel)` — GET/POST `Users/Create`.
- `Edit(string id)` / `Edit(EditUserViewModel)` — GET/POST `Users/Edit`.
- `Details(string id)` — GET `Users/Details`.
- `Delete(string id)` / `DeleteConfirmed(string id)` — GET `Users/Delete`, POST (`ActionName
  ("Delete")`).
- `ManageRoles(string userId)` / `ManageRoles(UserRolesViewModel)` — GET/POST
  `Users/ManageRoles`.
- `ChangePassword(string id)` / `ChangePassword(ChangePasswordViewModel)` — GET/POST
  `Users/ChangePassword`.

`src/APIs/UserManagementAPI/Controllers/MessageController.cs` — route `api/Message`,
class-level `[Authorize]`. Direct-message inbox backing table `Messages`; supports file/audio/
video attachments and reply-to threading.
- `GetConversation(userId, recipientId, page, pageSize)` — GET `conversation` — both directions
  between two users, oldest-first in response despite descending query.
- `GetMessage(int id)` — GET `{id}`.
- `GetLastMessage(userId, recipientId)` — GET `last`.
- `GetUnreadCounts(recipientId)` — GET `unread/counts` — unread count grouped by sender.
- `GetUnreadCount(recipientId, senderId)` — GET `unread/count` — count for one sender/recipient
  pair.
- `SendMessage(SendMessageDto)` — POST ``.
- `MarkMessagesAsRead(MarkReadRequest)` — PUT `read` — marks all unread from one sender to one
  recipient.
- `DeleteMessage(int id)` — DELETE `{id}`.
- `DeleteMessagesByReportNo(string reportNo)` — DELETE `byReportNo/{reportNo}` — bulk delete by
  matching `Text` substring `"ReportNo: {reportNo}"` / `"ReportNo:{reportNo}"` — couples
  messaging to the maintenance/report domain via string matching, not a foreign key.
- Also defines `MessageDto`, `SendMessageDto`, `MarkReadRequest` in-file.

`src/APIs/UserManagementAPI/Controllers/ArticleController.cs` — route `api/Article`,
class-level `[Authorize]`. Notification/announcement feed backing table `Articles`.
- `GetArticles(page, pageSize, unreadOnly)` — GET ``.
- `GetArticle(int id)` — GET `{id}`.
- `GetUserArticles(username, page, pageSize)` — GET `user/{username}`.
- `GetUnreadCount()` — GET `unread/count`.
- `CreateArticle(CreateArticleDto)` — POST `` — `Username` defaults to current user's
  `ClaimTypes.Name`.
- `MarkAsRead(int id)` — PUT `{id}/read`.
- `UpdateVisibility(UpdateVisibilityDto)` — PUT `visibility` — finds article by matching
  `ArticleHeading` containing `"Ref No: {ReportNo}"` (string coupling like `MessageController`).
- `DeleteArticle(int id)` — DELETE `{id}`.
- Also defines `ArticleDto`, `CreateArticleDto`, `UpdateVisibilityDto` in-file.

## Data/ — DbContext

`src/APIs/UserManagementAPI/Data/UserManagementContext.cs` — `UserManagementContext : IdentityDbContext<ApplicationUser>`.
Search here first for "where is table X" questions.

DbSets (→ DB tables):
- `Messages` (`Message`) → table `dbo.Messages`
- `Articles` (`Article`) → table `dbo.Articles`
- `RefreshTokens` (`RefreshToken`) → table `security.RefreshTokens`
- `LeaveTypes` (`LeaveType`) → table (default schema, no explicit `ToTable`)
- `LeaveRequests` (`LeaveRequest`) → table (default schema, no explicit `ToTable`)
- `LeaveApprovals` (`LeaveApproval`) → table (default schema, no explicit `ToTable`)
- `LeaveBalances` (`LeaveBalance`) → table (default schema, no explicit `ToTable`)
- Inherited from `IdentityDbContext<ApplicationUser>`: Identity's `Users`, `Roles`,
  `UserRoles`, `UserClaims`, `UserLogins`, `RoleClaims`, `UserTokens` — all remapped in
  `OnModelCreating` to schema `security` (e.g. `security.Users`, `security.Roles`).

`OnModelCreating(ModelBuilder)`:
- Remaps Identity tables + `RefreshToken` to `security` schema; configures `RefreshToken`
  unique index on `Token`, index on `JwtId`, composite index on `(UserId, IsRevoked, IsUsed)`,
  cascade delete from `ApplicationUser`.
- Configures `Message` (table `dbo.Messages`): required/max-length constraints, FK
  `Message.UserID` → `ApplicationUser` (cascade delete) via `Sender`/`Messages` nav, indexes on
  `(UserID, RecipientID)`, `When`, `(RecipientID, IsRead)`.
- Configures `Article` (table `dbo.Articles`): required/max-length constraints, `Timestamp`
  defaults to `GETUTCDATE()`, indexes on `Timestamp`, `IsRead`, `Username`, `ArticleHeading`.
- Leave management: unique index on `LeaveBalance(UserId, LeaveTypeId, Year)`; ignores
  `LeaveBalance.RemainingHours` (computed property, not persisted); seeds 4 `LeaveType` rows
  via `HasData` (Annual, Personal, Sick, Maternity Leave — ids 1-4).

`SeedAnnualBalances(UserManagementContext, UserManager<ApplicationUser>, int year)` (static) —
creates a `LeaveBalance` row per active/non-on-time `LeaveType` for every user for the given
year, if one doesn't already exist. NOTE: no controller currently calls this or exposes
Leave* endpoints — leave-management models/DbSets exist but the API surface is not wired up
in `Controllers/`.

## Models/

`src/APIs/UserManagementAPI/Models/ApplicationUser.cs` — `ApplicationUser : IdentityUser`.
Adds `FirstName`, `LastName` (required), `ProfilePictureUrl` (relative path, max 500),
`Messages` (nav collection, initialized in ctor).

`src/APIs/UserManagementAPI/Models/Article.cs` — `Article` entity: `Id`, `ArticleHeading`,
`ArticleContent`, `Username`, `ProfilePicture`, `Timestamp` (UTC), `IsRead`, `IsActionVisible`.

`src/APIs/UserManagementAPI/Models/Message.cs` — `Message` entity: `Id`, `UserName`, `Text`,
`When`, `UserID` (sender), `RecipientID`, `FileUrl`, `AudioURL`, `VideoUrl`, `IsRead`,
`ReplyToMessageId`/`ReplyToUserName`/`ReplyToText` (reply threading, denormalized — no FK to
the replied message), `Sender` (nav to `ApplicationUser`).

`src/APIs/UserManagementAPI/Models/RefreshToken.cs` — `RefreshToken` entity: `Id`, `UserId`,
`Token`, `JwtId` (links to JWT `jti` claim), `CreatedAt`, `ExpiresAt`, `IsUsed`, `IsRevoked`,
`ReplacedByToken`, `RevokedReason`, `User` (nav).

`src/APIs/UserManagementAPI/Models/Leave/LeaveType.cs` — `LeaveType`: `Id`, `Name`,
`HoursPerMonth`/`TotalHoursYear` (nullable — null means on-time/no accrual), `IsOnTime`,
`IsActive`, `CreatedAt`; nav collections `LeaveRequests`, `LeaveBalances`.

`src/APIs/UserManagementAPI/Models/Leave/LeaveRequest.cs` — `LeaveRequest`: `Id`, `UserId`,
`LeaveTypeId`, `FromDate`/`ToDate` (`DateOnly`), `TotalHours`, `Reason`, `Status` (string state
machine: `Pending` | `ApprovedByM1` | `Approved` | `Rejected`), `CreatedAt`/`UpdatedAt`,
`LeaveType` nav, `Approvals` (nav collection of `LeaveApproval`).

`src/APIs/UserManagementAPI/Models/Leave/LeaveApproval.cs` — `LeaveApproval`: `Id`,
`LeaveRequestId`, `ManagerId`, `ApprovalStep` (1 or 2 — two-step approval chain), `Decision`
(`Approved`/`Rejected`), `Reason`, `DecidedAt`, `LeaveRequest` nav.

`src/APIs/UserManagementAPI/Models/Leave/LeaveBalance.cs` — `LeaveBalance`: `Id`, `UserId`,
`LeaveTypeId`, `Year`, `TotalHours`, `UsedHours`, computed `RemainingHours` (not persisted,
`Ignore`d in `OnModelCreating`), computed `LeaveTypeName` (from nav), `LeaveType` nav.

## Services/

`src/APIs/UserManagementAPI/Services/IEmailService.cs` /
`src/APIs/UserManagementAPI/Services/EmailService.cs` — SMTP email sender (config keys
`Email:SmtpHost/SmtpPort/SmtpUser/SmtpPass/FromEmail/FromName`). NOT registered in `Program.cs`
DI — instantiating `IEmailService` via DI will currently fail; `AuthController.ForgotPassword`
does not call it (TODO left in code).
- `SendEmailConfirmationAsync(email, userName, confirmationLink)`.
- `SendPasswordResetAsync(email, userName, resetLink)`.
- `SendWelcomeEmailAsync(email, userName)`.
- `SendEmailAsync(email, subject, body)` (private) — actual SMTP send.

`src/APIs/UserManagementAPI/Services/IFileStorageService.cs` /
`src/APIs/UserManagementAPI/Services/LocalFileStorageService.cs` — profile-picture storage on
local disk under `wwwroot/uploads/profile-pictures`. Registered scoped in `Program.cs`.
- `IsValidImageFile(IFormFile)` — checks size (≤5MB), extension (`.jpg/.jpeg/.png/.webp`),
  and magic-number signature match.
- `SaveProfilePictureAsync(IFormFile, userId)` — saves as `{userId}_{ticks}{ext}`, returns
  relative URL `/uploads/profile-pictures/{fileName}`. Handles null `WebRootPath` (Docker).
- `DeleteProfilePictureAsync(filePath)` — accepts relative or full URL.

`src/APIs/UserManagementAPI/Services/RefreshTokenCleanupService.cs` — `BackgroundService`,
registered as hosted service. Runs daily at 2 AM local time; deletes `RefreshToken` rows expired
more than 7 days (`ExpiresAt < UtcNow.AddDays(-7)`). On error, retries after 1 hour.
- `ExecuteAsync(CancellationToken)` — scheduling loop.
- `CleanupExpiredTokensAsync(CancellationToken)` (private) — the actual delete.

## Authorization/

`src/APIs/UserManagementAPI/Authorization/PermissionRequirement.cs` — custom claims-based
permission authorization building blocks (all in one file):
- `PermissionRequirement : IAuthorizationRequirement` — wraps a single `Permission` string.
- `PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>` — succeeds if
  any of the current user's roles has a `RoleManager` claim of type `"Permission"` whose value
  equals the required permission. Registered in `Program.cs`; usable via policy
  `"PermissionPolicy"` (checks a hardcoded literal `"Permission"` — see note below) or per-call
  `IAuthorizationService.AuthorizeAsync`.
- `RequirePermissionAttribute : TypeFilterAttribute` — `[RequirePermission("Permissions.X.View")]`
  usage; wires a `PermissionFilter` with the given permission string. NOTE: this attribute path
  is the one that actually parameterizes the permission per-action; the `"PermissionPolicy"`
  policy registered in `Program.cs` always checks for literal permission value `"Permission"`,
  which looks like a bug/unused path — grep for `RequirePermissionAttribute` usage before
  assuming policy-based checks are in effect.
- `PermissionFilter : IAsyncAuthorizationFilter` — the filter invoked by
  `RequirePermissionAttribute`; forbids (403) if `AuthorizeAsync` against the wrapped
  requirement fails.

## Constants/

Note: actual namespace for these three files (except `AppRoles.cs`) is `UserManagementAPI.Contants`
(typo — no "s" after "Con"), while `AppRoles.cs` uses `UserManagementAPI.Constants`. Two
different namespaces exist in this folder.

`src/APIs/UserManagementAPI/Constants/AppRoles.cs` — namespace `UserManagementAPI.Constants`.
`AppRoles` static class: `Admin`, `User`, `Manager`, `SuperAdmin` string constants. NOTE:
`Program.cs` seeding only creates `Admin`/`User`/`Manager` — `SuperAdmin` is declared but never
seeded/used elsewhere in this project as far as this index goes.

`src/APIs/UserManagementAPI/Constants/Modules.cs` — namespace `UserManagementAPI.Contants`.
`Modules` enum — one member per maintenance-app module (`ItemModelList`, `SparePartList`,
`ReceiveItemList`, `InspectItemList`, `InspectionList`, `AwaitCustomerList`,
`AwaitSparePartList`, `ThirdPartyList`, `CustomerReject`, `UnrepairList`, `RepairItemList`,
`FinishItem`, `DailyReportPage`, `MonthlyReportPage`, `CustomerReportPage`,
`HistoryRepairReport`, `TechnicalServiceList`, `EngineerReportList`, `SaleConfirmedList`,
`SummaryReportPage`). Drives `Permissions.GenerateAllPermissions()`.

`src/APIs/UserManagementAPI/Constants/Permissions.cs` — namespace `UserManagementAPI.Contants`.
`Permissions` static class — one nested static class per module (e.g. `Permissions.ItemModelList
.View`) with `Access`/`View`/`Create`/`Edit`/`Delete`/`Print`/`Export` const strings
(`"Permissions.{Module}.{Type}"`); modules listed in `AccessOnlyModules` only get an `Access`
const (report/summary pages).
- `GeneratePermissionsList(string module)` — full or access-only list for one module.
- `GenerateAllPermissions()` — list for every `Modules` enum value; used by
  `PermissionManagementController` to build the full permission catalog.
- `IsAccessOnlyModule(string moduleName)`.
- `GetAvailablePermissionTypes(string moduleName)`.
- Note: a stale inline comment on `GenerateAllPermissions()` says "ERROR: Modules enum doesn't
  exist!" — the enum does exist (`Modules.cs`); comment is outdated, safe to ignore.

`src/APIs/UserManagementAPI/Constants/PermissionIcons.cs` — namespace `UserManagementAPI.Contants`.
`PermissionIcons` static class — `Icons` dictionary mapping permission-type suffix
(`Access`/`View`/`Create`/`Edit`/`Delete`) to a FontAwesome class string.
- `GetIcon(string permission)` — takes the last `.`-segment of a permission string and looks it
  up; falls back to `"fas fa-question"`.

## ViewModel/

`src/APIs/UserManagementAPI/ViewModel/AuthViewModels.cs` — `LoginViewModel`,
`RegisterViewModel`, `ForgotPasswordViewModel`, `ResetPasswordViewModel`,
`RefreshTokenViewModel` (unused — `AuthController` uses `RefreshTokenRequest` instead).

`src/APIs/UserManagementAPI/ViewModel/ApiViewModels.cs` — `ChangePasswordApiViewModel`,
`UpdateProfileViewModel`, `TokenResponseViewModel` (unused, response is built inline in
`AuthController.Login`), `ApiResponseViewModel` (generic envelope shape, not consistently used —
controllers mostly return anonymous objects).

`src/APIs/UserManagementAPI/ViewModel/ChangePasswordViewModel.cs` — MVC-only
`ChangePasswordViewModel` (`UserId`, `UserName`, `NewPassword`, `ConfirmPassword`) — used by
`UsersController`.

`src/APIs/UserManagementAPI/ViewModel/CheckBoxViewModel.cs` — `CheckBoxViewModel` (no
namespace — global) — `RoleId`, `RoleName`, `DisplayValue`, `IsSelected`; used by
`UsersController.ManageRoles`.

`src/APIs/UserManagementAPI/ViewModel/CreateUserViewModel.cs` — `CreateUserViewModel` +
`RoleSelectionViewModel` — MVC-only, used by `UsersController.Create`/`Edit`.

`src/APIs/UserManagementAPI/ViewModel/DTOs/UserDtos.cs` — API DTOs for
`UserManagementController`/`RoleManagementController`: `CreateUserDto`, `UpdateUserDto`,
`UpdateRolesDto`, `RoleDto`, `UserRolesDto`, `RoleAssignmentDto`.

`src/APIs/UserManagementAPI/ViewModel/EditUserViewModel.cs` — MVC-only, `UsersController.Edit`.

`src/APIs/UserManagementAPI/ViewModel/RefreshTokenRequest.cs` — `RefreshTokenRequest`
(`RefreshToken` string) — actually used by `AuthController` refresh/revoke endpoints.

`src/APIs/UserManagementAPI/ViewModel/UpdateProfilePictureUrlViewModel.cs` — declared but not
referenced by any controller found in this index (grep before assuming dead code).

`src/APIs/UserManagementAPI/ViewModel/UploadProfilePictureViewModel.cs` — declared but
`AuthController.UploadProfilePicture` actually binds `[FromForm] IFormFile profilePicture`
directly, not this view model — likely unused.

`src/APIs/UserManagementAPI/ViewModel/UserDetailsViewModel.cs` — MVC-only,
`UsersController.Details`/`Delete`.

`src/APIs/UserManagementAPI/ViewModel/UserRolesViewModel.cs` — `UserRolesViewModel` (MVC,
`UsersController.ManageRoles`) plus API-side permission DTOs used by
`PermissionManagementController`/`RoleManagementController`: `RolePermissionsDto`,
`PermissionDto`, `UpdateRolePermissionsRequest`, `PermissionCheckRequest`,
`PermissionCheckResponse`, `UserPermissionsResponse`, `UserPermissionsData`,
`ModulePermissionsResponse`, `ModulePermissionGroup`.

`src/APIs/UserManagementAPI/ViewModel/UserViewModel.cs` — `UserViewModel` — MVC-only,
`UsersController.Index`; includes unused `Password`/`ConfirmPassword`/`ProfilePicture`
(`byte[]`, superseded by `ApplicationUser.ProfilePictureUrl` string) and `IsOnline` fields.

## Migrations/

`src/APIs/UserManagementAPI/Migrations/` — EF Core migration history (2 migrations:
`AddRefreshTokenTable`, `AddLeaveManagement`, plus `UserManagementContextModelSnapshot.cs`).
Skip Designer/snapshot files — regenerate from `Data/UserManagementContext.cs` if needed.
