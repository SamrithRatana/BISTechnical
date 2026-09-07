import { redirect } from "next/navigation";

/**
 * @file app/settings/page.tsx
 * @description Redirects seamlessly to the unified Profile & Settings Hub (/profile?tab=settings).
 */
export default function SettingsPage() {
  redirect("/profile?tab=settings");
}
