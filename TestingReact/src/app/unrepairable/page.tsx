"use client";

import React from "react";
import PageWrapper from "@/components/PageWrapper";
import ServiceTable from "@/components/ServiceTable";

export default function UnrepairablePage() {
  return (
    <PageWrapper title="Set Unrepairable" subtitle="Equipment deemed beyond economic repair or obsolete">
      <ServiceTable activeFilter="Unrepairable" />
    </PageWrapper>
  );
}
