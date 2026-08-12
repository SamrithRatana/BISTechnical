using Microsoft.AspNetCore.Components;

namespace ServiceMaintenance.Services
{
    /// <summary>
    /// Scoped service that lets any page "push" content into the shared
    /// app footer (pagination bars, totals, grand totals, formulas, etc.).
    /// The Footer component subscribes to OnChange and re-renders whatever
    /// RenderFragment is currently set.
    /// </summary>
    public class FooterContentService
    {
        public RenderFragment? Content { get; private set; }

        public event Action? OnChange;

        public void SetContent(RenderFragment? content)
        {
            Content = content;
            OnChange?.Invoke();
        }

        public void Clear() => SetContent(null);
    }
}