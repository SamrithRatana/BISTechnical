using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;
using System;
using System.Collections.Generic;

namespace ServiceMaintenance.Pages.Reports
{
    public partial class Report2 : DevExpress.XtraReports.UI.XtraReport
    {
        private List<ContactInfo> _contacts = new List<ContactInfo>
{
    new ContactInfo { Id = Guid.NewGuid(), EngineerName = "Seng Kimneang\n+855 16 221 237", Tel = "123-456-7890" },
    new ContactInfo { Id = Guid.NewGuid(), EngineerName = "Choy Sokha\n+855 16 390 159", Tel = "987-654-3210" },
    new ContactInfo { Id = Guid.NewGuid(), EngineerName = "Vun Navin\n+855 16 510 159", Tel = "555-123-4567" },
    new ContactInfo { Id = Guid.NewGuid(), EngineerName = "Sin Veasna\n+855 16 550 159", Tel = "555-123-4567" },
    new ContactInfo { Id = Guid.NewGuid(), EngineerName = "Sors Sokean\n+855 16 380 159", Tel = "555-123-4567" }
};

        public Report2()
        {
            InitializeComponent();
        }

        public void SetParameters(RepairServices repairService, string serviceLocation, List<SparePartItem> sparePartItems, bool hasContract, string repairByUser, string verifiedByUser, string repairByPhone, string verifiedByPhone)
        {
           
            this.Parameters["Id"].Value = repairService.Id;
            this.Parameters["ReportNumber"].Value = repairService.reportNo;
            this.Parameters["CompanyName"].Value = repairService.CompanyName;
            this.Parameters["ContactName"].Value = repairService.ContactName;
            this.Parameters["PhoneNumber"].Value = repairService.PhoneNumber;
            this.Parameters["Address"].Value = repairService.Address;
            this.Parameters["ItemName"].Value = repairService.itemName;
            this.Parameters["SerialNumber"].Value = repairService.serialNumber;
            this.Parameters["CustomerRequest"].Value = repairService.CustomerRequest;
            this.Parameters["inspection"].Value = repairService.Inspection;
            this.Parameters["Solution"].Value = repairService.Solution;
            this.Parameters["Datestart"].Value = repairService.ServiceDate;
            this.Parameters["ServiceType"].Value = repairService.ServiceType;

            DateTime? finishDate = null;

            if (repairService.finishedDate != null)
            {
                finishDate = repairService.finishedDate;
            }
            else if (repairService.awaitingCustomerConfirmDate != null)
            {
                finishDate = repairService.awaitingCustomerConfirmDate;
            }
            else if (repairService.awaitingSparepartDate != null)
            {
                finishDate = repairService.awaitingSparepartDate;
            }
            else if (repairService.customerRejectedDate != null)
            {
                finishDate = repairService.customerRejectedDate.Value.ToLocalTime();
            }
            else if (repairService.unrepairableDate != null)
            {
                finishDate = repairService.unrepairableDate.Value.ToLocalTime();
            }
            else if (repairService.thirdPartyRepairDate != null)
            {
                finishDate = repairService.thirdPartyRepairDate.Value.ToLocalTime();
            }

            this.Parameters["Datefinish"].Value = finishDate;

            // Pass resolved usernames
            this.Parameters["RepairBy"].Value = repairByUser;
            this.Parameters["VerifiedBy"].Value = verifiedByUser;

            // Pass phone numbers
            this.Parameters["RepairByPhone"].Value = repairByPhone;
            this.Parameters["VerifiedByPhone"].Value = verifiedByPhone;

            // Check serviceLocation based on string values
            if (serviceLocation == "CompanyService") // CompanyService
            {
                this.Parameters["CompanyServiceChecked"].Value = true; // Check Company Service
                this.Parameters["OnSiteChecked"].Value = false;       // Uncheck OnSite
            }
            else if (serviceLocation == "OnSite") // OnSite
            {
                this.Parameters["CompanyServiceChecked"].Value = false; // Uncheck Company Service
                this.Parameters["OnSiteChecked"].Value = true;          // Check OnSite
            }

            if (hasContract)
            {
                this.Parameters["HasContract"].Value = true; // Check the HasContract box
            }
            else
            {
                this.Parameters["HasContract"].Value = false; // Uncheck the HasContract box
            }

            // Set status parameter for xrLabelStatus6 with Khmer translation
            string statusInKhmer = TranslateStatusToKhmer(repairService.Status);
            this.Parameters["StatusName"].Value = statusInKhmer;

            // Handle status-based visibility
            HandleStatusBasedVisibility(repairService.Status);

            // Add row numbers to sparePartItems
            int rowIndex = 1;
            foreach (var item in sparePartItems)
            {
                item.RowNumber = rowIndex++; // Assign sequential row number
            }

            // Count the spare part items and set the parameter to "Null" if no items exist
            if (sparePartItems == null || sparePartItems.Count == 0)
            {
                this.Parameters["SparePartCount"].Value = " ";
                xrTable1.Visible = false;
            }
            else
            {
                this.Parameters["SparePartCount"].Value = sparePartItems.Count.ToString();
                xrTable1.Visible = true;
                xrTable4.Visible = false;
            }

            if (sparePartItems != null && sparePartItems.Count > 0)
            {
                objectDataSource1.DataSource = sparePartItems;
                this.objectDataSource1.DataMember = "";
            }
            else
            {
                objectDataSource1.DataSource = null;
            }
        }

        private string TranslateStatusToKhmer(string status)
        {
            switch (status)
            {
                case "Awaiting Customer Confirm":
                    return "រង់ចាំយល់ព្រមពីអតិថិជន";
                case "Awaiting Sparepart":
                    return "រង់ចាំគ្រឿងបន្លាស់";
                case "Customer Rejected":
                    return "អតិថិជនមិនជួសជុល";
                case "Unrepairable":
                    return "ជួសជុលមិនបាន";
                case "Repair by Third-Party":
                    return "ជាងខាងក្រៅជួសជុល";
                default:
                    return status; // Return original status if no translation available
            }
        }

        private void HandleStatusBasedVisibility(string status)
        {
            // Define statuses that should hide certain controls
            var hideControlsStatuses = new[] { "Awaiting Customer Confirm", "Awaiting Sparepart", "Customer Rejected", "Unrepairable" };

            bool shouldHideControls = hideControlsStatuses.Contains(status);

            if (shouldHideControls)
            {
                // Hide the specified controls
                if (xrLabel2 != null) xrLabel2.Visible = false;
                if (xrLabel6 != null) xrLabel6.Visible = false;
                if (xrTableCell5 != null) xrTableCell5.Visible = false;
                if (xrTableCell14 != null) xrTableCell14.Visible = false;

                // Show status labels (they already have text and parameters)
                if (xrLabelStatus1 != null) xrLabelStatus1.Visible = true;
                if (xrLabelStatus2 != null) xrLabelStatus2.Visible = true;
                if (xrLabelStatus3 != null) xrLabelStatus3.Visible = true;
                if (xrLabelStatus4 != null) xrLabelStatus4.Visible = true;
                if (xrLabelStatus5 != null) xrLabelStatus5.Visible = true;
                if (xrLabelStatus6 != null) xrLabelStatus6.Visible = true;
            }
            else
            {
                // Show the normal controls
                if (xrLabel2 != null) xrLabel2.Visible = true;
                if (xrLabel6 != null) xrLabel6.Visible = true;
                if (xrTableCell5 != null) xrTableCell5.Visible = true;
                if (xrTableCell14 != null) xrTableCell14.Visible = true;

                // Hide status labels
                if (xrLabelStatus1 != null) xrLabelStatus1.Visible = false;
                if (xrLabelStatus2 != null) xrLabelStatus2.Visible = false;
                if (xrLabelStatus3 != null) xrLabelStatus3.Visible = false;
                if (xrLabelStatus4 != null) xrLabelStatus4.Visible = false;
                if (xrLabelStatus5 != null) xrLabelStatus5.Visible = false;
                if (xrLabelStatus6 != null) xrLabelStatus6.Visible = false;
            }
        }

        public void SetParameters2(RepairServices repairService)
        {
            // Assuming you have report parameters like CompanyName, ContactName, etc.
            Parameters["CompanyName"].Value = repairService.CompanyName;
            Parameters["ContactName"].Value = repairService.ContactName;
            Parameters["PhoneNumber"].Value = repairService.PhoneNumber;
            Parameters["Address"].Value = repairService.Address;
            Parameters["ItemName"].Value = repairService.itemName;
            Parameters["CustomerRequest"].Value = repairService.CustomerRequest;
            Parameters["Solution"].Value = repairService.Solution;
        }
    }
}