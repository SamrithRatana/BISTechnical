namespace UserManagementAPI.Services
{
    public interface IEmailService
    {
        Task SendEmailConfirmationAsync(string email, string userName, string confirmationLink);
        Task SendPasswordResetAsync(string email, string userName, string resetLink);
        Task SendWelcomeEmailAsync(string email, string userName);
    }
}
