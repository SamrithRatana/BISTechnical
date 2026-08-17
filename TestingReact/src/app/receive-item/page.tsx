"use client";

import React from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";

export default function ReceiveItemPage() {
  return (
    <PageWrapper titleKey="nav.receivedItems" subtitleKey="sub.receivedItems">
      <ServiceTable activeFilter="Received" />
    </PageWrapper>
  );
}
