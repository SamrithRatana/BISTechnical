using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using UserManagementAPI.Data;
using UserManagementAPI.Models;

namespace UserManagementAPI.Services
{
    /// <inheritdoc cref="ITokenIssuer"/>
    public class TokenIssuer : ITokenIssuer
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly UserManagementContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TokenIssuer> _logger;

        public TokenIssuer(
            UserManager<ApplicationUser> userManager,
            UserManagementContext context,
            IConfiguration configuration,
            ILogger<TokenIssuer> logger)
        {
            _userManager = userManager;
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<JwtSecurityToken> CreateJwtAsync(ApplicationUser user)
            => await CreateJwtAsync(user, await _userManager.GetRolesAsync(user));

        public async Task<JwtSecurityToken> CreateJwtAsync(ApplicationUser user, IList<string> userRoles)
        {
            var authClaims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.UserName),
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };

            userRoles ??= await _userManager.GetRolesAsync(user);

            foreach (var roleName in userRoles)
            {
                authClaims.Add(new Claim(ClaimTypes.Role, roleName));
            }

            // One query for every permission claim across ALL of this user's
            // roles — the same batched shape AuthController uses, for the same
            // reason: this runs on every login and every refresh.
            var roleClaims = await _context.Roles
                .Where(r => userRoles.Contains(r.Name))
                .Join(_context.RoleClaims, r => r.Id, rc => rc.RoleId,
                    (r, rc) => new { r.Name, rc.ClaimType, rc.ClaimValue })
                .ToListAsync();

            foreach (var roleClaim in roleClaims)
            {
                authClaims.Add(new Claim(roleClaim.ClaimType, roleClaim.ClaimValue));
            }

            _logger.LogDebug(
                "Issued JWT for {UserName}: {RoleCount} role(s), {ClaimCount} claim(s).",
                user.UserName, userRoles.Count, authClaims.Count);

            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JWT:Secret"]));
            var tokenValidityInHours = Convert.ToDouble(_configuration["JWT:TokenValidityInHours"] ?? "3");

            return new JwtSecurityToken(
                issuer: _configuration["JWT:ValidIssuer"],
                audience: _configuration["JWT:ValidAudience"],
                expires: DateTime.UtcNow.AddHours(tokenValidityInHours),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );
        }

        public async Task<string> CreateRefreshTokenAsync(ApplicationUser user, string jwtId)
        {
            var refreshTokenValidityInDays = Convert.ToInt32(
                _configuration["JWT:RefreshTokenValidityInDays"] ?? "30"
            );

            var refreshToken = new RefreshToken
            {
                UserId = user.Id,
                // 64 bytes from the crypto RNG — a refresh token is a bearer
                // credential valid for 30 days.
                Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
                JwtId = jwtId,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenValidityInDays),
                IsUsed = false,
                IsRevoked = false
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();

            _logger.LogDebug("Refresh token created for {UserName}, expires {ExpiresAt}.", user.UserName, refreshToken.ExpiresAt);

            return refreshToken.Token;
        }
    }
}
