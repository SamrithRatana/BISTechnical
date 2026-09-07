"use client";

import React, { useState, useCallback } from "react";
import { useDashboard } from "./useDashboardStore";
import DashboardWidgetCard from "./DashboardWidgetCard";
import StatCards from "@/components/StatCards";
import DashboardChart from "@/components/DashboardChart";
import ServiceTable from "@/components/ServiceTable";
import QuickActionCarousel from "./widgets/QuickActionCarousel";
import WorkflowFunnelWidget from "./widgets/WorkflowFunnelWidget";
import UrgentTicketsWidget from "./widgets/UrgentTicketsWidget";
import LowStockAlertWidget from "./widgets/LowStockAlertWidget";
import EngineerWorkloadWidget from "./widgets/EngineerWorkloadWidget";
import LiveActivityStreamWidget from "./widgets/LiveActivityStreamWidget";
import KanbanBoardWidget from "./widgets/KanbanBoardWidget";
import StockMovementLiveWidget from "./widgets/StockMovementLiveWidget";
import StockSpareRequestsWidget from "./widgets/StockSpareRequestsWidget";
import TechnicianActiveQueueWidget from "./widgets/TechnicianActiveQueueWidget";
import SalesQuotationFollowupWidget from "./widgets/SalesQuotationFollowupWidget";
import SalesKpisWidget from "./widgets/SalesKpisWidget";
import EngineerKpiWidget from "./widgets/EngineerKpiWidget";
import TechPartsReadyWidget from "./widgets/TechPartsReadyWidget";
import FinancialRevenueWidget from "./widgets/FinancialRevenueWidget";
import ContractRenewalsWidget from "./widgets/ContractRenewalsWidget";
import { DashboardWidgetConfig } from "./types";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";

interface DashboardGridProps {
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
  filterExtras?: import("@/services/api").ServiceSearchExtras;
  setFilterExtras?: (extras?: import("@/services/api").ServiceSearchExtras) => void;
}

export default function DashboardGrid({
  selectedFilter,
  setSelectedFilter,
  filterExtras,
  setFilterExtras,
}: DashboardGridProps) {
  const { widgets, reorderWidgets, isCustomizing, setIsAddModalOpen, activeView } =
    useDashboard();
  const { lang } = useI18n();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDragEnd = useCallback(() => {
    if (
      draggedIndex !== null &&
      dragOverIndex !== null &&
      draggedIndex !== dragOverIndex
    ) {
      reorderWidgets(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, reorderWidgets]);

  const renderWidgetContent = (config: DashboardWidgetConfig) => {
    switch (config.id) {
      case "quick_actions":
        return <QuickActionCarousel />;

      case "kpi_cards":
        return (
          <StatCards
            selectedFilter={selectedFilter}
            setSelectedFilter={setSelectedFilter}
            onFilterChangeWithExtras={(filter, extras) => {
              setSelectedFilter(filter);
              setFilterExtras?.(extras);
            }}
          />
        );

      case "workflow_funnel":
        return (
          <WorkflowFunnelWidget
            selectedFilter={selectedFilter}
            onSelectStage={(stage) => {
              setSelectedFilter(stage);
              setFilterExtras?.(undefined);
            }}
          />
        );

      case "ticket_chart":
        return <DashboardChart />;

      case "urgent_tickets":
        return <UrgentTicketsWidget />;

      case "service_table":
        if (activeView !== "overview") return null;
        return (
          <ServiceTable
            activeFilter={selectedFilter}
            searchExtras={filterExtras}
            isDashboardWidget
            containerClassName="min-h-[480px] h-[540px] lg:h-[580px] flex flex-col"
          />
        );

      case "low_stock":
        return <LowStockAlertWidget />;

      case "engineer_workload":
        return <EngineerWorkloadWidget />;

      case "live_stream":
        return <LiveActivityStreamWidget />;

      case "kanban_board":
        return <KanbanBoardWidget />;

      case "stock_movement_live":
        return <StockMovementLiveWidget />;

      case "stock_spare_requests":
        return <StockSpareRequestsWidget />;

      case "technician_active_queue":
        return <TechnicianActiveQueueWidget />;

      case "sales_quotation_followup":
        return <SalesQuotationFollowupWidget />;

      case "sales_kpis":
        return <SalesKpisWidget />;

      case "engineer_kpi":
        return <EngineerKpiWidget />;

      case "tech_parts_ready":
        return <TechPartsReadyWidget />;

      case "financial_revenue":
        return <FinancialRevenueWidget />;

      case "contract_renewals":
        return <ContractRenewalsWidget />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* 4-column flexible grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 items-stretch">
        {widgets
          .filter((config) => activeView === "overview" || config.id !== "service_table")
          .map((config, index) => (
          <DashboardWidgetCard
            key={config.id}
            config={config}
            index={index}
            isDragOver={dragOverIndex === index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {renderWidgetContent(config)}
          </DashboardWidgetCard>
        ))}
      </div>

      {/* When in customize mode, show Add Widget bottom dashed dropzone */}
      {isCustomizing && (
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-full py-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl flex flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all group"
        >
          <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60 transition-colors">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold">
            {lang === "km"
              ? "ចុចដើម្បីបន្ថែម ឬបើកផ្ទាំងព័ត៌មាន (Widgets) ផ្សេងទៀត"
              : "Click to add or re-enable more widgets on this dashboard"}
          </span>
        </button>
      )}
    </div>
  );
}
