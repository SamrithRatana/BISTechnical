namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class Service
    : Entity, IAggregateRoot
{
    private int _serviceTypeId;
    private int _servicePriorityId;
    private int _serviceStatusId;

    public Guid CustomerId { get; private set; }

    public string CompanyName { get; private set; }

    public string Address { get; private set; }

    public string ContactName { get; private set; }

    public string PhoneNumber { get; private set; }

    public bool HasContract { get; private set; }

    public DateTime ServiceDate { get; private set; }

    public string ReportNo { get; private set; }

    public ServiceLocation ServiceLocation { get; private set; }

    public ServiceType ServiceType { get; private set; }
    public int ServiceTypeId => _serviceTypeId;

    public ServicePriority ServicePriority { get; private set; }
    public int ServicePriorityId => _servicePriorityId;

    public int ServiceStatusId => _serviceStatusId;

    public Guid? ItemId { get; private set; }

    public Item Item { get; }

    public string CustomerRequest { get; private set; }


    public Guid? CreateBy { get; private set; }

    public Guid? InspectBy { get; private set; }

    public DateTime? InspectDate { get; private set; }

    public string Inspection { get; private set; }
    public Guid? InspectingBy { get; private set; }
    public DateTime? InspectingDate { get; private set; }
    public string Solution { get; private set; }

    public Guid? SetUnrepairableBy { get; private set; }

    public DateTime? UnrepairableDate { get; private set; }

    public Guid? SetCustomerRejectedBy { get; private set; }

    public DateTime? CustomerRejectedDate { get; private set; }

    public Guid? SetAwaitingCustomerConfirmBy { get; private set; }

    public DateTime? AwaitingCustomerConfirmDate { get; private set; }

    public Guid? SetAwaitingSparepartBy { get; private set; }

    public DateTime? AwaitingSparepartDate { get; private set; }
    public DateTime? SaleConfirmedDate { get; private set; }
    public Guid? SetSaleConfirmedBy { get; private set; }
    public DateTime? SentSparepartsDate { get; private set; }
    public Guid? SetSentSparepartsBy { get; private set; }
    public Guid? RepairBy { get; private set; }

    public DateTime? RepairDate { get; private set; }

    public Guid? ThirdPartyRepairBy { get; private set; }

    public DateTime? ThirdPartyRepairDate { get; private set; }

    public DateTime? FinishedDate { get; private set; }

    public Guid? VerifiedBy { get; private set; }

    public ServiceStatus Status { get; private set; }

    public int? TelegramMessageId { get; private set; }

    public void SetTelegramMessageId(int? messageId) => TelegramMessageId = messageId;

    private List<SparepartItem> _sparepartItems;

    public IReadOnlyCollection<SparepartItem> SparepartItems => _sparepartItems.AsReadOnly();

    protected Service()
    {
        _sparepartItems = new List<SparepartItem>();
    }

    public Service(Guid customerId, string companyName, string address, string contactName,
        string phoneNumber, bool hasContract, DateTime serviceDate, string reportNo,
        ServiceLocation serviceLocation, int serviceTypeId, int servicePriorityId, Guid? itemId,
        string customerRequest, Guid createBy) : this()
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
        _serviceTypeId = serviceTypeId;
        _servicePriorityId = servicePriorityId;
        ItemId = itemId;
        CustomerRequest = customerRequest;
        CreateBy = createBy;
        _serviceStatusId = itemId == null ? 6 : 1;
    }

    public void UpdateReceiveItemInfo(
        Guid customerId,
        string companyName,
        string address,
        string contactName,
        string phoneNumber,
        bool hasContract,
        DateTime serviceDate,
        string reportNo,
        ServiceLocation serviceLocation,
        int servicePriorityId,
        Guid? itemId,
        string customerRequest)
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
        _servicePriorityId = servicePriorityId;
        ItemId = itemId;
        CustomerRequest = customerRequest;
    }

    public void UpdateRepairService(string reportNo, DateTime serviceDate, Guid customerId, string companyName, string address,
        string contactName, string phoneNumber, string customerRequest, string inspection, string solution,
        ServiceLocation serviceLocation, int serviceTypeId, int servicePriorityId, int statusId, Guid? itemId,
        bool hasContract, List<SparepartItem> sparepartItems, DateTime? finishedDate = null,
        Guid? repairBy = null, Guid? verifiedBy = null)
    {
        ReportNo = reportNo;
        ServiceDate = serviceDate;
        CustomerId = customerId;
        CompanyName = companyName;
        Address = address;
        ContactName = contactName;
        PhoneNumber = phoneNumber;
        CustomerRequest = customerRequest;
        Inspection = inspection;
        Solution = solution;
        ServiceLocation = serviceLocation;
        _serviceTypeId = serviceTypeId;
        _servicePriorityId = servicePriorityId;
        _serviceStatusId = statusId;
        ItemId = itemId;
        HasContract = hasContract;

        if (finishedDate.HasValue)
        {
            FinishedDate = finishedDate.Value;
        }

        if (repairBy.HasValue && repairBy.Value != Guid.Empty)
        {
            RepairBy = repairBy.Value;
        }

        if (verifiedBy.HasValue && verifiedBy.Value != Guid.Empty)
        {
            VerifiedBy = verifiedBy.Value;
        }

        bool isHoldStatus = !(statusId == 5 || statusId == 6 || statusId == 12);

        var existingItems = _sparepartItems.ToList();
        var incomingList = sparepartItems.Where(x => !string.IsNullOrWhiteSpace(x.Description)).ToList();

        var matchedExisting = new HashSet<SparepartItem>();

        foreach (var incoming in incomingList)
        {
            SparepartItem existing = null;
            // 1. Try match by Id if incoming has a valid non-empty Id
            if (incoming.Id != Guid.Empty)
            {
                existing = existingItems.FirstOrDefault(e => e.Id == incoming.Id && !matchedExisting.Contains(e));
            }

            // 2. If not matched by Id, match by SparepartId (if non-empty)
            if (existing == null && incoming.SparepartId != Guid.Empty)
            {
                existing = existingItems.FirstOrDefault(e => e.SparepartId == incoming.SparepartId && !matchedExisting.Contains(e));
            }

            if (existing != null)
            {
                matchedExisting.Add(existing);
                existing.UpdateDetails(
                    incoming.Description,
                    incoming.Quantity,
                    incoming.Condition,
                    isHoldStatus);
                if (!string.IsNullOrWhiteSpace(incoming.Remarks))
                {
                    existing.UpdateRemarks(incoming.Remarks);
                }
            }
            else
            {
                _sparepartItems.Add(new SparepartItem(
                    incoming.SparepartId,
                    incoming.Description,
                    incoming.Quantity,
                    incoming.Condition,
                    isHoldStatus,
                    incoming.Remarks));
            }
        }

        // 3. Remove any existing items that were not matched to an incoming line
        var itemsToRemove = existingItems.Where(e => !matchedExisting.Contains(e)).ToList();
        foreach (var item in itemsToRemove)
        {
            _sparepartItems.Remove(item);
        }
    }

    public void ClearSparepartItems()
    {
        _sparepartItems.Clear();
    }

    public void AddSparepartItem(Guid sparepartId, string description, int quantity,
       SparepartCondition condition, bool isHoldStatus = false) // ✅ added
    {
        var sparepartItem = new SparepartItem(sparepartId, description, quantity, condition, isHoldStatus);
        _sparepartItems.Add(sparepartItem);
    }

    // ✅ ADD THIS NEW METHOD - Remove a specific spare part item by ID
    public void RemoveSparepartItem(Guid sparepartItemId)
    {
        var itemToRemove = _sparepartItems.FirstOrDefault(i => i.Id == sparepartItemId);
        if (itemToRemove != null)
        {
            _sparepartItems.Remove(itemToRemove);
        }
    }

    public void SetInspection(Guid inspectBy, DateTime inspectDate, string inspection, string solution)
    {
        InspectBy = inspectBy;
        InspectDate = inspectDate;
        Inspection = inspection;
        Solution = solution;
        _serviceStatusId = 2; // Inspection
    }

    public void SetServiceType(int serviceTypeId)
    {
        _serviceTypeId = serviceTypeId;
    }

    public void SetAwaitingCustomerConfirm(Guid setAwaitingCustomerConfirmBy, DateTime awaitingCustomerConfirmDate)
    {
        SetAwaitingCustomerConfirmBy = setAwaitingCustomerConfirmBy;
        AwaitingCustomerConfirmDate = awaitingCustomerConfirmDate;
        _serviceStatusId = 3; // Awaiting Customer Confirm
    }

    public void SetCustomerRejected(Guid setCustomerRejectedBy, DateTime customerRejectedDate)
    {
        SetCustomerRejectedBy = setCustomerRejectedBy;
        CustomerRejectedDate = customerRejectedDate;
        _serviceStatusId = 7; // Customer Rejected
    }

    public void SetAwaitingSparepart(Guid setAwaitingSparepartBy, DateTime awaitingSparepartDate)
    {
        SetAwaitingSparepartBy = setAwaitingSparepartBy;
        AwaitingSparepartDate = awaitingSparepartDate;
        _serviceStatusId = 4; // Awaiting Sparepart
    }

    public void SetRepairingStatus(Guid repairBy, DateTime repairDate)
    {
        RepairBy = repairBy;
        RepairDate = repairDate;
        _serviceStatusId = 5; // Repairing
    }

    public void SetThirdPartyRepairingStatus(Guid thridPartyRepairBy, DateTime thirdPartyRepairDate)
    {
        ThirdPartyRepairBy = thridPartyRepairBy;
        ThirdPartyRepairDate = thirdPartyRepairDate;
        _serviceStatusId = 9; // Third-Party Repairing
    }

    public void SetFinishedStatus(DateTime finishedDate, Guid verfifiedBy)
    {
        VerifiedBy = verfifiedBy;
        FinishedDate = finishedDate;
        _serviceStatusId = 6; // Finished
    }

    public void SetUnrepairableStatus(DateTime unrepairableDate, Guid setUnrepairableBy)
    {
        SetUnrepairableBy = setUnrepairableBy;
        UnrepairableDate = unrepairableDate;
        _serviceStatusId = 8; // Unrepairable
    }
    public void SetInspecting(Guid inspectingBy, DateTime inspectingDate)
    {
        InspectingBy = inspectingBy;
        InspectingDate = inspectingDate;
        _serviceStatusId = 10; // Inspecting
    }
    public void SetSaleConfirmedStatus(DateTime saleConfirmedDate, Guid setSaleConfirmedBy)
    {
        SaleConfirmedDate = saleConfirmedDate;
        SetSaleConfirmedBy = setSaleConfirmedBy;
        _serviceStatusId = 11; // ✅ Sale Confirmed
    }
    public void SetSentSparepartsStatus(DateTime sentSparepartsDate, Guid setSentSparepartsBy)
    {
        SentSparepartsDate = sentSparepartsDate;
        SetSentSparepartsBy = setSentSparepartsBy;
        _serviceStatusId = 12; // Sent Spareparts
    }
}