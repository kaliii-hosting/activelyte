import { redirect } from "next/navigation";

// The former "Org Settings" is now the unified /settings page (role-aware).
export default function AdminSettingsRedirect() {
  redirect("/settings");
}
