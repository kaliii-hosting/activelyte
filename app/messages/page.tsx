import { RouteGuard } from "@/components/auth/route-guard";
import { MessagesView } from "@/components/messaging/messages-view";

// Uses useSearchParams (?c=) — render dynamically, not statically prerendered.
export const dynamic = "force-dynamic";

export default function MessagesPage() {
  return (
    <RouteGuard title="Sign in to view messages">
      <MessagesView />
    </RouteGuard>
  );
}
