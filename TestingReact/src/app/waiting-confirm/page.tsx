"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const WAITING_CONFIRM_TABS: TabItem[] = [
  { key: "Item Recieved", label: "ម៉ាស៊ីនទទួល", color: "slate" },
  { key: "Inspection", label: "វិនិច្ឆ័យរួចរាល់", color: "cyan" },
  { key: "Awaiting Sparepart", label: "ផ្នែកជាងស្នើរគ្រឿងបន្លាស់", color: "blue" },
  { key: "Awaiting Customer Confirm", label: "រង់ចាំយល់ព្រមពីភ្ញៀវ", color: "amber" },
  { key: "Sale Confirmed", label: "ផ្នែកទីផ្សារ Confirmed & រង់ចាំ 4 ទៅ 6", color: "emerald" },
  { key: "Sent Spareparts", label: "បានបញ្ជូនគ្រឿងបន្លាស់", color: "purple" },
];

export default function WaitingConfirmPage() {
  const [activeTabKey, setActiveTabKey] = useState("Awaiting Customer Confirm");

  return (
    <PageWrapper title="Set Waiting Customer Confirm" subtitle="Repairs pending customer approval and quotation acceptance">
      <ServiceTable
        activeFilter="Awaiting Customer Confirm"
        activeTabKey={activeTabKey}
        tabs={WAITING_CONFIRM_TABS}
        onTabChange={setActiveTabKey}
      />
    </PageWrapper>
  );
}
