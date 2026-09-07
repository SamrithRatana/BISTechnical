using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetRepairCommnadHandler : IRequestHandler<SetRepairCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<SetRepairCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetRepairCommnadHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetRepairCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetRepairCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        
        if (serviceToUpdate == null)
        {
            return false;
        }

        var parts = serviceToUpdate.SparepartItems?.ToList() ?? new List<SparepartItem>();
        bool isCharge = serviceToUpdate.ServiceTypeId == 2 || serviceToUpdate.ServiceType?.Name == "Charge";
        bool hasParts = parts.Any();
        string currentStatus = serviceToUpdate.Status?.Name ?? "";
        int currentStatusId = serviceToUpdate.ServiceStatusId;

        // Rule 1: Charge មាន Sparepart -> Must be in "Sent Spareparts" (Status 12)
        if (isCharge && hasParts && currentStatusId != 12 && currentStatus != "Sent Spareparts")
        {
            throw new InvalidOperationException($"Charge service ({serviceToUpdate.ReportNo}) with spare parts must have spare parts dispatched ('Sent Spareparts') before approving repair (មិនអាចអនុម័តបានទេ ព្រោះ Charge មានគ្រឿងបន្លាស់ ត្រូវរង់ចាំបញ្ជូនគ្រឿងបន្លាស់ជាមុនសិន).");
        }

        // Rule 2: Charge គ្មាន Sparepart -> Must be in "Sale Confirmed" (Status 11) or "Sent Spareparts" (Status 12)
        if (isCharge && !hasParts && currentStatusId != 11 && currentStatusId != 12 && currentStatus != "Sale Confirmed" && currentStatus != "Sent Spareparts")
        {
            throw new InvalidOperationException($"Charge service ({serviceToUpdate.ReportNo}) without spare parts must be confirmed by sales ('Sale Confirmed') before approving repair (មិនអាចអនុម័តបានទេ ព្រោះ Charge គ្មានគ្រឿងបន្លាស់ ត្រូវបញ្ជូនទៅទីផ្សារ Confirm ជាមុនសិន).");
        }

        // Rule 3: Free មាន Sparepart -> Must be in "Sent Spareparts" (Status 12)
        if (!isCharge && hasParts && currentStatusId != 12 && currentStatus != "Sent Spareparts")
        {
            throw new InvalidOperationException($"Free service ({serviceToUpdate.ReportNo}) with spare parts must have spare parts dispatched ('Sent Spareparts') before approving repair (មិនអាចអនុម័តបានទេ ព្រោះ Free មានគ្រឿងបន្លាស់ ត្រូវរង់ចាំបញ្ជូនគ្រឿងបន្លាស់ជាមុនសិន).");
        }

        // Rule 4: Free គ្មាន Sparepart -> Must be in "Inspection" (Status 2) or "Sent Spareparts" (Status 12)
        if (!isCharge && !hasParts && currentStatusId != 2 && currentStatusId != 12 && currentStatus != "Inspection" && currentStatus != "Sent Spareparts")
        {
            throw new InvalidOperationException($"Free service ({serviceToUpdate.ReportNo}) without spare parts must be in 'Inspection' status before approving repair (មិនអាចអនុម័តបានទេ ព្រោះត្រូវវិនិច្ឆ័យរួចរាល់ជាមុនសិន).");
        }

        serviceToUpdate.SetRepairingStatus(command.RepairBy, command.RepairDate);

        _logger.LogInformation("Updating Service - SetRepair: {ServiceId}", serviceToUpdate.Id);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}