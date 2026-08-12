        using ServiceMaintenance.Configuration;
        using ServiceMaintenance.Models;
        using System.Net.Http.Json;

        namespace ServiceMaintenance.Services.BISServices
        {
            public class SaleConfirmedService
            {
                private readonly HttpClient _httpClient;

                public SaleConfirmedService(HttpClient httpClient)
                {
                    _httpClient = httpClient;
                }

                private string GetFullUrl(string endpoint)
                {
                    return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
                }

                public async Task SetSaleConfirmedAsync(SetSaleConfirmedRequest request)
                {
                    var fullUrl = GetFullUrl("/api/saleconfirmed");
                    var response = await _httpClient.PostAsJsonAsync(fullUrl, request);
                    if (!response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        throw new HttpRequestException(
                            $"Failed to set sale confirmed. Status: {response.StatusCode}, Response: {responseContent}");
                    }
                }
            }
        }