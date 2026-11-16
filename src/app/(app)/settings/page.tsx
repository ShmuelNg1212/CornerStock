import { AccountPanel } from "@/components/account-panel";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Location, Profile } from "@/lib/types";
import { LocationSettings, StaffSettings } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const owner = await requireOwner();
  const supabase = await createClient();
  const [{ data: locations }, { data: staff }, { data: counts }] = await Promise.all([
    supabase.from("locations").select("id, name, active").order("name"),
    supabase.from("profiles").select("id, full_name, role, active").order("full_name"),
    supabase.from("stock_counts").select("location_id, in_stock"),
  ]);
  const inStock: Record<string, number> = {};
  for (const row of (counts ?? []) as { location_id: string; in_stock: number }[]) {
    inStock[row.location_id] = (inStock[row.location_id] ?? 0) + row.in_stock;
  }
  return (
    <div className="mx-auto max-w-2xl lg:mx-0">
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>
      <AccountPanel />
      <LocationSettings locations={(locations ?? []) as Location[]} inStock={inStock} />
      <StaffSettings staff={(staff ?? []) as Profile[]} ownId={owner.id} />
    </div>
  );
}
