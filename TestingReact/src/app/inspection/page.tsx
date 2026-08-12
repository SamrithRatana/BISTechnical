"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const INSPECTION_TABS: TabItem[] = [
  { key: "Inspection", label: "វិនិច្ឆ័យរួចរាល់", color: "cyan" },
  { key: "Awaiting Sparepart", label: "ផ្នែកជាងស្នើរគ្រឿងបន្លាស់", color: "blue" },
  { key: "Awaiting Customer Confirm", label: "រង់ចាំ Confirm ពីអតិថិជន", color: "amber" },
  { key: "Sale Confirmed", label: "រង់ចាំ Confirm ពីផ្នែកSale", color: "emerald" },
  { key: "Sent Spareparts", label: "បានបញ្ជូនគ្រឿងបន្លាស់", color: "purple" },
];

export default function InspectionPage() {
  const [activeTabKey, setActiveTabKey] = useState("Inspection");

  return (
    <PageWrapper title="Inspection" subtitle="Technical inspection records and solutions breakdown">
      <ServiceTable
        activeFilter="Inspection"
        activeTabKey={activeTabKey}
        tabs={INSPECTION_TABS}
        onTabChange={setActiveTabKey}
      />
    </PageWrapper>
  );
}
