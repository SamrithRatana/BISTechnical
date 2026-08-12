using AspNetCore.Reporting;
using DevExpress.Blazor;
using Microsoft.AspNetCore.Components;
using ServiceMaintenance.Models;
using ServiceMaintenance.Services;

namespace ServiceMaintenance.Pages.Parents
{
    public partial class CategoryList
    {
        bool isXSmallScreen;

        void ShowColumnChooser()
        {
            MyGrid.ShowColumnChooser(new DialogDisplayOptions($".flexGrid", HorizontalAlignment.Center, VerticalAlignment.Center));
        }

        bool GetExtraColumnsVisible() => !isXSmallScreen;

        bool UnVisible() => false;


        [Inject]
        public ICategoryService categoryService { get; set; }

        public IEnumerable<Category> categories { get; set; }
        [Inject]
        public NavigationManager NavigationManager { get; set; }
        IGrid MyGrid { get; set; }
        const string ExportFileName = "ExportResult";
        bool EditItemsEnabled { get; set; }
        int FocusedRowVisibleIndex { get; set; }

        bool indicatorVisible = false;
        bool indicatorAreaVisible = true;
        int SelectedReportId { get; set; } // Add this property
        private Category selectedCategory;



        protected override async Task OnInitializedAsync()
        {
            try
            {

                indicatorVisible = true;
                StateHasChanged();
                categories = await categoryService.GetData();

                // Hide loading panel after data is loaded
                indicatorVisible = false;
                StateHasChanged();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading reports: {ex.Message}");
                ErrorToast(ex.Message);
            }
        }

        [Inject] IToastNotificationService ToastService { get; set; }

        ToastAnimationType Animation { get; set; } = ToastAnimationType.Slide;
        async Task OnEditModelSaving(GridEditModelSavingEventArgs e)
        {
            var editModel = (Category)e.EditModel;

            try
            {
                if (e.IsNew)
                {
                    await categoryService.CreateData(editModel);
                    categories = await categoryService.GetData();
                    UpdateEditItemsEnabled(true);
                    AddToast();
                }
                else
                {
                    await categoryService.UpdateData(editModel);
                    categories = await categoryService.GetData();
                    UpdateEditItemsEnabled(true);
                    AddToast();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving report: {ex.Message}");
                ErrorToast(ex.Message);
            }

        }
      

        private void AddToast()
        {
            ToastService.ShowToast(new ToastOptions
            {
                ProviderName = "Customization",
                Title = "Process was successful",
                Text = "Remember the system is processing with data",
                ThemeMode = ToastThemeMode.Pastel,
                RenderStyle = ToastRenderStyle.Success

            });
        }
        private void ErrorToast(string errorMessage)
        {
            ToastService.ShowToast(new ToastOptions
            {
                ProviderName = "Error",
                Title = "An error occurred",
                Text = errorMessage, // Use the provided error message
                ThemeMode = ToastThemeMode.Light,
                RenderStyle = ToastRenderStyle.Danger
            });
        }
        void Grid_FocusedRowChanged(GridFocusedRowChangedEventArgs args)
        {
            FocusedRowVisibleIndex = args.VisibleIndex;
            UpdateEditItemsEnabled(true);
            selectedCategory = (Category)args.DataItem;
        }
        void UpdateEditItemsEnabled(bool enabled)
        {
            EditItemsEnabled = enabled;
        }

        async Task NewItem_Click()
        {
            await MyGrid.StartEditNewRowAsync();
        }
        async Task EditItem_Click()
        {
            await MyGrid.StartEditRowAsync(FocusedRowVisibleIndex);
        }

        void DeleteItem_Click()
        {

            MyGrid.ShowRowDeleteConfirmation(FocusedRowVisibleIndex);

        }
        void ColumnChooserItem_Click(ToolbarItemClickEventArgs e)
        {
            MyGrid.ShowColumnChooser();
        }
        async Task ExportXlsxItem_Click()
        {
            await MyGrid.ExportToXlsxAsync(ExportFileName);
        }
        async Task ExportXlsItem_Click()
        {
            await MyGrid.ExportToXlsAsync(ExportFileName);
        }
        async Task ExportCsvItem_Click()
        {
            await MyGrid.ExportToCsvAsync(ExportFileName);
        }

        private void PrintReport_Click()
        {
            // Data to be passed can be appended as query parameters
            //string reportId = "123"; // Example data
            NavigationManager.NavigateTo("/delivery");
        }
        void showInfo()
        {
            NavigationManager.NavigateTo($"reportDetails/{selectedCategory.CategoryID}");
        }
        async Task DeleteCategoryItem(GridDataItemDeletingEventArgs e)
        {
            var report = (Category)e.DataItem;
            try
            {
                await categoryService.DeleteData(report.CategoryID);
                categories = await categoryService.GetData();
                UpdateEditItemsEnabled(true);
                AddToast();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting report: {ex.Message}");
                ErrorToast(ex.Message);
            }
        }
    }
}
