using System;
using System.Collections;
using System.ComponentModel;
using System.Drawing;
using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;

namespace ServiceMaintenance.Pages.Reports
{
    public partial class RentalItemReport : DevExpress.XtraReports.UI.XtraReport
    {
        public RentalItemReport()
        {
            InitializeComponent();
        }

        public void SetDataSource(List<RentalItem> repairServices, string selectedCustomerName = null, string currentUserName = null)
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

            this.Parameters["CustomerName"].Value = "[CustomerName]";
            this.Parameters["ItemName"].Value = "[ItemName]";
            this.Parameters["SerialNumber"].Value = "[SerialNumber]";
            this.Parameters["Condition"].Value = "[Condition]";
            this.Parameters["Duration"].Value = "[Duration]";
            this.Parameters["Address"].Value = "[Location]";

            // Set CustomerName parameter based on selection
            if (string.IsNullOrEmpty(selectedCustomerName))
            {
                // No specific customer selected - show "ALL" in Khmer
                this.Parameters["CustomerTitle"].Value = "អតិថិជនទាំងអស់ (ALL)";
            }
            else
            {
                // Specific customer selected - show the customer name
                this.Parameters["CustomerTitle"].Value = selectedCustomerName;
            }

            // Set GeneratedBy parameter
            if (!string.IsNullOrEmpty(currentUserName))
            {
                this.Parameters["GeneratedBy"].Value = currentUserName;
            }
            else
            {
                this.Parameters["GeneratedBy"].Value = "System User";
            }

            // Optional: Add total count parameter
            //int rowCount = repairServices.Count;
            // Uncomment if you have a TotalQuantity parameter in your report
            // this.Parameters["TotalQuantity"].Value = $"{rowCount} គ្រឿង";
        }
    }
}