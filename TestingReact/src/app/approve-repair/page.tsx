"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const APPROVE_REPAIR_TABS: TabItem[] = [
  { key: "Repairing", label: "ទាំងអស់ (All Repairing Queue)", color: "cyan" },
  { key: "Sent Spareparts", label: "បានបញ្ជូនគ្រឿងបន្លាស់", color: "purple" },
  { key: "Inspection", label: "វិនិច្ឆ័យរួចរាល់", color: "blue" },
  { key: "Sale Confirmed", label: "អាចជួសជុលបាន", color: "emerald" },
];

export default function ApproveRepairPage() {
  const [activeTabKey, setActiveTabKey] = useState("Repairing");

  return (
    <PageWrapper title="Approve Repairing" subtitle="Active maintenance and repair queue for service engineers">
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
