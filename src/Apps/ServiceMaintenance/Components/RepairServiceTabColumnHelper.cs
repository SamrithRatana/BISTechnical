// ServiceMaintenance/Helpers/RepairServiceTabColumnHelper.cs
using System;
using ServiceMaintenance.Models;

namespace ServiceMaintenance.Components
{
    public static class RepairServiceTabColumnHelper
    {
        // Field name សម្រាប់ "date" column តាម tab
        public static string GetDateFieldForTab(string tabKey) => tabKey switch
        {
            "Item Recieved" => nameof(RepairServices.ServiceDate),
            "Inspection" => nameof(RepairServices.inspectDate),
            "Awaiting Sparepart" => nameof(RepairServices.awaitingSparepartDate),
            "Awaiting Customer Confirm" => nameof(RepairServices.awaitingCustomerConfirmDate),
            "Sale Confirmed" => nameof(RepairServices.saleConfirmedDate),
            "Sent Spareparts" => nameof(RepairServices.sentSparepartsDate),
            _ => nameof(RepairServices.awaitingCustomerConfirmDate),
        };

        // Header text សម្រាប់ date column តាម tab
        public static string GetDateHeaderForTab(string tabKey) => tabKey switch
        {
            "Item Recieved" => "ថ្ងៃចូល",
            "Inspection" => "ថ្ងៃវិនិច្ឆ័យ",
            "Awaiting Sparepart" => "ថ្ងៃរង់ចាំគ្រឿងបន្លាស់",
            "Awaiting Customer Confirm" => "ថ្ងៃដាក់ការរង់ចាំពីភ្ញៀវ",
            "Sale Confirmed" => "ថ្ងៃ Confirm",
            "Sent Spareparts" => "ថ្ងៃបញ្ជូនគ្រឿងបន្លាស់",
            _ => "ថ្ងៃ",
        };

        // UserId "អ្នកធ្វើ" តាម tab
        public static Guid? GetByUserIdForTab(RepairServices item, string tabKey) => tabKey switch
        {
            "Item Recieved" => item.createby,
            "Inspection" => item.inspectBy,
            "Awaiting Sparepart" => item.setAwaitingSparepartBy,
            "Awaiting Customer Confirm" => item.setAwaitingCustomerConfirmBy,
            "Sale Confirmed" => item.setSaleConfirmedBy,
            "Sent Spareparts" => item.setSentSparepartsBy,
            _ => item.setAwaitingCustomerConfirmBy,
        };

        // Header text "អ្នកឆែកស្តុក / អ្នកធ្វើ" តាម tab
        public static string GetByHeaderForTab(string tabKey) => tabKey switch
        {
            "Item Recieved" => "អ្នកបញ្ចូល",
            "Inspection" => "អ្នកវិនិច្ឆ័យ",
            "Awaiting Sparepart" => "អ្នកស្នើគ្រឿងបន្លាស់",
            "Awaiting Customer Confirm" => "អ្នកឆែកស្តុក",
            "Sale Confirmed" => "អ្នកអនុម័ត",
            "Sent Spareparts" => "អ្នកបញ្ជូន",
            _ => "អ្នកឆែកស្តុក",
        };
    }
}