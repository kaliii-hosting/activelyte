import { RouteGuard } from "@/components/auth/route-guard";
import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <RouteGuard title="Sign in to open settings">
      <SettingsView />
    </RouteGuard>
  );
}
