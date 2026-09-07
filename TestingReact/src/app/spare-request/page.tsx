"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const SPARE_REQUEST_TABS: TabItem[] = [
  { key: "Inspection", labelKey: "status.inspection", color: "cyan" },
  { key: "Awaiting Sparepart", labelKey: "tab.techRequestSpare", color: "blue" },
];

export default function SpareRequestPage() {
  const [activeTabKey, setActiveTabKey] = useState("Awaiting Sparepart");

  return (
    <PageWrapper titleKey="nav.technicalRequestSpare" subtitleKey="sub.spareRequest">
      <ServiceTable
        activeFilter="Awaiting Sparepart"
        activeTabKey={activeTabKey}
        tabs={SPARE_REQUEST_TABS}
        onTabChange={setActiveTabKey}
        disableStatusDropdown={activeTabKey !== "Awaiting Sparepart"}
      />
    </PageWrapper>
  );
}
