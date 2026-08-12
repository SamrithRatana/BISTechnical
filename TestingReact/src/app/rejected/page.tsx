"use client";

import React from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";

export default function RejectedPage() {
  return (
    <PageWrapper title="Customer Rejected" subtitle="Tickets declined by customer after quotation review">
      <ServiceTable activeFilter="Customer Rejected" />
    </PageWrapper>
  );
}
