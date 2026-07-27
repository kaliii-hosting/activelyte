import { PeopleStrip } from "@/components/home/people-strip";
import { RewardsView } from "@/components/rewards/rewards-view";

// Home = People strip (admin ↔ client chat entry point) + the Rewards view
// (demo design). The previous dashboard moved to /about (Company About page).
export default function Home() {
  return (
    <>
      <div style={{ paddingTop: 14 }}>
        <PeopleStrip />
      </div>
      <RewardsView />
    </>
  );
}
