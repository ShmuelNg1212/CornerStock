"use client";

import { useRouter } from "next/navigation";
import type { CountApi } from "@/lib/count/session";
import type { Location } from "@/lib/types";
import { CountFlow } from "./count-flow";

/** The count in the app: the finish opens the result page of the count. */
export function CountScreen({ locations, defaultLocationId, api }: { locations: Location[]; defaultLocationId: string; api: CountApi }) {
  const router = useRouter();
  return <CountFlow locations={locations} defaultLocationId={defaultLocationId} api={api} onFinished={(result) => router.push(`/count/${result.id}`)} />;
}
