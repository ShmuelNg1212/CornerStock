"use server";

/** The preview route has no account, so its sign-out does nothing. */
export async function previewSignOut() {}

/** The preview has one page of activity. "Show older" gives the same rows again with new ids. */
export async function previewOlderActivity(): Promise<{ rows: import("@/lib/activity").ActivityRow[]; more: boolean }> {
  const { activityRows } = await import("./fixtures");
  const old = new Date(Date.now() - 6 * 86_400_000);
  return { rows: activityRows(old).map((row) => ({ ...row, id: row.id + 100 })), more: false };
}
