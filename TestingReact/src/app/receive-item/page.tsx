"use client";

import React from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";

export default function ReceiveItemPage() {
  return (
    <PageWrapper title="Received Items" subtitle="Technical service queue for items newly received in maintenance">
      <ServiceTable activeFilter="Received" />
    </PageWrapper>
  );
}
