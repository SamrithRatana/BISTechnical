"use client";

import React from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";

export default function UnrepairablePage() {
  return (
    <PageWrapper titleKey="nav.setUnrepairable" subtitleKey="sub.unrepairable">
      <ServiceTable activeFilter="Unrepairable" />
    </PageWrapper>
  );
}
