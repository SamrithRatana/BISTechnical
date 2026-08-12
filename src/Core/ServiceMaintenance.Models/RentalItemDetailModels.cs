using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ServiceMaintenance.Models
{
    /// <summary>
    /// Response model for rental item detail API - matches existing RentalItem model
    /// </summary>
    public class RentalItemDetailResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("createdBy")]
        public string CreatedBy { get; set; }

        [JsonPropertyName("customerId")]
        public string CustomerId { get; set; }

        [JsonPropertyName("customerName")]
        public string CustomerName { get; set; }

        [JsonPropertyName("itemName")]
        public string ItemName { get; set; }

        [JsonPropertyName("serialNumber")]
        public string SerialNumber { get; set; }

        [JsonPropertyName("condition")]
        public string Condition { get; set; }

        [JsonPropertyName("location")]
        public string Location { get; set; }

        [JsonPropertyName("duration")]
        public int Duration { get; set; }

        [JsonPropertyName("rentalServices")]
        public List<RentalServiceResponse> RentalServices { get; set; } = new List<RentalServiceResponse>();

        /// <summary>
        /// Convert API response to domain model
        /// </summary>
        public RentalItem ToRentalItem()
        {
            return new RentalItem
            {
                Id = Guid.TryParse(Id, out var id) ? id : Guid.Empty,
                CreatedBy = Guid.TryParse(CreatedBy, out var createdBy) ? createdBy : Guid.Empty,
                CustomerId = Guid.TryParse(CustomerId, out var customerId) ? customerId : Guid.Empty,
                CustomerName = CustomerName,
                ItemName = ItemName,
                SerialNumber = SerialNumber,
                Condition = Condition,
                Location = Location,
                Duration = Duration
            };
        }
    }

    /// <summary>
    /// Response model for rental service - matches existing RentalServices model
    /// </summary>
    public class RentalServiceResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("rentalItemId")]
        public string RentalItemId { get; set; }

        [JsonPropertyName("date")]
        public string Date { get; set; }

        [JsonPropertyName("action")]
        public string Action { get; set; }

        [JsonPropertyName("note")]
        public string Note { get; set; }

        [JsonPropertyName("userId")]
        public string UserId { get; set; }

        [JsonPropertyName("spareparts")]
        public List<SparePartResponse> SpareParts { get; set; } = new List<SparePartResponse>();

        /// <summary>
        /// Convert API response to domain model
        /// </summary>
        public RentalServices ToRentalServices()
        {
            return new RentalServices
            {
                RentalItemId = RentalItemId,
                Date = DateTime.TryParse(Date, out var date) ? date : DateTime.MinValue,
                Action = Action,
                Note = Note,
                UserId = UserId,
                SpareParts = SpareParts?.Select(sp => sp.ToSparePartOb()).ToList() ?? new List<SparePartOb>()
            };
        }
    }

    /// <summary>
    /// Response model for spare part - matches existing SparePartOb model
    /// </summary>
    public class SparePartResponse
    {
        [JsonPropertyName("sparepartId")]
        public string SparePartId { get; set; }

        [JsonPropertyName("description")]
        public string Description { get; set; }

        [JsonPropertyName("quantity")]
        public int Quantity { get; set; }

        [JsonPropertyName("condition")]
        public string Condition { get; set; }

        /// <summary>
        /// Convert API response to domain model
        /// </summary>
        public SparePartOb ToSparePartOb()
        {
            return new SparePartOb
            {
                SparePartId = Guid.TryParse(SparePartId, out var id) ? id : null,
                Description = Description,
                Quantity = Quantity,
                Condition = Condition
            };
        }
    }

    /// <summary>
    /// Request model for creating rental item detail
    /// </summary>
    public class RentalItemDetailRequest
    {
        [JsonPropertyName("customerId")]
        public string CustomerId { get; set; }

        [Required]
        [JsonPropertyName("customerName")]
        public string CustomerName { get; set; }

        [Required]
        [JsonPropertyName("itemName")]
        public string ItemName { get; set; }

        [Required]
        [JsonPropertyName("serialNumber")]
        public string SerialNumber { get; set; }

        [JsonPropertyName("condition")]
        public string Condition { get; set; }

        [JsonPropertyName("location")]
        public string Location { get; set; }

        [JsonPropertyName("duration")]
        public int Duration { get; set; }

        [JsonPropertyName("rentalServices")]
        public List<RentalServiceRequest> RentalServices { get; set; } = new List<RentalServiceRequest>();

        /// <summary>
        /// Create request from domain model
        /// </summary>
        public static RentalItemDetailRequest FromRentalItem(RentalItem rentalItem)
        {
            return new RentalItemDetailRequest
            {
                CustomerId = rentalItem.CustomerId.ToString(),
                CustomerName = rentalItem.CustomerName,
                ItemName = rentalItem.ItemName,
                SerialNumber = rentalItem.SerialNumber,
                Condition = rentalItem.Condition,
                Location = rentalItem.Location,
                Duration = rentalItem.Duration
            };
        }
    }

    /// <summary>
    /// Request model for rental service
    /// </summary>
    public class RentalServiceRequest
    {
        [JsonPropertyName("date")]
        public string Date { get; set; }

        [JsonPropertyName("action")]
        public string Action { get; set; }

        [JsonPropertyName("note")]
        public string Note { get; set; }

        [JsonPropertyName("spareparts")]
        public List<SparePartRequest> SpareParts { get; set; } = new List<SparePartRequest>();

        /// <summary>
        /// Create request from domain model
        /// </summary>
        public static RentalServiceRequest FromRentalServices(RentalServices rentalServices)
        {
            return new RentalServiceRequest
            {
                Date = rentalServices.Date.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                Action = rentalServices.Action,
                Note = rentalServices.Note,
                SpareParts = rentalServices.SpareParts?.Select(SparePartRequest.FromSparePartOb).ToList() ?? new List<SparePartRequest>()
            };
        }
    }

    /// <summary>
    /// Request model for spare part
    /// </summary>
    public class SparePartRequest
    {
        [JsonPropertyName("sparepartId")]
        public string SparePartId { get; set; }

        [JsonPropertyName("description")]
        public string Description { get; set; }

        [JsonPropertyName("quantity")]
        public int Quantity { get; set; }

        [JsonPropertyName("condition")]
        public string Condition { get; set; }

        /// <summary>
        /// Create request from domain model
        /// </summary>
        public static SparePartRequest FromSparePartOb(SparePartOb sparePartOb)
        {
            return new SparePartRequest
            {
                SparePartId = sparePartOb.SparePartId?.ToString(),
                Description = sparePartOb.Description,
                Quantity = sparePartOb.Quantity,
                Condition = sparePartOb.Condition
            };
        }
    }
}