using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;
using System;
using System.Collections;
using System.ComponentModel;
using System.Drawing;

namespace DXApplication1
{
    public partial class HistoryReport : DevExpress.XtraReports.UI.XtraReport
    {
        public HistoryReport()
        {
            InitializeComponent();
        }
        public void SetDataSource(List<RepairServices> repairServices, List<string> repairByUsers, List<string> verifiedByUsers, string currentUserName)
        {
            this.DataSource = repairServices;

            // Define a dictionary for status translation
            var statusTranslation = new Dictionary<string, string>
    {
        { "Item Recieved", "ទទួលម៉ាស៊ីន" },
        { "Finished", "ជួសជុលរួចរាល់" },
        { "Inspection", "កំពុងវិនិច្ឆ័យ" },
        { "Awaiting Customer Confirm", "រង់ចាំ Confirm ពីភ្ញៀវ" },
        { "Awaiting Sparepart", "កំពុងរង់ចាំគ្រឿងបន្លាស់" },
        { "Repairing", "កំពុងជួសជុល" },
        { "Customer Rejected", "គេមិនធ្វើ" },
        { "Unrepairable", "ជួសជុលមិនបាន" }
    };

            // Loop through the repair services and update the Status property
            foreach (var service in repairServices)
            {
                if (statusTranslation.ContainsKey(service.Status))
                {
                    service.Status = statusTranslation[service.Status];  // Translate the status
                }

                // Set the RepairByName and VerifiedByName for each service
                service.RepairByName = repairByUsers[repairServices.IndexOf(service)];
                service.VerifiedByName = verifiedByUsers[repairServices.IndexOf(service)];
            }

            // Set report parameters
            this.Parameters["ReportNo"].Value = "[reportNo]";
            this.Parameters["Date"].Value = "[finishedDate]";
            this.Parameters["Problem"].Value = "[Inspection]";
            this.Parameters["Solution"].Value = "[Solution]";
            this.Parameters["ItemName"].Value = "[ItemName]";
            this.Parameters["SerialNumber"].Value = "[SerialNumber]";
            

           
        }


    }
}

