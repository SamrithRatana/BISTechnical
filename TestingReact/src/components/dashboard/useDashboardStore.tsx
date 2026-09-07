"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import toast from "react-hot-toast";
import {
  DashboardWidgetId,
  DashboardWidgetConfig,
  DashboardViewMode,
  WidgetColSpan,
} from "./types";
import {
  DEFAULT_VIEW_PRESETS,
  WIDGET_REGISTRY,
} from "./widgetRegistry";

const STORAGE_KEY = "user_dashboard_layout_v11";
const PRIVACY_KEY = "dashboard_privacy_mode";
const CREATE_ACTIONS_KEY = "dashboard_show_create_actions";

interface DashboardContextType {
  activeView: DashboardViewMode;
  isCustomizing: boolean;
  isPrivacyMode: boolean;
  isAddModalOpen: boolean;
  showCreateActions: boolean;
  widgets: DashboardWidgetConfig[];
  allWidgetsForActiveView: DashboardWidgetConfig[];
  setActiveView: (view: DashboardViewMode) => void;
  setIsCustomizing: (val: boolean) => void;
  toggleCustomizing: () => void;
  setIsPrivacyMode: (val: boolean) => void;
  togglePrivacyMode: () => void;
  setIsAddModalOpen: (val: boolean) => void;
  setShowCreateActions: (val: boolean) => void;
  toggleCreateActions: () => void;
  toggleWidgetVisibility: (id: DashboardWidgetId) => void;
  setWidgetColSpan: (id: DashboardWidgetId, span: WidgetColSpan) => void;
  reorderWidgets: (sourceIndex: number, destIndex: number) => void;
  moveWidget: (id: DashboardWidgetId, direction: "up" | "down") => void;
  removeWidget: (id: DashboardWidgetId) => void;
  addWidget: (id: DashboardWidgetId) => void;
  resetCurrentView: () => void;
  resetAllViews: () => void;
  saveLayout: () => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

function addOrEnableWidgetAtBottom(
  list: DashboardWidgetConfig[],
  targetId: DashboardWidgetId
): DashboardWidgetConfig[] {
  const currentVisible = list
    .filter((w) => w.visible && w.id !== targetId)
    .sort((a, b) => a.order - b.order);

  const existing = list.find((w) => w.id === targetId);
  const defaultMeta = WIDGET_REGISTRY[targetId];
  const targetConfig: DashboardWidgetConfig = existing
    ? { ...existing, visible: true }
    : {
        id: targetId,
        visible: true,
        colSpan: defaultMeta?.defaultColSpan ?? 4,
        order: currentVisible.length,
      };

  const nextVisible = [...currentVisible, targetConfig];
  const nextHidden = list.filter((w) => !w.visible && w.id !== targetId);

  return [...nextVisible, ...nextHidden].map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

function hideWidget(
  list: DashboardWidgetConfig[],
  targetId: DashboardWidgetId
): DashboardWidgetConfig[] {
  const nextVisible = list
    .filter((w) => w.visible && w.id !== targetId)
    .sort((a, b) => a.order - b.order);

  const existing = list.find((w) => w.id === targetId);
  const targetHidden: DashboardWidgetConfig[] = existing
    ? [{ ...existing, visible: false }]
    : [];

  const otherHidden = list.filter((w) => !w.visible && w.id !== targetId);

  return [...nextVisible, ...otherHidden, ...targetHidden].map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

function reorderVisibleWidgets(
  list: DashboardWidgetConfig[],
  sourceIndex: number,
  destIndex: number
): DashboardWidgetConfig[] {
  const visible = list
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);
  const hidden = list.filter((w) => !w.visible);

  if (
    sourceIndex < 0 ||
    sourceIndex >= visible.length ||
    destIndex < 0 ||
    destIndex >= visible.length ||
    sourceIndex === destIndex
  ) {
    return list;
  }

  const [moved] = visible.splice(sourceIndex, 1);
  visible.splice(destIndex, 0, moved);

  return [...visible, ...hidden].map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

function moveVisibleWidget(
  list: DashboardWidgetConfig[],
  id: DashboardWidgetId,
  direction: "up" | "down"
): DashboardWidgetConfig[] {
  const visible = list
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);
  const hidden = list.filter((w) => !w.visible);

  const idx = visible.findIndex((w) => w.id === id);
  if (idx === -1) return list;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= visible.length) return list;

  const temp = visible[idx];
  visible[idx] = visible[targetIdx];
  visible[targetIdx] = temp;

  return [...visible, ...hidden].map((item, i) => ({
    ...item,
    order: i,
  }));
}

function mergeWithDefaults(
  savedConfigs?: Record<DashboardViewMode, DashboardWidgetConfig[]>
): Record<DashboardViewMode, DashboardWidgetConfig[]> {
  const allViews: DashboardViewMode[] = [
    "overview",
    "technician",
    "inventory",
    "sales",
    "kanban",
  ];
  const allWidgetIds = Object.keys(WIDGET_REGISTRY) as DashboardWidgetId[];

  const result: Record<DashboardViewMode, DashboardWidgetConfig[]> = {
    overview: [...DEFAULT_VIEW_PRESETS.overview],
    technician: [...DEFAULT_VIEW_PRESETS.technician],
    inventory: [...DEFAULT_VIEW_PRESETS.inventory],
    sales: [...DEFAULT_VIEW_PRESETS.sales],
    kanban: [...DEFAULT_VIEW_PRESETS.kanban],
  };

  if (!savedConfigs) return result;

  allViews.forEach((view) => {
    const saved = savedConfigs[view];
    if (Array.isArray(saved) && saved.length > 0) {
      const merged: DashboardWidgetConfig[] = [];
      const seen = new Set<DashboardWidgetId>();

      // Preserve saved items
      saved.forEach((item) => {
        if (WIDGET_REGISTRY[item.id]) {
          merged.push({
            id: item.id,
            visible: item.visible ?? true,
            colSpan: item.colSpan ?? WIDGET_REGISTRY[item.id].defaultColSpan,
            order: merged.length,
          });
          seen.add(item.id);
        }
      });

      // Add any missing widgets from default
      allWidgetIds.forEach((id) => {
        if (!seen.has(id)) {
          const defaultItem = DEFAULT_VIEW_PRESETS[view].find((w) => w.id === id);
          merged.push({
            id,
            visible: defaultItem?.visible ?? false,
            colSpan: defaultItem?.colSpan ?? WIDGET_REGISTRY[id].defaultColSpan,
            order: merged.length,
          });
        }
      });

      // For any view other than "overview", enforce service_table visible = false
      if (view !== "overview") {
        merged.forEach((item) => {
          if (item.id === "service_table") {
            item.visible = false;
          }
        });
      }

      // Normalize orders: visible items 0..V-1, hidden items V..Total-1
      const visibleItems = merged.filter((w) => w.visible);
      const hiddenItems = merged.filter((w) => !w.visible);
      result[view] = [...visibleItems, ...hiddenItems].map((item, idx) => ({
        ...item,
        order: idx,
      }));
    }
  });

  return result;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<DashboardViewMode>("overview");
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showCreateActions, setShowCreateActions] = useState(false);

  const [viewConfigs, setViewConfigs] = useState<
    Record<DashboardViewMode, DashboardWidgetConfig[]>
  >(() => DEFAULT_VIEW_PRESETS);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const storedPrivacy = localStorage.getItem(PRIVACY_KEY);
      if (storedPrivacy !== null) {
        setIsPrivacyMode(storedPrivacy === "true");
      }

      const storedActions = localStorage.getItem(CREATE_ACTIONS_KEY);
      if (storedActions !== null) {
        setShowCreateActions(storedActions === "true");
      }

      const storedLayout = localStorage.getItem(STORAGE_KEY);
      if (storedLayout) {
        const parsed = JSON.parse(storedLayout);
        if (parsed?.viewConfigs) {
          setViewConfigs(mergeWithDefaults(parsed.viewConfigs));
        }
        if (parsed?.activeView && parsed.activeView in DEFAULT_VIEW_PRESETS) {
          setActiveView(parsed.activeView);
        }
      }
    } catch (e) {
      console.warn("Failed to read dashboard layout from localStorage:", e);
    }
  }, []);

  // Save changes to localStorage
  const saveToStorage = useCallback(
    (
      newConfigs: Record<DashboardViewMode, DashboardWidgetConfig[]>,
      view: DashboardViewMode
    ) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 2,
            activeView: view,
            viewConfigs: newConfigs,
          })
        );
      } catch (e) {
        console.warn("Failed to persist dashboard layout:", e);
      }
    },
    []
  );

  const toggleCustomizing = useCallback(() => {
    setIsCustomizing((prev) => !prev);
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PRIVACY_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleCreateActions = useCallback(() => {
    setShowCreateActions((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CREATE_ACTIONS_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleWidgetVisibility = useCallback(
    (id: DashboardWidgetId) => {
      if (id === "service_table" && activeView !== "overview") {
        return;
      }
      let isEnabling = false;
      setViewConfigs((prev) => {
        const currentList = prev[activeView] || [];
        const existing = currentList.find((w) => w.id === id);
        isEnabling = !existing?.visible;

        const nextList = isEnabling
          ? addOrEnableWidgetAtBottom(currentList, id)
          : hideWidget(currentList, id);

        const updated = { ...prev, [activeView]: nextList };
        saveToStorage(updated, activeView);
        return updated;
      });

      const meta = WIDGET_REGISTRY[id];
      const title = meta?.title || id;
      if (isEnabling) {
        toast.success(`Added "${title}" to bottom of dashboard`, {
          duration: 2500,
          position: "bottom-right",
        });
      } else {
        toast.success(`Removed "${title}" from dashboard`, {
          duration: 2500,
          position: "bottom-right",
        });
      }
    },
    [activeView, saveToStorage]
  );

  const setWidgetColSpan = useCallback(
    (id: DashboardWidgetId, span: WidgetColSpan) => {
      setViewConfigs((prev) => {
        const currentList = prev[activeView] || [];
        const nextList = currentList.map((item) =>
          item.id === id ? { ...item, colSpan: span } : item
        );
        const updated = { ...prev, [activeView]: nextList };
        saveToStorage(updated, activeView);
        return updated;
      });
    },
    [activeView, saveToStorage]
  );

  const reorderWidgets = useCallback(
    (sourceIndex: number, destIndex: number) => {
      setViewConfigs((prev) => {
        const currentList = prev[activeView] || [];
        const nextList = reorderVisibleWidgets(currentList, sourceIndex, destIndex);
        const updated = { ...prev, [activeView]: nextList };
        saveToStorage(updated, activeView);
        return updated;
      });
    },
    [activeView, saveToStorage]
  );

  const moveWidget = useCallback(
    (id: DashboardWidgetId, direction: "up" | "down") => {
      setViewConfigs((prev) => {
        const currentList = prev[activeView] || [];
        const nextList = moveVisibleWidget(currentList, id, direction);
        const updated = { ...prev, [activeView]: nextList };
        saveToStorage(updated, activeView);
        return updated;
      });
    },
    [activeView, saveToStorage]
  );

  const removeWidget = useCallback(
    (id: DashboardWidgetId) => {
      setViewConfigs((prev) => {
        const currentList = prev[activeView] || [];
        const nextList = hideWidget(currentList, id);
        const updated = { ...prev, [activeView]: nextList };
        saveToStorage(updated, activeView);
        return updated;
      });
      const meta = WIDGET_REGISTRY[id];
      toast.success(`Removed "${meta?.title || id}" from dashboard`, {
        duration: 2500,
        position: "bottom-right",
      });
    },
    [activeView, saveToStorage]
  );

  const addWidget = useCallback(
    (id: DashboardWidgetId) => {
      if (id === "service_table" && activeView !== "overview") {
        return;
      }
      setViewConfigs((prev) => {
        const currentList = prev[activeView] || [];
        const nextList = addOrEnableWidgetAtBottom(currentList, id);
        const updated = { ...prev, [activeView]: nextList };
        saveToStorage(updated, activeView);
        return updated;
      });
      const meta = WIDGET_REGISTRY[id];
      toast.success(`Added "${meta?.title || id}" to bottom of dashboard`, {
        duration: 2500,
        position: "bottom-right",
      });
    },
    [activeView, saveToStorage]
  );

  const resetCurrentView = useCallback(() => {
    setViewConfigs((prev) => {
      const reset = {
        ...prev,
        [activeView]: [...DEFAULT_VIEW_PRESETS[activeView]],
      };
      saveToStorage(reset, activeView);
      return reset;
    });
    toast.success(`Reset layout to default for current view`, {
      duration: 2500,
      position: "bottom-right",
    });
  }, [activeView, saveToStorage]);

  const resetAllViews = useCallback(() => {
    setViewConfigs(DEFAULT_VIEW_PRESETS);
    saveToStorage(DEFAULT_VIEW_PRESETS, activeView);
    toast.success(`All dashboard views reset to default`, {
      duration: 2500,
      position: "bottom-right",
    });
  }, [activeView, saveToStorage]);

  const saveLayout = useCallback(() => {
    saveToStorage(viewConfigs, activeView);
    setIsCustomizing(false);
    toast.success("Dashboard layout saved successfully!", {
      duration: 2500,
      position: "bottom-right",
      icon: "💾",
    });
  }, [activeView, saveToStorage, viewConfigs]);

  const handleSetActiveView = useCallback(
    (view: DashboardViewMode) => {
      setActiveView(view);
      saveToStorage(viewConfigs, view);
    },
    [saveToStorage, viewConfigs]
  );

  // Active sorted widgets for currently selected view
  const allWidgetsForActiveView = useMemo(() => {
    const list = viewConfigs[activeView] || DEFAULT_VIEW_PRESETS[activeView];
    const sorted = [...list].sort((a, b) => a.order - b.order);
    if (activeView !== "overview") {
      return sorted.map((w) =>
        w.id === "service_table" ? { ...w, visible: false } : w
      );
    }
    return sorted;
  }, [activeView, viewConfigs]);

  const visibleWidgets = useMemo(() => {
    return allWidgetsForActiveView.filter(
      (w) => w.visible && (activeView === "overview" || w.id !== "service_table")
    );
  }, [allWidgetsForActiveView, activeView]);

  const value = useMemo<DashboardContextType>(
    () => ({
      activeView,
      isCustomizing,
      isPrivacyMode,
      isAddModalOpen,
      showCreateActions,
      widgets: visibleWidgets,
      allWidgetsForActiveView,
      setActiveView: handleSetActiveView,
      setIsCustomizing,
      toggleCustomizing,
      setIsPrivacyMode,
      togglePrivacyMode,
      setIsAddModalOpen,
      setShowCreateActions,
      toggleCreateActions,
      toggleWidgetVisibility,
      setWidgetColSpan,
      reorderWidgets,
      moveWidget,
      removeWidget,
      addWidget,
      resetCurrentView,
      resetAllViews,
      saveLayout,
    }),
    [
      activeView,
      isCustomizing,
      isPrivacyMode,
      isAddModalOpen,
      showCreateActions,
      visibleWidgets,
      allWidgetsForActiveView,
      handleSetActiveView,
      toggleCustomizing,
      togglePrivacyMode,
      toggleCreateActions,
      toggleWidgetVisibility,
      setWidgetColSpan,
      reorderWidgets,
      moveWidget,
      removeWidget,
      addWidget,
      resetCurrentView,
      resetAllViews,
      saveLayout,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

const DEFAULT_FALLBACK_CONTEXT: DashboardContextType = {
  activeView: "overview",
  isCustomizing: false,
  isPrivacyMode: false,
  isAddModalOpen: false,
  showCreateActions: false,
  widgets: [],
  allWidgetsForActiveView: [],
  setActiveView: () => {},
  setIsCustomizing: () => {},
  toggleCustomizing: () => {},
  setIsPrivacyMode: () => {},
  togglePrivacyMode: () => {},
  setIsAddModalOpen: () => {},
  setShowCreateActions: () => {},
  toggleCreateActions: () => {},
  toggleWidgetVisibility: () => {},
  setWidgetColSpan: () => {},
  reorderWidgets: () => {},
  moveWidget: () => {},
  removeWidget: () => {},
  addWidget: () => {},
  resetCurrentView: () => {},
  resetAllViews: () => {},
  saveLayout: () => {},
};

export function useDashboard() {
  const context = useContext(DashboardContext);
  return context || DEFAULT_FALLBACK_CONTEXT;
}
