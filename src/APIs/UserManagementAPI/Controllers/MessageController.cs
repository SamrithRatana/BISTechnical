using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UserManagementAPI.Data;
using UserManagementAPI.Models;

namespace UserManagementAPI.Controllers
{
    /// <summary>
    /// Direct messages between users.
    /// </summary>
    /// <remarks>
    /// Every endpoint here took the participant ids from the request and never
    /// compared them to the caller. `[Authorize]` meant a token was required,
    /// but ANY token worked: a signed-in user could read any two other people's
    /// conversation by passing their ids, read any message by its id, mark
    /// someone else's messages read, delete any message, and - because
    /// SendMessage took `UserID` from the body - post a message under another
    /// user's name. Ownership is now derived from the caller's own
    /// NameIdentifier claim rather than trusted from the request.
    /// </remarks>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MessageController : ControllerBase
    {
        private const int MaxPageSize = 200;

        private readonly UserManagementContext _context;
        private readonly ILogger<MessageController> _logger;

        public MessageController(UserManagementContext context, ILogger<MessageController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>The signed-in caller's user id, taken from the token.</summary>
        private string CallerId => User.FindFirstValue(ClaimTypes.NameIdentifier);

        // GET: api/Message/conversation
        [HttpGet("conversation")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> GetConversation(
            [FromQuery] string userId,
            [FromQuery] string recipientId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(recipientId))
            {
                return BadRequest(new { Status = "Error", Message = "userId and recipientId are required." });
            }

            // The caller has to be one of the two participants.
            var callerId = CallerId;
            if (!string.Equals(callerId, userId, StringComparison.Ordinal) &&
                !string.Equals(callerId, recipientId, StringComparison.Ordinal))
            {
                return Forbid();
            }

            page = page < 1 ? 1 : page;
            pageSize = pageSize < 1 ? 50 : (pageSize > MaxPageSize ? MaxPageSize : pageSize);

            var messages = await _context.Messages
                .AsNoTracking()
                .Where(m => (m.UserID == userId && m.RecipientID == recipientId) ||
                           (m.UserID == recipientId && m.RecipientID == userId))
                .OrderByDescending(m => m.When)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new MessageDto
                {
                    Id = m.Id,
                    UserName = m.UserName,
                    Text = m.Text,
                    When = m.When,
                    UserID = m.UserID,
                    RecipientID = m.RecipientID,
                    IsRead = m.IsRead,
                    FileUrl = m.FileUrl,
                    AudioURL = m.AudioURL,
                    VideoUrl = m.VideoUrl,
                    ReplyToMessageId = m.ReplyToMessageId,
                    ReplyToUserName = m.ReplyToUserName,
                    ReplyToText = m.ReplyToText
                })
                .ToListAsync();

            return Ok(new { Data = messages.OrderBy(m => m.When), Page = page, PageSize = pageSize });
        }

        // GET: api/Message/{id}
        [HttpGet("{id:int}")]
        public async Task<ActionResult<MessageDto>> GetMessage(int id)
        {
            var callerId = CallerId;

            var message = await _context.Messages
                .AsNoTracking()
                .Where(m => m.Id == id && (m.UserID == callerId || m.RecipientID == callerId))
                .Select(m => new MessageDto
                {
                    Id = m.Id,
                    UserName = m.UserName,
                    Text = m.Text,
                    When = m.When,
                    UserID = m.UserID,
                    RecipientID = m.RecipientID,
                    IsRead = m.IsRead,
                    FileUrl = m.FileUrl,
                    AudioURL = m.AudioURL,
                    VideoUrl = m.VideoUrl,
                    ReplyToMessageId = m.ReplyToMessageId,
                    ReplyToUserName = m.ReplyToUserName,
                    ReplyToText = m.ReplyToText
                })
                .FirstOrDefaultAsync();

            // A message the caller is not party to is reported as missing
            // rather than forbidden, so this cannot be used to probe for the
            // existence of other people's messages.
            if (message == null)
                return NotFound();

            return Ok(message);
        }

        // GET: api/Message/last
        [HttpGet("last")]
        public async Task<ActionResult<MessageDto>> GetLastMessage(
            [FromQuery] string userId,
            [FromQuery] string recipientId)
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(recipientId))
            {
                return BadRequest(new { Status = "Error", Message = "userId and recipientId are required." });
            }

            var callerId = CallerId;
            if (!string.Equals(callerId, userId, StringComparison.Ordinal) &&
                !string.Equals(callerId, recipientId, StringComparison.Ordinal))
            {
                return Forbid();
            }

            var message = await _context.Messages
                .AsNoTracking()
                .Where(m => (m.UserID == userId && m.RecipientID == recipientId) ||
                           (m.UserID == recipientId && m.RecipientID == userId))
                .OrderByDescending(m => m.When)
                .Select(m => new MessageDto
                {
                    Id = m.Id,
                    UserName = m.UserName,
                    Text = m.Text,
                    When = m.When,
                    UserID = m.UserID,
                    RecipientID = m.RecipientID,
                    IsRead = m.IsRead
                })
                .FirstOrDefaultAsync();

            if (message == null)
                return NotFound();

            return Ok(message);
        }

        // GET: api/Message/unread/counts
        [HttpGet("unread/counts")]
        public async Task<ActionResult> GetUnreadCounts()
        {
            try
            {
                // The recipient is always the caller. It used to be a query
                // parameter, so anyone could read anyone else's unread tallies.
                var recipientId = CallerId;

                var counts = await _context.Messages
                    .AsNoTracking()
                    .Where(m => m.RecipientID == recipientId && !m.IsRead)
                    .GroupBy(m => m.UserID)
                    .Select(g => new { SenderId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.SenderId, x => x.Count);

                return Ok(new
                {
                    Status = "Success",
                    Message = $"Found unread messages from {counts.Count} senders",
                    Data = counts
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unread counts.");
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = "An error occurred while reading unread counts.",
                    Data = new Dictionary<string, int>()
                });
            }
        }

        // GET: api/Message/unread/count
        [HttpGet("unread/count")]
        public async Task<ActionResult<int>> GetUnreadCount([FromQuery] string senderId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(senderId))
                {
                    return BadRequest(new { Status = "Error", Message = "senderId is required.", Count = 0 });
                }

                var recipientId = CallerId;

                var count = await _context.Messages
                    .AsNoTracking()
                    .CountAsync(m => m.RecipientID == recipientId && m.UserID == senderId && !m.IsRead);

                return Ok(new
                {
                    Status = "Success",
                    Message = $"Found {count} unread messages",
                    Count = count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unread count.");
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = "An error occurred while reading the unread count.",
                    Count = 0
                });
            }
        }

        // POST: api/Message
        [HttpPost]
        public async Task<ActionResult<MessageDto>> SendMessage([FromBody] SendMessageDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Text))
            {
                return BadRequest(new { Status = "Error", Message = "Message text is required." });
            }

            if (string.IsNullOrWhiteSpace(dto.RecipientID))
            {
                return BadRequest(new { Status = "Error", Message = "RecipientID is required." });
            }

            var message = new Message
            {
                UserName = dto.UserName,
                Text = dto.Text,
                // Sender is the authenticated caller, NOT dto.UserID. Taking it
                // from the body let any signed-in user post as anyone else.
                UserID = CallerId,
                RecipientID = dto.RecipientID,
                FileUrl = dto.FileUrl,
                AudioURL = dto.AudioURL,
                VideoUrl = dto.VideoUrl,
                ReplyToMessageId = dto.ReplyToMessageId,
                ReplyToUserName = dto.ReplyToUserName,
                ReplyToText = dto.ReplyToText,
                When = DateTime.UtcNow,
                IsRead = false
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var result = new MessageDto
            {
                Id = message.Id,
                UserName = message.UserName,
                Text = message.Text,
                When = message.When,
                UserID = message.UserID,
                RecipientID = message.RecipientID,
                IsRead = message.IsRead,
                FileUrl = message.FileUrl,
                AudioURL = message.AudioURL,
                VideoUrl = message.VideoUrl,
                ReplyToMessageId = message.ReplyToMessageId,
                ReplyToUserName = message.ReplyToUserName,
                ReplyToText = message.ReplyToText
            };

            return CreatedAtAction(nameof(GetMessage), new { id = message.Id }, result);
        }

        // PUT: api/Message/read
        [HttpPut("read")]
        public async Task<ActionResult> MarkMessagesAsRead([FromBody] MarkReadRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.SenderId))
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "SenderId is required",
                        MarkedCount = 0
                    });
                }

                // Only the recipient can mark their own messages read; the
                // recipient id is the caller, not a value from the body.
                var recipientId = CallerId;

                // One UPDATE rather than loading every unread row to flip a bool.
                var marked = await _context.Messages
                    .Where(m => m.RecipientID == recipientId &&
                                m.UserID == request.SenderId &&
                                !m.IsRead)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(m => m.IsRead, true));

                return Ok(new
                {
                    Status = "Success",
                    Message = marked == 0 ? "No unread messages" : $"Marked {marked} messages as read",
                    MarkedCount = marked
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking messages as read.");
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = "An error occurred while marking messages as read.",
                    MarkedCount = 0
                });
            }
        }

        // DELETE: api/Message/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteMessage(int id)
        {
            var callerId = CallerId;

            // Only the sender may delete their own message. This used to delete
            // any message by id, for any signed-in caller.
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.Id == id && m.UserID == callerId);

            if (message == null)
                return NotFound();

            _context.Messages.Remove(message);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Message/byReportNo/{reportNo}
        //
        // Bulk cleanup that accompanies deleting a ticket, so it is not scoped
        // to one user's messages - which is exactly why it needs to be an
        // administrator action rather than something any signed-in caller can
        // invoke on any report number.
        [HttpDelete("byReportNo/{reportNo}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteMessagesByReportNo(string reportNo)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(reportNo))
                {
                    return BadRequest(new { Status = "Error", Message = "reportNo is required.", DeletedCount = 0 });
                }

                var withSpace = $"ReportNo: {reportNo}";
                var withoutSpace = $"ReportNo:{reportNo}";

                var deletedCount = await _context.Messages
                    .Where(m => m.Text.Contains(withSpace) || m.Text.Contains(withoutSpace))
                    .ExecuteDeleteAsync();

                _logger.LogInformation(
                    "Deleted {DeletedCount} message(s) for report {ReportNo}.", deletedCount, reportNo);

                return Ok(new
                {
                    Status = "Success",
                    Message = deletedCount == 0
                        ? "No messages found with this ReportNo"
                        : $"Deleted {deletedCount} messages",
                    DeletedCount = deletedCount
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting messages for report {ReportNo}.", reportNo);
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = "An error occurred while deleting messages.",
                    DeletedCount = 0
                });
            }
        }
    }

    // DTOs for bandwidth optimization
    public class MessageDto
    {
        public int Id { get; set; }
        public string UserName { get; set; }
        public string Text { get; set; }
        public DateTime When { get; set; }
        public string UserID { get; set; }
        public string RecipientID { get; set; }
        public bool IsRead { get; set; }
        public string FileUrl { get; set; }
        public string AudioURL { get; set; }
        public string VideoUrl { get; set; }
        public int? ReplyToMessageId { get; set; }
        public string ReplyToUserName { get; set; }
        public string ReplyToText { get; set; }
    }

    public class SendMessageDto
    {
        public string UserName { get; set; }
        public string Text { get; set; }

        /// <summary>
        /// Ignored. The sender is taken from the caller's token; this remains
        /// only so existing clients posting it do not fail model binding.
        /// </summary>
        public string UserID { get; set; }

        public string RecipientID { get; set; }
        public string FileUrl { get; set; }
        public string AudioURL { get; set; }
        public string VideoUrl { get; set; }
        public int? ReplyToMessageId { get; set; }
        public string ReplyToUserName { get; set; }
        public string ReplyToText { get; set; }
    }

    /// <summary>Request model for marking messages as read.</summary>
    public class MarkReadRequest
    {
        /// <summary>
        /// Ignored. The recipient is always the caller; kept so existing
        /// clients posting it do not fail model binding.
        /// </summary>
        public string RecipientId { get; set; }

        public string SenderId { get; set; }
    }
}
