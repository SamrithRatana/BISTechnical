"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const WAITING_CONFIRM_TABS: TabItem[] = [
  { key: "Item Recieved", labelKey: "status.received", color: "slate" },
  { key: "Inspection", labelKey: "transition.inspectionDone", color: "cyan" },
  { key: "Awaiting Sparepart", labelKey: "tab.techRequestSpare", color: "blue" },
  { key: "Awaiting Customer Confirm", labelKey: "transition.awaitingCustomer", color: "amber" },
  { key: "Sale Confirmed", labelKey: "tab.saleConfirmedWaiting", color: "emerald" },
  { key: "Sent Spareparts", labelKey: "transition.sparesSent", color: "purple" },
];

export default function WaitingConfirmPage() {
  const [activeTabKey, setActiveTabKey] = useState("Awaiting Customer Confirm");

  return (
    <PageWrapper titleKey="nav.setWaitingCustomer" subtitleKey="sub.waitingConfirm">
      <ServiceTable
        activeFilter="Awaiting Customer Confirm"
        activeTabKey={activeTabKey}
        tabs={WAITING_CONFIRM_TABS}
        onTabChange={setActiveTabKey}
        disableStatusDropdown={activeTabKey !== "Awaiting Customer Confirm"}
      />
    </PageWrapper>
  );
}
