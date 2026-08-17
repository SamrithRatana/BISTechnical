"use client";

import React from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";

export default function RejectedPage() {
  return (
    <PageWrapper titleKey="nav.customerRejected" subtitleKey="sub.rejected">
      <ServiceTable activeFilter="Customer Rejected" />
    </PageWrapper>
  );
}
