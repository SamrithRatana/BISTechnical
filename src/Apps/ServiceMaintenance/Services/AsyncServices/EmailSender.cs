using Microsoft.Extensions.Options;
using System.Net.Mail;
using System.Net;
using Microsoft.AspNetCore.Identity.UI.Services;
using System.Threading.Tasks;
namespace ServiceMaintenance.Services.AsyncServices
{

    public class EmailSender : IEmailSender
    {
        private readonly AuthMessageSenderOptions _options;

        public EmailSender(IOptions<AuthMessageSenderOptions> options)
        {
            _options = options.Value;
        }

        public Task SendEmailAsync(string email, string subject, string message)
        {
            // Check if the email or SmtpFromEmail is null or empty
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(_options.SmtpFromEmail))
            {
                throw new ArgumentNullException("Email or From Email address is null.");
            }

            // Set up the SMTP client
            var smtpClient = new SmtpClient(_options.SmtpServer)
            {
                // Try using port 587 for TLS, which is often more stable
                Port = 587,  // 587 is the default for Gmail with TLS, and 465 is for SSL
                Credentials = new NetworkCredential(_options.SmtpUsername, _options.SmtpPassword),
                EnableSsl = true,  // Ensure SSL is enabled
            };

            // Create the email message
            var mailMessage = new MailMessage
            {
                From = new MailAddress(_options.SmtpFromEmail),
                Subject = subject,
                Body = message,
                IsBodyHtml = true,
            };

            // Add the recipient email address
            mailMessage.To.Add(email);

            // Send the email asynchronously
            return smtpClient.SendMailAsync(mailMessage);
        }


    }

    public class AuthMessageSenderOptions
    {
        public string SmtpServer { get; set; }
        public string SmtpUsername { get; set; }
        public string SmtpPassword { get; set; }
        public string SmtpFromEmail { get; set; }
    }
}
