/**
 * @file types.ts
 * @description Types for the customizable, flexible QuickBooks-style dashboard system.
 */

export type DashboardWidgetId =
  | "quick_actions"
  | "kpi_cards"
  | "workflow_funnel"
  | "ticket_chart"
  | "urgent_tickets"
  | "service_table"
  | "low_stock"
  | "engineer_workload"
  | "live_stream"
  | "kanban_board"
  | "stock_movement_live"
  | "stock_spare_requests"
  | "technician_active_queue"
  | "sales_quotation_followup"
  | "sales_kpis"
  | "engineer_kpi"
  | "tech_parts_ready"
  | "financial_revenue"
  | "contract_renewals";

export type WidgetCategory =
  | "workflow"
  | "analytics"
  | "operations"
  | "inventory"
  | "team";

export type WidgetColSpan = 1 | 2 | 3 | 4;

export type DashboardViewMode =
  | "overview"
  | "technician"
  | "inventory"
  | "sales"
  | "kanban";

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  visible: boolean;
  colSpan: WidgetColSpan;
  order: number;
}

export interface WidgetMeta {
  id: DashboardWidgetId;
  title: string;
  titleKm: string;
  description: string;
  descriptionKm: string;
  category: WidgetCategory;
  defaultColSpan: WidgetColSpan;
  minColSpan: WidgetColSpan;
  maxColSpan: WidgetColSpan;
  badge?: string;
  badgeKm?: string;
}

export interface DashboardLayoutState {
  version: number;
  activeView: DashboardViewMode;
  isCustomizing: boolean;
  isPrivacyMode: boolean;
  viewConfigs: Record<DashboardViewMode, DashboardWidgetConfig[]>;
}
