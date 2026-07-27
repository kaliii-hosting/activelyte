import { RouteGuard } from "@/components/auth/route-guard";
import { CatalogManager } from "@/components/admin/catalog-manager";

export default function AdminCatalogPage() {
  return (
    <RouteGuard requireRole="admin" title="Admin access required">
      <CatalogManager />
    </RouteGuard>
  );
}
