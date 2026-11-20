import { Suspense } from "react";
import { ActivityList } from "@/components/activity/activity-list";
import { ActivityListSkeleton } from "@/components/activity/activity-skeleton";
import { requireStaff } from "@/lib/auth";
import { readActivity } from "@/lib/activity-queries";
import { loadOlderActivity } from "./actions";

export const metadata = { title: "Activity" };

async function Activity({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams;
  const filter = typeof type === "string" ? type : undefined;
  const [profile, page] = await Promise.all([requireStaff(), readActivity(filter, null)]);
  // A new filter is a new list: the key drops the older pages of the last filter.
  return <ActivityList key={filter ?? "all"} filter={filter} first={page} loadOlder={loadOlderActivity} showSalesReport={profile.role === "owner"} />;
}

export default function ActivityPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  return (
    <Suspense fallback={<ActivityListSkeleton />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}
