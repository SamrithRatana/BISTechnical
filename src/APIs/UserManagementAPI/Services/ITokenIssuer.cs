using System.IdentityModel.Tokens.Jwt;
using UserManagementAPI.Models;

namespace UserManagementAPI.Services
{
    /// <summary>
    /// Mints the session credentials an authenticated user walks away with: a
    /// signed JWT carrying their roles and permission claims, plus a refresh
    /// token row.
    ///
    /// Exists because passkey login (<c>WebAuthnController</c>) has to produce a
    /// token that is indistinguishable from the one password login produces —
    /// the frontend's <c>authSession.ts</c>, <c>AuthGuard</c> and every
    /// permission check read the same claims either way, and a passkey session
    /// that quietly carried fewer claims would present as random authorization
    /// failures rather than as a login bug.
    ///
    /// NOTE: <c>AuthController</c> still has its own private copies of both
    /// methods and was deliberately NOT changed to call this — rewiring the
    /// password login path was more risk than this feature justified. They are
    /// duplicates and can drift; collapsing them is a follow-up that needs its
    /// own verification against a real login.
    /// </summary>
    public interface ITokenIssuer
    {
        /// <summary>Builds a signed JWT with name/id/email/jti, every role, and every permission claim those roles carry.</summary>
        Task<JwtSecurityToken> CreateJwtAsync(ApplicationUser user);

        /// <summary>
        /// Same, for a caller that has ALREADY loaded this user's roles.
        ///
        /// Every caller of the parameterless overload needs the role list itself —
        /// to put in the session body the client reads — so both of them fetched
        /// it, then this method fetched it again. Measured on the face
        /// approve-session path: the session-minting phase ran 548-766ms against
        /// a database on the far side of the public internet, where one avoidable
        /// round trip is worth roughly a fifth of it.
        /// </summary>
        Task<JwtSecurityToken> CreateJwtAsync(ApplicationUser user, IList<string> userRoles);

        /// <summary>Creates and persists a refresh token bound to the given JWT's <c>jti</c>.</summary>
        Task<string> CreateRefreshTokenAsync(ApplicationUser user, string jwtId);
    }
}
