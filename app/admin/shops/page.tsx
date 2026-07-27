import { RouteGuard } from "@/components/auth/route-guard";
import { ShopsManager } from "@/components/admin/shops-manager";

export default function AdminShopsPage() {
  return (
    <RouteGuard requireRole="admin" title="Admin access required">
      <ShopsManager />
    </RouteGuard>
  );
}
