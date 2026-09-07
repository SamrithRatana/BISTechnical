using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace UserManagementAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WallpaperController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private static readonly string UnsplashAccessKey = "i2KeAy3asEUM1b9-ptMwaSB2ouBROOvS6MMvgV62BCQ";

        public WallpaperController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search(
            [FromQuery] string query = "wallpaper",
            [FromQuery] int page = 1,
            [FromQuery] int perPage = 24)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(10);

                var officialReq = new HttpRequestMessage(
                    HttpMethod.Get,
                    $"https://api.unsplash.com/search/photos?query={Uri.EscapeDataString(query)}&page={page}&per_page={perPage}&orientation=portrait"
                );
                officialReq.Headers.Add("Authorization", $"Client-ID {UnsplashAccessKey}");
                officialReq.Headers.Add("Accept", "application/json");

                var response = await client.SendAsync(officialReq);

                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return Content(content, "application/json");
                }

                var errBody = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "Unsplash API error", status = response.StatusCode, detail = errBody });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
