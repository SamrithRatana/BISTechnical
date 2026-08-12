import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In – Service & Maintenance Portal",
  description: "Login to the Enterprise Service and Maintenance Management System",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
