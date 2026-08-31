import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs – Service & Maintenance Portal",
  description:
    "How to use the Service & Maintenance Portal: sign-in methods, the repair workflow, inventory and stock, the reporting suite, and administration.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
