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
    public class MessageController : ControllerBase
    {
        private readonly UserManagementContext _context;
        private readonly ILogger<MessageController> _logger; // ✅ ADD THIS

        // ✅ FIXED: Add logger to constructor
        public MessageController(UserManagementContext context, ILogger<MessageController> logger)
        {
            _context = context;
            _logger = logger; // ✅ ADD THIS
        }

        // GET: api/Message/conversation
        [HttpGet("conversation")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> GetConversation(
            [FromQuery] string userId,
            [FromQuery] string recipientId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var messages = await _context.Messages
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
        [HttpGet("{id}")]
        public async Task<ActionResult<MessageDto>> GetMessage(int id)
        {
            var message = await _context.Messages
                .Where(m => m.Id == id)
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
            var message = await _context.Messages
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

        // ✅ FIXED: GET: api/Message/unread/counts
        [HttpGet("unread/counts")]
        public async Task<ActionResult> GetUnreadCounts([FromQuery] string recipientId)
        {
            try
            {
                _logger.LogInformation($"📊 GetUnreadCounts called for recipientId: {recipientId}");

                if (string.IsNullOrEmpty(recipientId))
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "RecipientId is required",
                        Data = new Dictionary<string, int>()
                    });
                }

                // Get unread messages grouped by sender
                var counts = await _context.Messages
                    .Where(m => m.RecipientID == recipientId && !m.IsRead)
                    .GroupBy(m => m.UserID)
                    .Select(g => new { SenderId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.SenderId, x => x.Count);

                _logger.LogInformation($"✅ Found {counts.Count} senders with unread messages");

                // ✅ CRITICAL: Return wrapped response, not raw dictionary
                return Ok(new
                {
                    Status = "Success",
                    Message = $"Found unread messages from {counts.Count} senders",
                    Data = counts  // <-- Dictionary goes inside Data property
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error getting unread counts");
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = $"Internal server error: {ex.Message}",
                    Data = new Dictionary<string, int>()
                });
            }
        }

        // GET: api/Message/unread/count
        [HttpGet("unread/count")]
        public async Task<ActionResult<int>> GetUnreadCount(
            [FromQuery] string recipientId,
            [FromQuery] string senderId)
        {
            try
            {
                _logger.LogInformation($"📊 GetUnreadCount: recipientId={recipientId}, senderId={senderId}");

                var count = await _context.Messages
                    .CountAsync(m => m.RecipientID == recipientId && m.UserID == senderId && !m.IsRead);

                _logger.LogInformation($"✅ Count: {count}");

                return Ok(new
                {
                    Status = "Success",
                    Message = $"Found {count} unread messages",
                    Count = count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error getting unread count");
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = ex.Message,
                    Count = 0
                });
            }
        }

        // POST: api/Message
        [HttpPost]
        public async Task<ActionResult<MessageDto>> SendMessage([FromBody] SendMessageDto dto)
        {
            var message = new Message
            {
                UserName = dto.UserName,
                Text = dto.Text,
                UserID = dto.UserID,
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

        // ✅ FIXED: PUT: api/Message/read
        [HttpPut("read")]
        public async Task<ActionResult> MarkMessagesAsRead([FromBody] MarkReadRequest request)
        {
            try
            {
                _logger.LogInformation($"✉️ MarkMessagesAsRead: recipientId={request.RecipientId}, senderId={request.SenderId}");

                if (string.IsNullOrEmpty(request.RecipientId) || string.IsNullOrEmpty(request.SenderId))
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Both RecipientId and SenderId are required",
                        MarkedCount = 0
                    });
                }

                var messages = await _context.Messages
                    .Where(m => m.RecipientID == request.RecipientId &&
                               m.UserID == request.SenderId &&
                               !m.IsRead)
                    .ToListAsync();

                if (messages.Count == 0)
                {
                    return Ok(new
                    {
                        Status = "Success",
                        Message = "No unread messages",
                        MarkedCount = 0
                    });
                }

                foreach (var msg in messages)
                {
                    msg.IsRead = true;
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation($"✅ Marked {messages.Count} messages as read");

                return Ok(new
                {
                    Status = "Success",
                    Message = $"Marked {messages.Count} messages as read",
                    MarkedCount = messages.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error marking messages as read");
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = ex.Message,
                    MarkedCount = 0
                });
            }
        }

        // DELETE: api/Message/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMessage(int id)
        {
            var message = await _context.Messages.FindAsync(id);
            if (message == null)
                return NotFound();

            _context.Messages.Remove(message);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        // ✅ NEW: DELETE messages by ReportNo
        [HttpDelete("byReportNo/{reportNo}")]
        public async Task<ActionResult> DeleteMessagesByReportNo(string reportNo)
        {
            try
            {
                _logger.LogInformation($"🗑️ Deleting messages with ReportNo: {reportNo}");

                // Find all messages containing this ReportNo
                var messages = await _context.Messages
                    .Where(m => m.Text.Contains($"ReportNo: {reportNo}") ||
                               m.Text.Contains($"ReportNo:{reportNo}"))
                    .ToListAsync();

                if (!messages.Any())
                {
                    _logger.LogInformation($"ℹ️ No messages found with ReportNo: {reportNo}");
                    return Ok(new
                    {
                        Status = "Success",
                        Message = "No messages found with this ReportNo",
                        DeletedCount = 0
                    });
                }

                _logger.LogInformation($"📊 Found {messages.Count} messages to delete");

                _context.Messages.RemoveRange(messages);
                var deletedCount = await _context.SaveChangesAsync();

                _logger.LogInformation($"✅ Deleted {deletedCount} messages for ReportNo: {reportNo}");

                return Ok(new
                {
                    Status = "Success",
                    Message = $"Deleted {deletedCount} messages",
                    DeletedCount = deletedCount
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error deleting messages by ReportNo: {reportNo}");
                return StatusCode(500, new
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}",
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
        public string UserID { get; set; }
        public string RecipientID { get; set; }
        public string FileUrl { get; set; }
        public string AudioURL { get; set; }
        public string VideoUrl { get; set; }
        public int? ReplyToMessageId { get; set; }
        public string ReplyToUserName { get; set; }
        public string ReplyToText { get; set; }
    }

    // ✅ NEW: Request model for marking messages as read
    public class MarkReadRequest
    {
        public string RecipientId { get; set; }
        public string SenderId { get; set; }
    }
}