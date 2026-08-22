using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UserManagementAPI.Data;
using UserManagementAPI.Models;

namespace UserManagementAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ArticleController : ControllerBase
    {
        /// <summary>Ceiling on page size so one request cannot pull the table.</summary>
        private const int MaxPageSize = 100;

        private const int DefaultPageSize = 20;

        private readonly UserManagementContext _context;

        public ArticleController(UserManagementContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Clamps caller-supplied paging. Unclamped, page=0 produced Skip(-20),
        /// which SQL Server rejects, so the request came back as a 500.
        /// </summary>
        private static (int Page, int PageSize) NormalisePaging(int page, int pageSize)
        {
            var safePage = page < 1 ? 1 : page;
            var safeSize = pageSize < 1
                ? DefaultPageSize
                : (pageSize > MaxPageSize ? MaxPageSize : pageSize);

            return (safePage, safeSize);
        }

        // GET: api/Article
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ArticleDto>>> GetArticles(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] bool unreadOnly = false)
        {
            (page, pageSize) = NormalisePaging(page, pageSize);

            var query = _context.Articles.AsNoTracking();

            if (unreadOnly)
            {
                query = query.Where(a => !a.IsRead);
            }

            var articles = await query
                .OrderByDescending(a => a.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new ArticleDto
                {
                    Id = a.Id,
                    ArticleHeading = a.ArticleHeading,
                    ArticleContent = a.ArticleContent,
                    Username = a.Username,
                    ProfilePicture = a.ProfilePicture,
                    Timestamp = a.Timestamp,
                    IsRead = a.IsRead,
                    IsActionVisible = a.IsActionVisible
                })
                .ToListAsync();

            return Ok(new { Data = articles, Page = page, PageSize = pageSize });
        }

        // GET: api/Article/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ArticleDto>> GetArticle(int id)
        {
            var article = await _context.Articles
                .AsNoTracking()
                .Where(a => a.Id == id)
                .Select(a => new ArticleDto
                {
                    Id = a.Id,
                    ArticleHeading = a.ArticleHeading,
                    ArticleContent = a.ArticleContent,
                    Username = a.Username,
                    ProfilePicture = a.ProfilePicture,
                    Timestamp = a.Timestamp,
                    IsRead = a.IsRead,
                    IsActionVisible = a.IsActionVisible
                })
                .FirstOrDefaultAsync();

            if (article == null)
                return NotFound();

            return Ok(article);
        }

        // GET: api/Article/user/{username}
        [HttpGet("user/{username}")]
        public async Task<ActionResult<IEnumerable<ArticleDto>>> GetUserArticles(
            string username,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            (page, pageSize) = NormalisePaging(page, pageSize);

            var articles = await _context.Articles
                .AsNoTracking()
                .Where(a => a.Username == username)
                .OrderByDescending(a => a.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new ArticleDto
                {
                    Id = a.Id,
                    ArticleHeading = a.ArticleHeading,
                    ArticleContent = a.ArticleContent,
                    Username = a.Username,
                    ProfilePicture = a.ProfilePicture,
                    Timestamp = a.Timestamp,
                    IsRead = a.IsRead,
                    IsActionVisible = a.IsActionVisible
                })
                .ToListAsync();

            return Ok(new { Data = articles, Page = page, PageSize = pageSize });
        }

        // GET: api/Article/unread/count
        [HttpGet("unread/count")]
        public async Task<ActionResult<int>> GetUnreadCount()
        {
            var count = await _context.Articles.AsNoTracking().CountAsync(a => !a.IsRead);
            return Ok(new { Count = count });
        }

        // POST: api/Article
        [HttpPost]
        public async Task<ActionResult<ArticleDto>> CreateArticle([FromBody] CreateArticleDto dto)
        {
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Anonymous";

            var article = new Article
            {
                ArticleHeading = dto.ArticleHeading,
                ArticleContent = dto.ArticleContent,
                // Author is the authenticated caller. dto.Username used to win
                // when supplied, so any signed-in user could post under another
                // person's name.
                Username = username,
                ProfilePicture = dto.ProfilePicture,
                Timestamp = DateTime.UtcNow,
                IsRead = false,
                IsActionVisible = dto.IsActionVisible
            };

            _context.Articles.Add(article);
            await _context.SaveChangesAsync();

            var result = new ArticleDto
            {
                Id = article.Id,
                ArticleHeading = article.ArticleHeading,
                ArticleContent = article.ArticleContent,
                Username = article.Username,
                ProfilePicture = article.ProfilePicture,
                Timestamp = article.Timestamp,
                IsRead = article.IsRead,
                IsActionVisible = article.IsActionVisible
            };

            return CreatedAtAction(nameof(GetArticle), new { id = article.Id }, result);
        }

        // PUT: api/Article/{id}/read
        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var article = await _context.Articles.FindAsync(id);
            if (article == null)
                return NotFound();

            article.IsRead = true;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/Article/visibility
        [HttpPut("visibility")]
        public async Task<IActionResult> UpdateVisibility([FromBody] UpdateVisibilityDto dto)
        {
            var article = await _context.Articles
                .FirstOrDefaultAsync(a => a.ArticleHeading.Contains($"Ref No: {dto.ReportNo}"));

            if (article == null)
                return NotFound();

            article.IsActionVisible = dto.IsVisible;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Article/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteArticle(int id)
        {
            var article = await _context.Articles.FindAsync(id);
            if (article == null)
                return NotFound();

            _context.Articles.Remove(article);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }

    // DTOs for bandwidth optimization
    public class ArticleDto
    {
        public int Id { get; set; }
        public string ArticleHeading { get; set; }
        public string ArticleContent { get; set; }
        public string Username { get; set; }
        public string ProfilePicture { get; set; }
        public DateTime Timestamp { get; set; }
        public bool IsRead { get; set; }
        public bool IsActionVisible { get; set; }
    }

    public class CreateArticleDto
    {
        public string ArticleHeading { get; set; }
        public string ArticleContent { get; set; }
        public string Username { get; set; }
        public string ProfilePicture { get; set; }
        public bool IsActionVisible { get; set; }
    }

    public class UpdateVisibilityDto
    {
        public string ReportNo { get; set; }
        public bool IsVisible { get; set; }
    }
}