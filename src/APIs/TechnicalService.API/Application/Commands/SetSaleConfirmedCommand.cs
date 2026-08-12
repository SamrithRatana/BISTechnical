namespace TechnicalService.API.Application.Commands;

[DataContract]
public class SetSaleConfirmedCommand : IRequest<bool>
{
    [DataMember]
    public Guid Id { get; set; }
    [DataMember]
    public Guid SetSaleConfirmedBy { get; private set; }
    [DataMember]
    public DateTime SaleConfirmedDate { get; private set; }

    public SetSaleConfirmedCommand(Guid id, Guid setSaleConfirmedBy, DateTime saleConfirmedDate)
    {
        Id = id;
        SetSaleConfirmedBy = setSaleConfirmedBy;
        SaleConfirmedDate = saleConfirmedDate;
    }
}