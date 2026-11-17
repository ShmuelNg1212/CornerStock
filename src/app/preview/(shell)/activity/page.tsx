import { connection } from "next/server";
import { Suspense } from "react";
import { ActivityList } from "@/components/activity/activity-list";
import { previewOlderActivity } from "../../actions";
import { filterTypes } from "@/lib/activity";
import { activityRows } from "../../fixtures";

async function PreviewActivityList({ searchParams }: { searchParams: Promise<{ type?: string; empty?: string }> }) {
  await connection();
  const { type, empty } = await searchParams;
  const types = filterTypes(type);
  const rows = empty ? [] : activityRows().filter((row) => !types || types.includes(row.type));
  return <ActivityList base="/preview" filter={type} first={{ rows, more: rows.length > 0 }} loadOlder={previewOlderActivity} />;
}

/** `?empty=1` shows the empty state. */
export default function PreviewActivity({ searchParams }: { searchParams: Promise<{ type?: string; empty?: string }> }) {
  return (
    <Suspense>
      <PreviewActivityList searchParams={searchParams} />
    </Suspense>
  );
}
