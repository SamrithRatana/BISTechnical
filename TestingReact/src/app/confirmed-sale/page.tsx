"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const CONFIRMED_SALE_TABS: TabItem[] = [
  { key: "Awaiting Customer Confirm", label: "រង់ចាំយល់ព្រមពីភ្ញៀវ", color: "amber" },
  { key: "Sale Confirmed", label: "អាចជួសជុលបាន", color: "emerald" },
  { key: "Sent Spareparts", label: "បញ្ជូនគ្រឿងបន្លាស់ទៅជាង", color: "purple" },
];

export default function ConfirmedSalePage() {
  const [activeTabKey, setActiveTabKey] = useState("Sale Confirmed");

  return (
    <PageWrapper title="Confirmed Repair Sale" subtitle="Sales approved maintenance jobs ready for parts dispatch & repair">
      <ServiceTable
        activeFilter="Sale Confirmed"
        activeTabKey={activeTabKey}
        tabs={CONFIRMED_SALE_TABS}
        onTabChange={setActiveTabKey}
      />
    </PageWrapper>
  );
}
