namespace ServiceMaintenance.Pages.Parents.ItemModule
{
    // Program.cs or Startup.cs
    public static class HttpClientExtensions
    {
        public static HttpClient CreateHttpClientIgnoreCertificateErrors()
        {
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (message, certificate, chain, errors) => true
            };

            return new HttpClient(handler);
        }
    }

}
