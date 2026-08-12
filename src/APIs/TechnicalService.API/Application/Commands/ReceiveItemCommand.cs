using TechnicalService.API.Application.Queries;
using TechnicalService.API.Extensions;

namespace TechnicalService.API.Application.Commands;

[DataContract]
public class ReceiveItemCommand : IRequest<bool>
{
    [DataMember]
    public Guid CustomerId { get; private set; }

    [DataMember]
    public string CompanyName { get; private set; }

    [DataMember]
    public string Address { get; private set; }

    [DataMember]
    public string ContactName { get; private set; }

    [DataMember]
    public string PhoneNumber { get; private set; }

    [DataMember]
    public bool HasContract { get; private set; }

    [DataMember]
    public DateTime ServiceDate { get; private set; }

    [DataMember]
    public string ReportNo { get; private set; }

    [DataMember]
    public string ServiceLocation { get; private set; }

    [DataMember]
    public int ServicePriorityId { get; private set; }

    [DataMember]
    public Guid ItemId { get; private set; }

    [DataMember]
    public string CustomerRequest { get; private set; }

    [DataMember]
    public Guid CreateBy { get; private set; }

    public ReceiveItemCommand(Guid customerId, string companyName, string address, string contactName,
        string phoneNumber, bool hasContract, DateTime serviceDate, string reportNo, string serviceLocation,
        int servicePriorityId, Guid itemId, string customerRequest, Guid receivedBy)
    {
        CustomerId = customerId;
        CompanyName = companyName;
        Address = address;
        ContactName = contactName;
        PhoneNumber = phoneNumber;
        HasContract = hasContract;
        ServiceDate = serviceDate;
        ReportNo = reportNo;
        ServiceLocation = serviceLocation;
        ServicePriorityId = servicePriorityId;
        ItemId = itemId;
        CustomerRequest = customerRequest;
        CreateBy = receivedBy;
    }
}
