import { RouteGuard } from "@/components/auth/route-guard";
import { MembersManager } from "@/components/admin/members-manager";

export default function AdminMembersPage() {
  return (
    <RouteGuard requireRole="admin" title="Admin access required">
      <MembersManager />
    </RouteGuard>
  );
}
