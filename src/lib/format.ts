import { formatGrossWeight } from "@/lib/label/rules";
import type { Ball, MovementType } from "@/lib/types";

export const grossWeight = (oz: number | null) => (oz === null ? "—" : formatGrossWeight(oz));
export const number = (value: number | null, digits?: number) =>
  value === null ? "—" : digits === undefined ? String(Number(value)) : Number(value).toFixed(digits);

export function pinDistance(ball: Pick<Ball, "pin_min" | "pin_max">): string {
  if (ball.pin_min === null) return "—";
  const [min, max] = [Number(ball.pin_min), Number(ball.pin_max ?? ball.pin_min)];
  return min === max ? `${min}"` : `${min}–${max}"`;
}

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
export const price = (value: number | null) => (value === null ? "No price" : peso.format(Number(value)));

const dateTime = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const dateOnly = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });
export const when = (iso: string) => dateTime.format(new Date(iso));
export const day = (isoDate: string | null) => (isoDate === null ? "—" : dateOnly.format(new Date(`${isoDate}T00:00:00Z`)));

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  receive: "Added",
  sell: "Sold",
  reverse_sale: "Sale cancelled",
  transfer: "Moved",
  adjust: "Edited",
  remove: "Removed",
};

/** The initials of a name, for the round badge. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "S";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
