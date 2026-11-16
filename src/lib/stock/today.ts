/** The movement fields that the day summary reads. */
export type TodayMovement = {
  type: "receive" | "sell" | "reverse_sale" | "transfer" | "adjust" | "remove";
  from_location_id: string | null;
  to_location_id: string | null;
};

// The shop is in the Philippines. Manila time is UTC+8 all year, with no daylight saving time.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of the Manila day that contains `now`, as a UTC time. */
export function startOfManilaDay(now: Date): Date {
  const local = now.getTime() + MANILA_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - MANILA_OFFSET_MS);
}

/**
 * Balls received and sold today at one location, or at all locations.
 * A reversed sale removes one sale. The sale count is never below zero.
 */
export function todayCounts(movements: TodayMovement[], location: string): { received: number; sold: number } {
  const here = (id: string | null) => location === "all" || id === location;
  let received = 0;
  let sold = 0;
  for (const m of movements) {
    if (m.type === "receive" && here(m.to_location_id)) received++;
    else if (m.type === "sell" && here(m.from_location_id)) sold++;
    else if (m.type === "reverse_sale" && here(m.to_location_id)) sold--;
  }
  return { received, sold: Math.max(sold, 0) };
}
