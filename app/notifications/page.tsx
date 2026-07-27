import { RouteGuard } from "@/components/auth/route-guard";
import { NotificationsView } from "@/components/notifications/notifications-view";

export default function NotificationsPage() {
  return (
    <RouteGuard title="Sign in to view notifications">
      <NotificationsView />
    </RouteGuard>
  );
}
