/**
 * ServiceMaintenance Theme Engine v5
 * ─────────────────────────────────────────────────────────────────────
 *  1. Light Mode sidebar uses #eceef2; Dark Mode sidebar uses #1e293b.
 *  2. Inject runtime <style> in BOTH Light and Dark modes so button radius,
 *     table radius, table padding, font size, primary & header colors apply
 *     dynamically to Syncfusion (e-*), DevExpress (dxbl-*), Bootstrap and custom UI.
 *  3. Safe CSS-only theming — no DOM MutationObservers to interfere with
 *     Syncfusion/DevExpress dialogs, popups, or CRUD button events.
 * ─────────────────────────────────────────────────────────────────────
 */
window.themeEngine = {
    STORAGE_KEY: 'app_user_theme_config',

    applyTheme: function (themeJson) {
        if (!themeJson) return;
        var theme = typeof themeJson === 'string' ? JSON.parse(themeJson) : themeJson;
        var root = document.documentElement;
        var body = document.body;
        var isLight = (theme.Mode === 'light');
        var mode = theme.Mode || 'dark';

        // ── 1. Set data-theme-mode on <html> + <body> ────────────────────────
        if (root) root.setAttribute('data-theme-mode', mode);
        if (body) body.setAttribute('data-theme-mode', mode);

        if (isLight) {
            if (root) { root.classList.remove('dark-theme'); root.classList.add('light-theme'); }
            if (body) { body.classList.remove('dark-theme'); body.classList.add('light-theme'); }
        } else {
            if (root) { root.classList.remove('light-theme'); root.classList.add('dark-theme'); }
            if (body) { body.classList.remove('light-theme'); body.classList.add('dark-theme'); }
        }

        if (theme.GlassmorphismEnabled || mode === 'glass' || mode === 'cyberglass') {
            if (root) root.classList.add('glass-mode');
            if (body) body.classList.add('glass-mode');
        } else {
            if (root) root.classList.remove('glass-mode');
            if (body) body.classList.remove('glass-mode');
        }

        if (mode === 'material' || mode === 'materialdark') {
            if (root) root.classList.add('material-mode');
            if (body) body.classList.add('material-mode');
        } else {
            if (root) root.classList.remove('material-mode');
            if (body) body.classList.remove('material-mode');
        }

        // ── 2. Resolve design tokens ─────────────────────────────────────────
        var tokens = isLight ? {
            '--primary-color':   theme.PrimaryColor   || '#1FA9D3',
            '--primary-hover':   '#1789ac',
            '--secondary-color': theme.SecondaryColor || '#0ea5e9',
            '--accent-color':    theme.AccentColor    || '#20c997',
            '--header-bg':       theme.HeaderBg       || theme.PrimaryColor || '#1FA9D3',
            '--bg-primary':      '#f1f5f9',
            '--bg-secondary':    '#ffffff',
            '--card-bg':         '#ffffff',
            '--sidebar-bg':      theme.SidebarBg      || '#e2e8f0',  // Light mode sidebar
            '--topbar-bg':       '#ffffff',
            '--text-primary':    theme.TextPrimary    || '#0f172a',
            '--text-secondary':  theme.TextSecondary  || '#334155',
            '--border-subtle':   '#d8dce2',
        } : {
            '--primary-color':   theme.PrimaryColor   || '#1FA9D3',
            '--primary-hover':   '#1789ac',
            '--secondary-color': theme.SecondaryColor || '#0ea5e9',
            '--accent-color':    theme.AccentColor    || '#20c997',
            '--header-bg':       theme.HeaderBg       || theme.PrimaryColor || '#1FA9D3',
            '--bg-primary':      '#0f172a',
            '--bg-secondary':    '#162032',
            '--card-bg':         '#1e293b',
            '--sidebar-bg':      theme.SidebarBg      || '#1e293b',  // Dark mode sidebar
            '--topbar-bg':       '#0f172a',
            '--text-primary':    theme.TextPrimary    || '#f1f5f9',
            '--text-secondary':  theme.TextSecondary  || '#94a3b8',
            '--border-subtle':   'rgba(255,255,255,0.08)',
        };

        if (!isLight) {
            var presets = {
                midnight:  { '--bg-primary': '#0b132b', '--bg-secondary': '#121d38', '--card-bg': '#1c2541', '--sidebar-bg': '#1c2541' },
                rose:      { '--bg-primary': '#180914', '--bg-secondary': '#210c1b', '--card-bg': '#2d0a1e', '--sidebar-bg': '#2d0a1e' },
                cyberpunk: { '--bg-primary': '#05050d', '--bg-secondary': '#080814', '--card-bg': '#0d0d1a', '--sidebar-bg': '#0d0d1a', '--primary-color': '#00ffcc', '--accent-color': '#ff00aa' },
                luxury:    { '--bg-primary': '#111111', '--bg-secondary': '#161616', '--card-bg': '#1a1a1a', '--sidebar-bg': '#1a1a1a', '--primary-color': '#d4af37', '--accent-color': '#d4af37' },
                emerald:   { '--bg-primary': '#064e3b', '--bg-secondary': '#055040', '--card-bg': '#065f46', '--sidebar-bg': '#065f46' },
                ocean:     { '--bg-primary': '#0c4a6e', '--bg-secondary': '#0d5280', '--card-bg': '#0369a1', '--sidebar-bg': '#0369a1' },
                glass:     { '--bg-primary': 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', '--bg-secondary': 'rgba(255,255,255,0.05)', '--card-bg': 'rgba(255,255,255,0.07)', '--sidebar-bg': 'rgba(15,23,42,0.85)', '--primary-color': '#38bdf8', '--header-bg': '#0284c7' },
                cyberglass:{ '--bg-primary': 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #020617 100%)', '--bg-secondary': 'rgba(255,255,255,0.04)', '--card-bg': 'rgba(255,255,255,0.06)', '--sidebar-bg': 'rgba(9,9,11,0.9)', '--primary-color': '#a855f7', '--header-bg': '#7e22ce' },
                material:   { '--bg-primary': '#FEF7FF', '--bg-secondary': '#F7F2FA', '--card-bg': '#F7F2FA', '--sidebar-bg': '#F3EDF7', '--primary-color': '#6750A4', '--header-bg': '#6750A4', '--text-primary': '#1D1B20', '--text-secondary': '#49454F' },
                materialdark:{ '--bg-primary': '#141218', '--bg-secondary': '#2B2930', '--card-bg': '#2B2930', '--sidebar-bg': '#211F26', '--primary-color': '#D0BCFF', '--header-bg': '#381E72', '--text-primary': '#E6E0E9', '--text-secondary': '#CAC4D0' },
            };
            if (presets[mode]) Object.assign(tokens, presets[mode]);
        }

        // Component geometry tokens
        var btnRad  = (theme.ButtonRadiusPx !== undefined ? theme.ButtonRadiusPx : 6) + 'px';
        var cardRad = (theme.BorderRadiusPx !== undefined ? theme.BorderRadiusPx : 8) + 'px';
        var tblPadY = (theme.TablePaddingPx !== undefined ? theme.TablePaddingPx : 8) + 'px';
        var tblRad  = (theme.TableRadiusPx  !== undefined ? theme.TableRadiusPx  : 6) + 'px';
        var baseFont= (theme.BaseFontSizePx !== undefined ? theme.BaseFontSizePx : 14) + 'px';

        tokens['--btn-radius']      = btnRad;
        tokens['--card-radius']     = cardRad;
        tokens['--table-padding-y'] = tblPadY;
        tokens['--table-radius']    = tblRad;
        tokens['--base-font-size']  = baseFont;

        // ── 3. Apply CSS variables to :root ──────────────────────────────────
        if (root) root.removeAttribute('style');
        if (root) { for (var prop in tokens) root.style.setProperty(prop, tokens[prop]); }

        if (body) body.style.backgroundColor = tokens['--bg-primary'];
        if (body) body.style.color = tokens['--text-primary'];

        // ── 4. Inject runtime <style> tag (runs in BOTH Light & Dark modes) ──
        var styleId = '__theme_runtime__';
        var existing = document.getElementById(styleId);
        if (existing) existing.remove();

        var pri    = tokens['--primary-color'];
        var hdr    = tokens['--header-bg'];
        var bgSide = tokens['--sidebar-bg'];

        var commonGeometryCss = `
            /* Dynamic Component Geometry (Forced across Syncfusion, DevExpress, Bootstrap) */
            html, body {
                margin: 0;
                padding: 0;
            }

            html, body, .e-grid, .dxbl-grid, .table, .form-control, .form-select,
            .btn, .e-btn, .dxbl-btn, input, select, textarea {
                font-size: ${baseFont} !important;
            }

            /* Responsive Resolution Scaling (720p, 1080p, 2K, 4K HD/Full HD) */
            @media (max-height: 800px) {
                .e-grid, .dxbl-grid, .sf-grid {
                    max-height: calc(100vh - 310px) !important;
                }
                .e-grid .e-gridcontent {
                    max-height: calc(100vh - 365px) !important;
                }
            }
            @media (min-height: 801px) and (max-height: 1100px) {
                .e-grid, .dxbl-grid, .sf-grid {
                    max-height: calc(100vh - 340px) !important;
                }
                .e-grid .e-gridcontent {
                    max-height: calc(100vh - 395px) !important;
                }
            }
            @media (min-height: 1101px) {
                .e-grid, .dxbl-grid, .sf-grid {
                    max-height: calc(100vh - 360px) !important;
                }
                .e-grid .e-gridcontent {
                    max-height: calc(100vh - 415px) !important;
                }
            }

            .btn, .e-btn, .dxbl-btn, .page-link, .toolbar-item,
            .e-toolbar .e-btn, .e-tbar-btn, .dxbl-toolbar .dxbl-btn,
            .ts-chip, .ts-preset-tile, .btn-primary, .e-btn.e-primary, .dxbl-btn-primary {
                border-radius: ${btnRad} !important;
            }

            .card, .e-card, .dx-card, .theme-card, .ts-demo-card,
            .modal-content, .dxbl-modal-content, .e-dialog,
            .ts-controls-panel, .ts-preview-panel, .e-toolbar, .dxbl-toolbar {
                border-radius: ${cardRad} !important;
            }

            .table, .report-table, .e-grid, .e-grid .e-table, .dxbl-grid,
            .dxbl-grid-table, .ts-demo-table-wrapper, .e-gridheader, .e-gridcontent {
                border-radius: ${tblRad} !important;
            }

            /* Table Viewport Scaling (Prevents window page scrolling) */
            .e-grid, .dxbl-grid, .sf-grid {
                max-height: calc(100vh - 260px) !important;
            }
            .e-grid .e-gridcontent, .dxbl-grid-content {
                max-height: calc(100vh - 330px) !important;
            }

            .table th, .table td, .report-table th, .report-table td,
            .e-grid .e-rowcell, .e-grid .e-headercell,
            .dxbl-grid-data-row td, .dxbl-grid-header-row th,
            .ts-demo-table td, .ts-demo-table th {
                padding-top: ${tblPadY} !important;
                padding-bottom: ${tblPadY} !important;
                font-size: 13px !important;
            }

            /* Header & Primary Color Branding */
            .btn-primary, .e-btn.e-primary, .dxbl-btn-primary {
                background-color: ${pri} !important;
                border-color: ${pri} !important;
                color: #ffffff !important;
            }
            .e-grid .e-gridheader {
                background-color: ${hdr} !important;
                background: ${hdr} !important;
                border-bottom: 2px solid rgba(0, 0, 0, 0.08) !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .e-grid .e-gridheader .e-headercontent,
            .e-grid .e-gridheader table,
            .e-grid .e-gridheader tr,
            .e-grid .e-gridheader .e-columnheader,
            .e-grid .e-gridheader th.e-headercell,
            .e-grid .e-gridheader .e-headercell,
            .sf-grid .e-headercell {
                background-color: transparent !important;
                background: transparent !important;
                border-top: none !important;
            }
            .e-grid .e-headercelldiv, .e-grid .e-headercell *, .sf-grid .e-headercell * {
                color: #ffffff !important;
            }

            /* Sidebar background dynamically sets for Light (#eceef2) and Dark (#1e293b) */
            .app-sidebar-container, .sidebar-header, .app-sidebar,
            .sidebar, .nav-menu {
                background-color: ${bgSide} !important;
            }

            /* Status Badges - Always preserve distinct text & background colors in ALL themes */
            .ts-demo-status-active, .status-active, .badge-active { background-color: #d1fae5 !important; color: #065f46 !important; }
            .ts-demo-status-pending, .status-pending, .status-inspecting, .badge-pending { background-color: #fef3c7 !important; color: #92400e !important; }
            .ts-demo-status-done, .status-done, .status-finished, .badge-done { background-color: #dbeafe !important; color: #1e40af !important; }
            .ts-demo-status-danger, .status-danger, .status-rejected, .badge-danger { background-color: #fee2e2 !important; color: #991b1b !important; }
        `;

        var themeSpecificCss = '';

        if (!isLight) {
            var bg     = tokens['--bg-primary'];
            var bgCard = tokens['--card-bg'];
            var bgInput= 'rgba(255,255,255,0.06)';
            var text   = tokens['--text-primary'];
            var textSub= tokens['--text-secondary'];
            var border = 'rgba(255,255,255,0.09)';

            themeSpecificCss = `
/* Dark Mode Structural Overrides */
html, body { background-color:${bg}!important; color:${text}!important; }
.page, .content-column, .main-content-area, .content,
.page-content, .container-fluid, .container {
    background-color:${bg}!important; color:${text}!important;
}

.card, .card-body, .card-header, .card-footer,
.panel, .box, .widget, .shadow-sm, .rounded-lg,
.theme-card, .dxbl-toolbar, .e-toolbar {
    background-color:${bgCard}!important; color:${text}!important; border-color:${border}!important;
}

.modal-content, .modal-header, .modal-body, .modal-footer,
.dxbl-modal-content, .e-dialog {
    background-color:${bgCard}!important; color:${text}!important; border-color:${border}!important;
}
.modal-header, .dxbl-modal-header { border-bottom-color:${border}!important; }
.modal-footer, .dxbl-modal-footer { border-top-color:${border}!important; }

input, textarea, select,
.form-control, .form-select, .form-check-input,
.input-group-text, .e-input-group, .e-input-group input.e-input,
.e-float-input input, .e-float-input textarea,
.dxbl-text-edit, .dxbl-text-edit input, .dxbl-text-edit textarea,
input.e-input, textarea.e-input {
    background-color:${bgInput}!important; color:${text}!important; border-color:${border}!important;
}
input::placeholder, textarea::placeholder,
.e-input-group input.e-input::placeholder { color:${textSub}!important; }
input:focus, textarea:focus, select:focus,
.form-control:focus, .form-select:focus {
    background-color:rgba(255,255,255,0.09)!important;
    border-color:${pri}!important;
    box-shadow:0 0 0 3px rgba(31,169,211,0.18)!important;
}

label, .form-label, h1, h2, h3, h4, h5, h6,
p, span:not(.badge):not(.e-badge):not(.ts-demo-status),
.text-dark, .text-body { color:${text}; }
.text-muted, .form-text, small { color:${textSub}!important; }

.dropdown-menu, .dropdown-item:focus, .bootstrap-select .dropdown-menu { background-color:${bgCard}!important; }
.dropdown-item, .bootstrap-select .dropdown-item { color:${text}!important; }
.dropdown-item:hover, .bootstrap-select .dropdown-item:hover { background-color:rgba(255,255,255,0.07)!important; }
.dropdown-divider { border-color:${border}!important; }

.table, .table td, .table th,
.e-grid, .e-grid .e-content, .e-grid .e-gridcontent, .e-grid .e-table, .e-grid .e-gridfooter,
.dxbl-grid, .dxbl-grid-table, .dxbl-grid-data-row td {
    color:${text}!important; border-color:${border}!important; background-color:${bgCard}!important;
}
.table-striped>tbody>tr:nth-of-type(odd)>*, .e-grid .e-altrow td.e-rowcell,
.dxbl-grid-data-row:nth-child(even) td { background-color:rgba(255,255,255,0.03)!important; }
.table-hover>tbody>tr:hover>*, .e-grid .e-row:hover td.e-rowcell,
.dxbl-grid-data-row:hover td { background-color:rgba(255,255,255,0.07)!important; }

.list-group-item { background-color:${bgCard}!important; color:${text}!important; border-color:${border}!important; }
hr, .border, .border-top, .border-bottom, .border-start, .border-end { border-color:${border}!important; }
.bg-white, .bg-light { background-color:${bgCard}!important; }

.alert-info    { background:rgba(31,169,211,0.12)!important; border-color:rgba(31,169,211,0.3)!important; color:#7dd3fc!important; }
.alert-success { background:rgba(16,185,129,0.12)!important; border-color:rgba(16,185,129,0.3)!important; color:#6ee7b7!important; }
.alert-warning { background:rgba(245,158,11,0.12)!important; border-color:rgba(245,158,11,0.3)!important; color:#fcd34d!important; }
.alert-danger  { background:rgba(239,68,68,0.12)!important; border-color:rgba(239,68,68,0.3)!important; color:#fca5a5!important; }

.e-pager, .e-pager .e-pagercontainer, .e-pager .e-numericcontainer,
.dxbl-pager, .dxbl-pager-page-num {
    background-color:${bgCard}!important; color:${text}!important; border-color:${border}!important;
}
.e-pager .e-currentitem, .dxbl-pager-active-page-num { background-color:${pri}!important; color:#fff!important; }

.skeleton-cell { background:linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.05) 75%)!important; }
.skeleton-row { border-bottom-color:${border}!important; }

.ts-controls-panel, .ts-preview-panel, .ts-page-header,
.ts-section, .ts-control-group, .ts-demo-card-body,
.ts-config-summary, .ts-density-card {
    background-color:${bgCard}!important; color:${text}!important; border-color:${border}!important;
}
.ts-demo-card { background-color:${bgCard}!important; }
.ts-tabs-wrapper { background-color:${bgCard}!important; border-color:${border}!important; }
.ts-tab { color:${textSub}!important; }
.ts-tab.active { color:${pri}!important; border-bottom-color:${pri}!important; }
.ts-page-title, .ts-section-title, .ts-preview-title,
.ts-label, .ts-config-val, .ts-density-label,
.ts-preset-name, .ts-config-key { color:${text}!important; }
.ts-page-subtitle, .ts-section-desc, .ts-density-px,
.ts-demo-section-label, .ts-range-labels span { color:${textSub}!important; }
.ts-chip { background-color:rgba(255,255,255,0.05)!important; color:${textSub}!important; border-color:${border}!important; }
.ts-chip:hover { background-color:rgba(255,255,255,0.1)!important; }
.ts-chip.active { background-color:${pri}!important; color:#fff!important; border-color:${pri}!important; }
.ts-preset-tile { background-color:${bgCard}!important; border-color:${border}!important; }
.ts-preset-name { color:${text}!important; }
.ts-text-input, .ts-demo-input { background-color:rgba(255,255,255,0.06)!important; color:${text}!important; border-color:${border}!important; }
.ts-demo-table tbody td { background-color:${bgCard}!important; color:${text}!important; border-color:${border}!important; }
.ts-demo-row-alt td { background-color:rgba(255,255,255,0.04)!important; }
.ts-preview-mode-chip { background-color:rgba(255,255,255,0.1)!important; color:${textSub}!important; }
            `;
        }

        var styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = commonGeometryCss + '\n' + themeSpecificCss;
        document.head.appendChild(styleEl);
    },

    saveTheme: function (themeJson) {
        try {
            localStorage.setItem(this.STORAGE_KEY, typeof themeJson === 'string' ? themeJson : JSON.stringify(themeJson));
        } catch (e) { console.warn('Theme save failed:', e); }
    },

    loadSavedTheme: function () {
        try { return localStorage.getItem(this.STORAGE_KEY) || null; }
        catch (e) { return null; }
    },

    initOnLoad: function () {
        var saved = this.loadSavedTheme();
        if (saved) {
            this.applyTheme(saved);
        } else {
            if (document.documentElement) document.documentElement.setAttribute('data-theme-mode', 'light');
            if (document.body) document.body.setAttribute('data-theme-mode', 'light');
        }

        // If body wasn't ready during initial execution in <head>, re-apply once DOM is ready
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', function () {
                window.themeEngine.initOnLoad();
            });
        }
    }
};

window.themeEngine.initOnLoad();
