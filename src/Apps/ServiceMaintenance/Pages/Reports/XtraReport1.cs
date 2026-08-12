using DevExpress.DataAccess.ObjectBinding;
using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models; // Assuming you have this namespace for RepairServices
using System.Collections.Generic;

namespace ServiceMaintenance.Components
{
    public partial class XtraReport1 : DevExpress.XtraReports.UI.XtraReport
    {
        public XtraReport1()
        {
            InitializeComponent();
            this.PageWidth = 2000;  // Set your desired width in units (usually pixels or centimeters)

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
            this.Parameters["CompanyName"].Value = "[CompanyName]";
            this.Parameters["Address"].Value = "[Address]";
            this.Parameters["ContactName"].Value = "[ContactName]";
            this.Parameters["Phone"].Value = "[PhoneNumber]";
            this.Parameters["ItemName"].Value = "[ItemName]";
            this.Parameters["SerialNumber"].Value = "[SerialNumber]";
            this.Parameters["ReceivedDate"].Value = "[ServiceDate]";  // Bind the ServiceDate directly
            this.Parameters["InspectDate"].Value = "[inspectDate]";  // Bind the translated Status field to the report
            this.Parameters["WaitSparePartDate"].Value = "[awaitingSparepartDate]";  // Bind the translated Status field to the report
            this.Parameters["WaitCustomerDate"].Value = "[awaitingCustomerConfirmDate]";  // Bind the translated Status field to the report
            this.Parameters["FinishDate"].Value = "[finishedDate]";  // Bind the translated Status field to the report



            int rowCount = repairServices.Count;
            this.Parameters["TotalQuantity"].Value = $"{rowCount} គ្រឿង";  // You can change "Quantity" to the desired name.
        }


    }
}
