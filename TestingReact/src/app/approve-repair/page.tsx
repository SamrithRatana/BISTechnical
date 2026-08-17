"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const APPROVE_REPAIR_TABS: TabItem[] = [
  { key: "Repairing", labelKey: "tab.allRepairing", color: "cyan" },
  { key: "Sent Spareparts", labelKey: "transition.sparesSent", color: "purple" },
  { key: "Inspection", labelKey: "transition.inspectionDone", color: "blue" },
  { key: "Sale Confirmed", labelKey: "transition.repairable", color: "emerald" },
];

export default function ApproveRepairPage() {
  const [activeTabKey, setActiveTabKey] = useState("Repairing");

  return (
    <PageWrapper titleKey="nav.approveRepairing" subtitleKey="sub.approveRepair">
      <ServiceTable
        activeFilter="Repairing"
        activeTabKey={activeTabKey}
        tabs={APPROVE_REPAIR_TABS}
        onTabChange={setActiveTabKey}
        requireApproval
      />
    </PageWrapper>
  );
}
