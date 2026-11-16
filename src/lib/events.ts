/** Sent on `window` when balls go into stock from a scan. The tab bar shows the count. */
export const BALLS_SAVED = "cornerstock:balls-saved";

export function announceSaved(count: number) {
  if (typeof window !== "undefined" && count > 0) window.dispatchEvent(new CustomEvent(BALLS_SAVED, { detail: count }));
}
