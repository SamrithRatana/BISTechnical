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

  return (
    <PageWrapper titleKey="nav.inspection" subtitleKey="sub.inspection">
      <ServiceTable
        activeFilter="Inspection"
        activeTabKey={activeTabKey}
        tabs={INSPECTION_TABS}
        onTabChange={setActiveTabKey}
      />
    </PageWrapper>
  );
}
