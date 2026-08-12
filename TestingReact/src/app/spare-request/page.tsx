"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const SPARE_REQUEST_TABS: TabItem[] = [
  { key: "Inspection", label: "វិនិច្ឆ័យ", color: "cyan" },
  { key: "Awaiting Sparepart", label: "ផ្នែកជាងស្នើរគ្រឿងបន្លាស់", color: "blue" },
];

export default function SpareRequestPage() {
  const [activeTabKey, setActiveTabKey] = useState("Awaiting Sparepart");

  return (
    <PageWrapper title="Technical Spare Parts Request" subtitle="Spare parts requisition queue for pending repairs">
      <ServiceTable
        activeFilter="Awaiting Sparepart"
        activeTabKey={activeTabKey}
        tabs={SPARE_REQUEST_TABS}
        onTabChange={setActiveTabKey}
      />
    </PageWrapper>
  );
}
