"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";
import { TabItem } from "@/components/StatusTabMenu";

const CONFIRMED_SALE_TABS: TabItem[] = [
  { key: "Awaiting Customer Confirm", labelKey: "transition.awaitingCustomer", color: "amber" },
  { key: "Sale Confirmed", labelKey: "transition.repairable", color: "emerald" },
  { key: "Sent Spareparts", labelKey: "transition.sendSparesToTech", color: "purple" },
];

export default function ConfirmedSalePage() {
  const [activeTabKey, setActiveTabKey] = useState("Sale Confirmed");

  return (
    <PageWrapper titleKey="nav.confirmedSale" subtitleKey="sub.confirmedSale">
      <ServiceTable
        activeFilter="Sale Confirmed"
        activeTabKey={activeTabKey}
        tabs={CONFIRMED_SALE_TABS}
        onTabChange={setActiveTabKey}
        disableStatusDropdown={activeTabKey !== "Sale Confirmed"}
      />
    </PageWrapper>
  );
}
