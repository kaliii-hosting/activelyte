import { RewardsView } from "@/components/rewards/rewards-view";

// NOTE: demo/design mode — renders without an auth guard so the layout is
// instantly viewable while the design is finalized. Re-wrap in <RouteGuard>
// (and swap to the live data hooks in rewards-view-live.tsx) once approved.
export default function RewardsPage() {
  return <RewardsView />;
}
