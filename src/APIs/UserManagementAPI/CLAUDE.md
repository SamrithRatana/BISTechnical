# UserManagementAPI — Index

ASP.NET Core Web API (ASP.NET Identity + JWT) providing authentication, user/role/permission
management, an internal messaging inbox, an article/notification feed, and (models-only,
no controller yet) a leave-management module. Consumed by the Next.js frontend
(`TestingReact`) and the old Blazor UI. ~45 .cs files under `src/APIs/UserManagementAPI`.

Note: `Constants/Modules.cs`, `Constants/PermissionIcons.cs`, and `Constants/Permissions.cs`
declare namespace `UserManagementAPI.Contants` (typo, missing "s") even though the folder is
`Constants/` — watch for this when searching/importing.

## Data-access + logic audit (2026-08-18)

A full pass over `Controllers/` for the same class of bug as the `GetAllUsers` N+1
(documented under `AppSettingsController`/`AuthController` below), plus a logic-correctness
pass. All measured/verified against the real (remote) database, not assumed. Fixed:

- **N+1 query loops**, same shape everywhere: a `foreach` over a page of rows doing an
  `await` DB call per row instead of one batched query. Fixed in `UserManagementController`
  (`GetAllUsers`, `SearchUsers`, `CreateUser`/`UpdateUserRoles` role validation, `GetUserRoles`'s
  cached role list now `AsNoTracking`), `AuthController.GenerateJwtTokenWithPermissions` (runs
  on **every** login and token refresh — the highest-traffic instance of this bug),
  `PermissionManagementController` (`GetUserPermissions`, `CheckPermission`, `GetMyPermissions`,
  now sharing one `GetPermissionsForRolesAsync` helper), and `RoleManagementController.GetAllRoles`.
- **N+1 WRITE loops**: `RoleManagementController.UpdateRolePermissions` (wiped and re-added
  every claim on a role via `RemoveClaimAsync`/`AddClaimAsync` — each call is its own
  `SaveChangesAsync`; 100+ round trips for a role with ~100 permission claims) and
  `PermissionManagementController.UpdateRolePermissions` (same shape, diff-based). Both now
  operate on `_context.RoleClaims` directly and save once.
- **Broken account lockout**: `AuthController.Login` checked `IsLockedOutAsync` but never called
  `AccessFailedAsync` on a wrong password or `ResetAccessFailedCountAsync` on success — this
  controller calls `UserManager` directly rather than `SignInManager`, which is what normally
  wires that bookkeeping up. The configured policy ("lockout 5 min after 5 failed attempts",
  see `Program.cs` below) could never actually engage; `[EnableRateLimiting("login")]` (10
  req/min, IP-scoped) was the only real brake on password guessing. Fixed.
- **Last-Admin delete protection was bypassable**: `UserManagementController.DeleteUser` only
  ran the "can't delete the last Admin" check when `userRoles.Count == 1` — an Admin who also
  held any second role skipped the check entirely and was deletable. Fixed (drop the count
  condition; whether SuperAdmin needs the same protection is a separate product question, not
  addressed here).
- **SuperAdmin-only accounts were denied their own admin views**:
  `PermissionManagementController.GetUserPermissions`/`CheckPermission` gated the "view another
  user" path on `IsInRole("Admin")` only. At least one real seeded account holds `SuperAdmin`
  without also holding `Admin` (verified against live data) and was blocked from viewing anyone
  else's permissions. Fixed to check both roles, matching `ADMIN_ROLES` in the frontend's
  `authSession.ts` and this file's own `AppSettingsController` gate.
- **Flagged, not changed**: `AuthController.RegisterAdmin` (creates new admins) is
  `[Authorize(Roles="Admin")]` only, excluding SuperAdmin — unlike the two fixes above, this
  reads as a plausible deliberate privilege-escalation boundary rather than an oversight, so it
  was left alone pending a real decision on intended SuperAdmin scope.

Same pass extended to `Services/` (2026-08-18) — this project has no `Middleware/` folder at
all (only `src/Apps/ServiceMaintenance/Middleware/`, a different project). Found and fixed:

- **`RefreshTokenCleanupService`'s 2 AM scheduling had an off-by-one-day bug.**
  `now.Date.AddDays(1).AddHours(2)` always targets TOMORROW's 2 AM regardless of whether
  today's has already passed — so a service that starts between midnight and 2 AM skips the
  cleanup that's only minutes away and waits ~25 hours instead. Fixed to target today's 2 AM
  when it hasn't passed yet.
- **`LocalFileStorageService.DeleteProfilePictureAsync` was missing the Docker
  `WebRootPath`-null fallback** that `SaveProfilePictureAsync` already had (explicitly, with a
  `✅ FIX` comment) — meaning in that same deployment, a picture could be uploaded but never
  later deleted: `Path.Combine(null, ...)` throws, the method's own catch swallows it, and
  cleanup silently no-ops every time. Extracted into one shared `GetWebRootPath()` both methods
  now call.
- **`IsValidImageFile`'s stream "reset" was dead code**: `file.OpenReadStream().Position = 0;`
  calls `OpenReadStream()` a SECOND time, so it reset a brand-new (and then never-disposed)
  stream instance, not the one `reader` had actually just read 8 bytes from. Currently harmless
  only because `IFormFile.OpenReadStream()`/`CopyToAsync()` are independently rewindable — the
  save path never depended on this line doing anything — but it did not do what its own comment
  claimed, and leaked a stream. Removed.
- **Not a bug, checked**: `EmailService`/`IEmailService` are confirmed still unused — zero
  references in `Program.cs` or any controller (grepped, not assumed). Dead code, but inert;
  matches the existing note that `IEmailService` isn't registered in DI.

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
- `UpdateProfilePictureUrl(UpdateProfilePictureUrlViewModel)` — PUT
  `update-profile-picture-url`, `[Authorize]` — sets `ProfilePictureUrl` to an
  already-hosted URL as-is (no `GetFullImageUrl` rebasing, unlike
  `upload-profile-picture` above). Added for `TestingReact`'s shared R2 upload
  route (`api/upload/route.ts`): the frontend uploads the file itself, then
  calls this to persist the resulting URL. Binds the
  `UpdateProfilePictureUrlViewModel` that had sat unused in `ViewModel/` since
  before this endpoint existed.
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

`src/APIs/UserManagementAPI/Controllers/WebAuthnController.cs` — route `api/auth/webauthn`.
WebAuthn / FIDO2 passkey enrolment and login ("Face Login"). Added 2026-08-22.
- `RegisterOptions()` — POST `register-options`, `[Authorize]` — starts enrolment. Requires an
  existing session on purpose: the bearer token is what authorises binding a new device, so an
  anonymous version would let anyone attach their phone to someone else's account.
- `Register(JsonElement)` — POST `register`, `[Authorize]` — verifies the attestation and writes a
  `UserCredential` row.
- `LoginOptions(JsonElement)` — POST `login-options`, `[AllowAnonymous]`,
  `[EnableRateLimiting("login")]` — body `{ userName? }`. With no username the allow-list is empty
  and the browser offers whichever discoverable passkeys the device holds (usernameless flow). An
  **unknown username returns normal options with an empty allow-list**, not an error — answering
  "no such user" here would make this an account-enumeration oracle.
- `Login(JsonElement)` — POST `login`, `[AllowAnonymous]`, `[EnableRateLimiting("login")]` —
  verifies the assertion, checks lockout the same way the password path does, and returns a
  response **byte-identical in shape to `AuthController.Login`'s** so the frontend stores a passkey
  session exactly as it stores a password one.
- `GetCredentials()` / `DeleteCredential(int)` — GET/DELETE `credentials[/{id}]`, `[Authorize]` —
  device list and removal, both scoped to the caller's own rows (another user's id reads as "not
  found").
- Every action is a one-line wrapper over a private `*Core` method behind `Guarded(...)`, which
  turns anything unexpected into a plain JSON 500 — matching what `AuthController` does, and for
  the same reason: the frontend parses every response on this route as JSON.

**Three things here are load-bearing and must not be "simplified":**
1. **Requests and responses are raw JSON** (`[FromBody] JsonElement` in, `options.ToJson()` out),
   not MVC model binding. `Program.cs` sets `PropertyNamingPolicy = null` (PascalCase) API-wide,
   while WebAuthn's wire format is fixed camelCase — going through the app serializer renames every
   field and the browser rejects the options object.
2. **The challenge lives in `IMemoryCache`**, keyed by a random ceremony id the client echoes back,
   not in a session cookie (this API is stateless and is reached server-to-server through the
   Next.js proxy, where no cookie survives). Entries are single-use — **verified**: replaying a
   ceremony id returns "expired".
3. **`WebAuthn:ServerDomain` is the Relying Party ID and must be the domain the USER's browser
   shows** — the frontend's host, not this API's. They differ in this system. In production that
   means `camprotec.com.kh` (a registrable parent of `technicalsystem.camprotec.com.kh`); locally
   it is `localhost`, which browsers treat as a secure context over plain http. The port is not
   part of the domain but IS part of `WebAuthn:Origins`.

`src/APIs/UserManagementAPI/Controllers/FaceAuthController.cs` — route `api/auth/face`.
Face verification as a **second factor**. Added 2026-08-22, after passkeys, because passkeys
delegate the biometric to the device and never open a camera — which on hardware with no
Windows Hello sensor means no face at all. This one does open the camera.
- `GET status` / `POST enroll` / `DELETE enroll` — `[Authorize]`. Enrolment replaces rather than
  appends (re-enrolling is what someone does when the old samples stopped working). Removal is
  unconditional and immediate: withdrawing biometric data must be as easy as giving it.
- `POST login-start` — `[AllowAnonymous]`, `[EnableRateLimiting("login")]`. Checks the password
  with the same lockout bookkeeping `AuthController.Login` uses, then either returns a **full
  session** (no face enrolled — so this is a drop-in replacement for `api/Auth/login`) or
  `{ requiresFace: true, faceToken }` **and no token**.
- `POST login-verify` — `[AllowAnonymous]`, rate-limited. Compares and issues the real session.

**The security model, stated plainly:**
- The `faceToken` is not a session. No roles, no permission claims, nothing callable. It is a
  two-minute single-use receipt saying "somebody knew this password".
- **The descriptor is computed in the BROWSER.** The server compares a vector it did not produce,
  so anyone who can craft a matching vector skips the camera. That is the known ceiling of
  client-side face recognition and is exactly why this sits *behind* a password and must not be
  promoted to a primary credential. Moving the embedding server-side (ONNX + ArcFace) is the
  upgrade path.
- Liveness (a blink) is measured client-side and is therefore advisory. It stops a photo held up
  to the lens; it does not stop devtools.
- A failed match **never returns the distance** — that would be a similarity oracle a caller could
  hill-climb to a match without ever seeing the enrolled face. Only `attemptsLeft` comes back.
- 5 attempts per token; a malformed descriptor is a 400 and does **not** spend one.

**Paired phones** (`device/*`, added the same day):
- `POST device/enroll` — `[Authorize]`. Pairs a phone AND stores the face in one call: a paired
  phone with no face can never sign in, and a face enrolled from an unpaired phone has no way to
  be presented later. Returns a `deviceToken` **once** — only its SHA-256 is stored.
- `POST device/login` — `[AllowAnonymous]`, rate-limited. The token names the account, so the face
  is checked **1:1** against that account's samples. See `UserFaceDevice` for why this must never
  become a search across every enrolled face. 5 consecutive failures lock that device for 5
  minutes.
- `GET devices` / `DELETE devices/{id}` — `[Authorize]`, scoped to the caller's own rows. Revoked
  rather than deleted, so "unpaired on that date" survives.

**Server-side photo verification (`device/enroll-face`, `device/approve-session`, added 2026-08-24).**
This is the "ONNX + ArcFace" upgrade the rest of this file kept pointing at, built specifically
to close the CAM ID push-approve hole where **a friend's face approved a sign-in**. The mobile app
runs Google ML Kit, which *detects* faces but cannot *recognise* them, so the old push-approve was
ML Kit "a face is present" + a hub call that minted a session — no identity check at all, and the
hub even hardcoded the **admin** account regardless of whose phone answered.
- `POST device/enroll-face` — `[AllowAnonymous]`, rate-limited, **multipart** (`deviceToken`, 3–8
  `photos`). Embeds each photo with ArcFace **on the server** (`PhotoFaceService`) into 512-float
  templates stored in `security.UserFaceTemplates` alongside — never matching against — the
  browser's 128-float face-api rows (`FaceMatcher.Distance` returns ∞ across mismatched
  `Dimensions`). Token alone may enrol **only while the account has zero 512-float templates**
  (first-time upgrade / fresh pairing); **replacing** an enrolled face needs a signed-in bearer for
  the same account, or anyone holding the phone could swap in their own face. Rejects a photo set
  whose captures are not pairwise consistent (cosine ≥ 0.28), so a mixed-people set can't enrol.
  Does **not** touch `TwoFactorEnabled` (that gates the browser 128-float flow).
- `POST device/approve-session` — `[AllowAnonymous]`, rate-limited, **multipart** (`deviceToken`,
  `sessionId`, `approved`, `photo`). Approval requires ALL of: paired unrevoked device token; a
  **single-use** `sessionId → userId` binding this API itself wrote (`AuthSessionRegistry` in
  `IMemoryCache`, set by `RequestDevicePush` and the hub's `RequestMobileApproval`) so a device can
  only answer a challenge pushed to ITS user, once; and an ArcFace match (cosine ≥
  `Face:PhotoMatchThreshold`, default 0.42) of the uploaded photo against that user's 512-float
  samples. Issues a session **for the device's user**, not admin. Zero 512-float samples →
  409 `RequiresEnrollment` (the phone then runs enroll-face). Denial needs token+binding only, no
  photo. 5 face failures lock the device 5 min. The distance is never returned (similarity oracle).
- **`AuthNotificationHub.RespondToAuthRequest` approve path is now REFUSED** — it was an
  unauthenticated token-vending machine any connected client could call. Denial still works there;
  approvals must go through `device/approve-session`. The hub no longer injects `ITokenIssuer`.
- **The hardcoded `dev_tok_admin_live` device is gone** — `Program.cs` now *revokes* any legacy row
  (its token is public in git, and a paired device can now enrol a face), and `CheckUserDevices` no
  longer auto-pairs admin.
- `Face:PhotoMatchThreshold` (**cosine**, 0.42 default) is NOT tuned on real staff faces — tune it
  from the `similarity {Similarity:F3}` values logged on every approve, per the same discipline as
  `Face:MatchThreshold`. Parsed invariant-culture so a `,`-decimal locale can't break it.

`src/APIs/UserManagementAPI/Services/PhotoFaceService.cs` — `IPhotoFaceService` (DI **singleton**;
lazily loads FaceAiSharp's bundled SCRFD detector + ArcFace embedder ONNX models once). `Embed`
detects exactly one face (refuses zero or >1), rejects an over-40MP canvas from the header
BEFORE decode (`Image.Identify` — decompression-bomb guard), aligns by landmarks, returns a
512-float unit vector; `BestSimilarity` is cosine against the closest 512-dim template only.
**Two NuGet packages are required and BOTH must be present** (from nuget.org — the machine's broken
`https://packagesource` source must be skipped with `-s https://api.nuget.org/v3/index.json`):
`FaceAiSharp.Bundle` pulls only `Microsoft.ML.OnnxRuntime.Managed` (managed wrapper), so
`Microsoft.ML.OnnxRuntime` (the native CPU runtime, same version) is referenced explicitly —
without it `runtimes/win-x64/native/onnxruntime.dll` is absent and the first inference throws
`DllNotFoundException` at runtime while the build stays green. Verified end-to-end: two different
staff photos score cosine 0.233 (< 0.42 threshold → correctly rejected); same photo scores 1.000.
Also holds `AuthSessionRegistry` (the session→user cache-key helper).

`src/APIs/UserManagementAPI/Services/FaceMatcher.cs` — encode/decode/compare. Distance is
**Euclidean**, not cosine: face-api emits L2-normalised descriptors and its published threshold is
a Euclidean one, so any other measure makes that number meaningless. `BestDistance` matches the
CLOSEST enrolled sample, never the average — averaging poses produces a vector resembling none of
them. `IsWellFormed` rejects wrong lengths and vectors whose magnitude is not ~1.
- **`Face:MatchThreshold` defaults to 0.45 and has NOT been tuned on real faces.** face-api
  documents 0.6, but that is tuned for photo tagging where a false accept costs a mislabel. Tune it
  by reading the distances the API logs on every verify (both success and failure log
  `distance {Distance:F3}`), not by nudging it until one test passes.

`src/APIs/UserManagementAPI/Controllers/UserManagementController.cs` — route `api/UserManagement`.
Admin-facing user CRUD (no class-level `[Authorize]` — check individual actions/frontend gating).
- `GetAllUsers(page, pageSize)` — GET `` — paginated list with roles + full profile picture URLs.
  Roles are one batched `UserRoles ⋈ Roles` query for the whole page (fixed 2026-08-18) — it used to
  `FindByIdAsync` + `GetRolesAsync` PER user (up to 200 extra round trips for a 100-row page,
  re-fetching a user already in hand for the first of the two). Measured against this API's real
  remote DB: 5.3s → 0.64s for a 100-row page. This endpoint runs right after every login
  (`TestingReact`'s `/api/auth/login` route enriches the login response from it), so the old
  version made every login pay that cost — mostly invisible against production, where the DB sits
  close to the API, but very visible running this API locally against the same remote DB, where
  each of those 200 round trips crosses the public internet instead of a rack-local network.
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

`src/APIs/UserManagementAPI/Controllers/AppSettingsController.cs` — route
`api/AppSettings`. System-wide settings every signed-in user shares —
currently just the sidebar logo. The one place this app persists a setting
server-side rather than per-browser in `localStorage` (contrast Settings →
Theme & Branding in `TestingReact`, which is deliberately per-device).
- `GetLogo()` — GET `logo`, `[Authorize]` — `{ logoUrl }` from the single
  `AppSettings` row (seeded at `Id = 1` by the `AddAppSettings` migration).
- `UpdateLogo(UpdateAppLogoViewModel)` — PUT `logo`,
  `[Authorize(Roles="Admin,SuperAdmin")]` — any signed-in user could
  otherwise overwrite the logo everyone else sees, since this setting has no
  per-user scope to fall back on.

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
- `AppSettings` (`AppSetting`) → table `dbo.AppSettings` — single fixed row (`Id = 1`),
  seeded by the `AddAppSettings` migration.
- `UserFaceDevices` (`UserFaceDevice`) → table `security.UserFaceDevices` — phones paired for
  face sign-in. `TokenHash` is unique and is the lookup path for every phone login; the token
  itself is never stored.
- `UserFaceTemplates` (`UserFaceTemplate`) → table `security.UserFaceTemplates` — face
  descriptors, several rows per user. Indexed on `UserId` only: there is no query that finds a user
  FROM a descriptor and there must not be, because that is face *search* over the whole staff list,
  which is a different feature with different consent.
- `UserCredentials` (`UserCredential`) → table `security.UserCredentials` — WebAuthn passkeys.
  Unique index on `CredentialId` (**not** per-user: login resolves the account FROM the credential
  id, so a collision would be an authentication bug), index on `UserId`, cascade delete from
  `ApplicationUser`.
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

`src/APIs/UserManagementAPI/Models/AppSetting.cs` — `AppSetting`: `Id`, `LogoUrl`
(nullable), `UpdatedAt`, `UpdatedByUserId`. Single-row settings table — see
`AppSettingsController`.

`src/APIs/UserManagementAPI/Models/ApplicationUser.cs` — `ApplicationUser : IdentityUser`.
Adds `FirstName`, `LastName` (required), `ProfilePictureUrl` (relative path, max 500),
`Messages` (nav collection, initialized in ctor).

`src/APIs/UserManagementAPI/Models/UserCredential.cs` — `UserCredential`: `Id`, `UserId`,
`CredentialId`, `PublicKey`, `UserHandle`, `SignCount`, `CredType`, `AaGuid`, `Transports`,
`IsBackedUp`, `DeviceName`, `CreatedAt`, `LastUsedAt`, `User` (nav). **Contains no secret and no
biometric data** — `PublicKey` is the public half of a keypair whose private half never leaves the
user's device, and no face image or template is stored anywhere in this system. `SignCount` is
`long` rather than the spec's `uint` because SQL Server has no unsigned integer type; cast at the
boundary. A counter that never moves is normal — every synced passkey reports 0.

`src/APIs/UserManagementAPI/Models/UserFaceTemplate.cs` — `UserFaceTemplate`: `Id`, `UserId`,
`Embedding` (raw float32), `Dimensions`, `SampleIndex`, `CreatedAt`, `User` (nav). **Unlike
`UserCredential`, this IS sensitive personal data** — a descriptor is derived from a biometric and
cannot be reissued. No image is ever stored, enrolment is opt-in and user-removable, and the
descriptor is not reversible into a recognisable photograph.

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

`src/APIs/UserManagementAPI/Services/ITokenIssuer.cs` /
`src/APIs/UserManagementAPI/Services/TokenIssuer.cs` — mints the JWT (name/id/email/jti + every role
+ every permission claim those roles carry) and the persisted refresh token. Registered scoped.
Exists so passkey login produces a token indistinguishable from the password path's.
- **`AuthController` still has its own private copies of both methods and was deliberately NOT
  changed to call this.** Rewiring the password login path was more risk than the passkey feature
  justified. They are duplicates and can drift — if you add a claim, add it in BOTH, or collapse
  them as a separate change with its own verification against a real login.

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

`src/APIs/UserManagementAPI/ViewModel/UpdateProfilePictureUrlViewModel.cs` — now bound by
`AuthController.UpdateProfilePictureUrl` (added 2026-08-18). Was declared but unused before
that — grep before assuming any "unused" ViewModel in this index still is.

`src/APIs/UserManagementAPI/ViewModel/UpdateAppLogoViewModel.cs` — `LogoUrl` (nullable,
max 500). Bound by `AppSettingsController.UpdateLogo`; an empty/null value clears the
logo back to the sidebar's default mark.

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

`src/APIs/UserManagementAPI/Migrations/` — EF Core migration history (5 migrations:
`AddRefreshTokenTable`, `AddLeaveManagement`, `AddAppSettings`, `AddWebAuthnCredentials`,
`AddFaceTemplates`, plus `UserManagementContextModelSnapshot.cs`). Both 2026-08-22 migrations have
been APPLIED via `sql/webauthn-usercredentials.sql` and `sql/face-templates.sql`.

`AddFaceTemplates` scaffolded clean — no AppSettings drift, because `AddWebAuthnCredentials`'s
snapshot fix (below) absorbed it.

**`AddWebAuthnCredentials` was hand-edited after scaffolding, and the reason matters.** EF also
emitted `AddColumn` for `AppSettings.AccentColor` / `LogoScale` / `SurfaceStyle` plus an
`UpdateData` resetting the settings row — that was EF's "may result in the loss of data" warning.
Those three columns are **pre-existing drift**: they are in `Models/AppSetting.cs` and are read and
written by `AppSettingsController` and the frontend's `services/appSettings.ts`, all shipping code,
so they already exist in the database, added out-of-band the same way the `Leave*` tables were.
Replaying them would fail the migration on "column already exists", and the `UpdateData` would have
overwritten the live branding row. All four operations were removed; only `CREATE TABLE
security.UserCredentials` + its two indexes remain. The regenerated snapshot DOES describe those
columns, which brings EF's bookkeeping in line with the database instead of leaving them to be
re-proposed forever. Skip Designer/snapshot files — regenerate
from `Data/UserManagementContext.cs` if needed.

**`dotnet ef database update` cannot be run blindly against the real remote DB
(verified 2026-08-18).** `AddLeaveManagement`'s tables (`LeaveTypes`,
`LeaveRequests`, `LeaveApprovals`, `LeaveBalances`) already exist in the
database, but that migration is NOT recorded in `__EFMigrationsHistory` —
someone applied that schema out-of-band (a raw script, a different
environment) without going through EF's migration bookkeeping. Running
`database update` normally tries to replay every pending migration in order
starting from `AddLeaveManagement`, hits `CREATE TABLE` on a table that
already exists, and fails with `There is already an object named 'LeaveTypes'
in the database` — before it ever reaches a genuinely new migration behind it.

This was NOT fixed (retroactively marking `AddLeaveManagement` "applied"
without verifying every column/index of the out-of-band version matches the
migration exactly would risk hiding real drift — a judgement call, not a
mechanical one). The workaround used for `AddAppSettings`: generate an
isolated script for just the new migration and run it directly —

```bash
dotnet-ef migrations script 20260421022411_AddLeaveManagement <new-migration-id> \
  --idempotent -o migration.sql
sqlcmd -S <host> -U SA -P '<password>' -d EngineerUserDB -C -i migration.sql
```

The script for `AddWebAuthnCredentials` is already generated and committed at
`sql/webauthn-usercredentials.sql` (from `AddAppSettings`, `--idempotent`). **Not yet run** — until
it is, every passkey endpoint that touches the table answers 500 with
`Invalid object name 'security.UserCredentials'`.

— which both applies the new migration and correctly records it in
`__EFMigrationsHistory`, without touching `AddLeaveManagement` at all. Do the
same for the next migration rather than running a plain `database update`.
