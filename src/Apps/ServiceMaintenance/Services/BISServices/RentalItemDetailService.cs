using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;

namespace ServiceMaintenance.Services.BISServices
{
    public class RentalItemDetailService
    {
        private readonly HttpClient _httpClient;

        public RentalItemDetailService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        /// <summary>
        /// Get rental item detail by ID and convert to domain model
        /// </summary>
        /// <param name="id">The rental item detail ID</param>
        /// <returns>RentalItem domain model</returns>
        public async Task<RentalItem> GetRentalItemByIdAsync(string id)
        {
            var response = await GetRentalItemDetailByIdAsync(id);
            return response.ToRentalItem();
        }

        /// <summary>
        /// Get rental item detail by ID (raw API response)
        /// </summary>
        /// <param name="id">The rental item detail ID</param>
        /// <returns>Rental item detail API response</returns>
        public async Task<RentalItemDetailResponse> GetRentalItemDetailByIdAsync(string id)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/rentalitemdetail/{id}");
            var response = await _httpClient.GetAsync(fullUrl);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to get rental item detail by ID. Status: {response.StatusCode}, Response: {responseContent}");
            }

            return await response.Content.ReadFromJsonAsync<RentalItemDetailResponse>();
        }

        /// <summary>
        /// Get rental item details with optional date filtering
        /// </summary>
        /// <param name="fromDate">Start date for filtering (optional)</param>
        /// <param name="toDate">End date for filtering (optional)</param>
        /// <returns>List of rental item details</returns>
        public async Task<IEnumerable<RentalItemDetailResponse>> GetRentalItemDetailsAsync(DateTime? fromDate = null, DateTime? toDate = null)
        {
            var queryParams = new List<string>();

            if (fromDate.HasValue)
            {
                queryParams.Add($"fromDate={fromDate.Value:yyyy-MM-ddTHH:mm:ss}");
            }

            if (toDate.HasValue)
            {
                queryParams.Add($"toDate={toDate.Value:yyyy-MM-ddTHH:mm:ss}");
            }

            var queryString = queryParams.Count > 0 ? $"&{string.Join("&", queryParams)}" : "";
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/rentalitemdetail{queryString}");
            var response = await _httpClient.GetAsync(fullUrl);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to get rental item details. Status: {response.StatusCode}, Response: {responseContent}");
            }

            var result = await response.Content.ReadFromJsonAsync<IEnumerable<RentalItemDetailResponse>>();
            return result ?? new List<RentalItemDetailResponse>();
        }

        /// <summary>
        /// Get rental item detail by serial number
        /// </summary>
        /// <param name="serialNo">The serial number</param>
        /// <returns>Rental item detail information</returns>
        public async Task<RentalItemDetailResponse> GetRentalItemDetailBySerialNoAsync(string serialNo)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/rentalitemdetail/{serialNo}");
            var response = await _httpClient.GetAsync(fullUrl);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to get rental item detail by serial number. Status: {response.StatusCode}, Response: {responseContent}");
            }

            return await response.Content.ReadFromJsonAsync<RentalItemDetailResponse>();
        }
    }
}