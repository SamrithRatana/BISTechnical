namespace ServiceMaintenance.ViewModel
{
    public class MessageWithSenderViewModel
    {
        public int Id { get; set; }
        public string UserName { get; set; }
        public string Text { get; set; }
        public DateTime When { get; set; }
        public string UserID { get; set; }
        public string RecipientID { get; set; }
        public string FileUrl { get; set; }
        public string AudioURL { get; set; }
        public string VideoUrl { get; set; }
        public string SenderProfilePicture { get; set; } // Add this
    }
}
