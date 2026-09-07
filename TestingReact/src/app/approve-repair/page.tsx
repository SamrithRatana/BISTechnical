"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const APPROVE_REPAIR_TABS: TabItem[] = [
  { key: "Repairing", labelKey: "tab.allRepairing", color: "cyan" },
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
        disableStatusDropdown={true}
      />
    </PageWrapper>
  );
}
