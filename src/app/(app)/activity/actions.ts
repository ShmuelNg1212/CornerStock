"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { readActivity, type ActivityPage } from "@/lib/activity-queries";

const cursor = z.object({ at: z.string().min(1).max(64), src: z.number().int().min(0).max(1), id: z.number().int().positive() });

/** The page of activity after `before`. */
export async function loadOlderActivity(filter: string | undefined, before: unknown): Promise<ActivityPage> {
  await requireStaff();
  const parsed = cursor.safeParse(before);
  if (!parsed.success) return { rows: [], more: false };
  return readActivity(typeof filter === "string" ? filter : undefined, parsed.data);
}
