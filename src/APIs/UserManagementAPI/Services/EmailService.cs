using System.Net;
using System.Net.Mail;
using System.Text.Encodings.Web;

namespace UserManagementAPI.Services
{
    public class EmailService : IEmailService
    {
        // User names and links are interpolated into an HTML body below. Without
        // encoding, a display name containing markup is rendered as markup by
        // the recipient's mail client - and registration is open, so that value
        // is attacker-controlled.
        private static string Html(string value) => HtmlEncoder.Default.Encode(value ?? string.Empty);

        /// <summary>
        /// Encodes a URL for use inside an href attribute. HTML encoding, not
        /// URL encoding: the link is already a well-formed URL, and percent-
        /// encoding it here would break it. What this has to stop is the quote
        /// that would end the attribute and let markup in.
        /// </summary>
        private static string Attr(string value) => Html(value);

        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task SendEmailConfirmationAsync(string email, string userName, string confirmationLink)
        {
            var subject = "Confirm Your Email Address";
            var body = $@"
                <html>
                <body>
                    <h2>Welcome {Html(userName)}!</h2>
                    <p>Thank you for registering. Please confirm your email address by clicking the link below:</p>
                    <p><a href='{Attr(confirmationLink)}'>Confirm Email</a></p>
                    <p>If you didn't register for an account, please ignore this email.</p>
                </body>
                </html>
            ";

            await SendEmailAsync(email, subject, body);
        }

        public async Task SendPasswordResetAsync(string email, string userName, string resetLink)
        {
            var subject = "Reset Your Password";
            var body = $@"
                <html>
                <body>
                    <h2>Hello {Html(userName)},</h2>
                    <p>You requested to reset your password. Click the link below to reset it:</p>
                    <p><a href='{Attr(resetLink)}'>Reset Password</a></p>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                </body>
                </html>
            ";

            await SendEmailAsync(email, subject, body);
        }

        public async Task SendWelcomeEmailAsync(string email, string userName)
        {
            var subject = "Welcome to Our Platform!";
            var body = $@"
                <html>
                <body>
                    <h2>Welcome {Html(userName)}!</h2>
                    <p>Thank you for joining our platform. We're excited to have you on board!</p>
                    <p>Get started by exploring our features and let us know if you need any help.</p>
                </body>
                </html>
            ";

            await SendEmailAsync(email, subject, body);
        }

        private async Task SendEmailAsync(string email, string subject, string body)
        {
            try
            {
                var smtpHost = _configuration["Email:SmtpHost"];
                var smtpPort = int.Parse(_configuration["Email:SmtpPort"] ?? "587");
                var smtpUser = _configuration["Email:SmtpUser"];
                var smtpPass = _configuration["Email:SmtpPass"];
                var fromEmail = _configuration["Email:FromEmail"];
                var fromName = _configuration["Email:FromName"];

                using var client = new SmtpClient(smtpHost, smtpPort)
                {
                    Credentials = new NetworkCredential(smtpUser, smtpPass),
                    EnableSsl = true
                };

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(fromEmail, fromName),
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = true
                };

                mailMessage.To.Add(email);

                await client.SendMailAsync(mailMessage);
                _logger.LogInformation("Email sent successfully to {Email}", email);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {Email}", email);
                // In production, you might want to queue failed emails for retry
                throw;
            }
        }
    }
}