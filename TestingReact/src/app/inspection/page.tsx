"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const INSPECTION_TABS: TabItem[] = [
  { key: "Inspection", labelKey: "transition.inspectionDone", color: "cyan" },
  { key: "Awaiting Sparepart", labelKey: "tab.techRequestSpare", color: "blue" },
  { key: "Awaiting Customer Confirm", labelKey: "tab.awaitCustomerConfirm", color: "amber" },
  { key: "Sale Confirmed", labelKey: "tab.awaitSaleConfirm", color: "emerald" },
  { key: "Sent Spareparts", labelKey: "transition.sparesSent", color: "purple" },
];

export default function InspectionPage() {
  const [activeTabKey, setActiveTabKey] = useState("Inspection");

  // Only the first tab ("Inspection" / វិនិច្ឆ័យរួចរាល់) allows the technician to select status to dispatch (to Stock or Sales).
  // Other tabs ("Awaiting Sparepart", "Awaiting Customer Confirm", etc.) are read-only tracking tabs for other departments.
  const isReadOnlyTab = activeTabKey !== "Inspection";

  return (
    <PageWrapper titleKey="nav.inspection" subtitleKey="sub.inspection">
      <ServiceTable
        activeFilter="Inspection"
        activeTabKey={activeTabKey}
        tabs={INSPECTION_TABS}
        onTabChange={setActiveTabKey}
        disableStatusDropdown={isReadOnlyTab}
      />
    </PageWrapper>
  );
}
