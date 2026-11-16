/** The movement fields that the day summary reads. */
export type TodayMovement = {
  ball_id: string;
  type: "receive" | "sell" | "reverse_sale" | "transfer" | "adjust" | "remove";
  from_location_id: string | null;
  to_location_id: string | null;
};

// The shop is in the Philippines. Manila time is UTC+8 all year, with no daylight saving time.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The hour of the day in Manila, 0 to 23. */
export function manilaHour(now: Date): number {
  return new Date(now.getTime() + MANILA_OFFSET_MS).getUTCHours();
}

/** Midnight at the start of the Manila day that contains `now`, as a UTC time. */
export function startOfManilaDay(now: Date): Date {
  const local = now.getTime() + MANILA_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - MANILA_OFFSET_MS);
}

/**
 * Balls received and sold today at one location, or at all locations.
 * The movements come in time order. A reversal removes a sale only when that ball was sold
 * earlier today; the reversal of an older sale does not change today's count.
 */
export function todayCounts(movements: TodayMovement[], location: string): { received: number; sold: number } {
  const here = (id: string | null) => location === "all" || id === location;
  let received = 0;
  const soldToday = new Map<string, number>();
  for (const m of movements) {
    if (m.type === "receive" && here(m.to_location_id)) received++;
    else if (m.type === "sell" && here(m.from_location_id)) soldToday.set(m.ball_id, (soldToday.get(m.ball_id) ?? 0) + 1);
    else if (m.type === "reverse_sale" && (soldToday.get(m.ball_id) ?? 0) > 0) soldToday.set(m.ball_id, soldToday.get(m.ball_id)! - 1);
  }
  let sold = 0;
  for (const count of soldToday.values()) sold += count;
  return { received, sold };
}
