public record CreateRentalItemRequest(
    Guid CreatedBy,
    Guid CustomerId,
    string CustomerName,
    string ItemName,
    string SerialNumber,
    string Condition,
    string Location,
    int Duration);
