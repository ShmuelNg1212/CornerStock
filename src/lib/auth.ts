import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Location, Profile } from "@/lib/types";

/** The signed-in staff member. Sends other visitors to the sign-in page. */
export const requireStaff = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  // A local check of the token signature. The profile read below is the live check of access.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) redirect("/login");
  // Row-level security shows no profile to an inactive account.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", userId)
    .maybeSingle<Profile>();
  if (!profile) redirect("/login?error=inactive");
  return profile;
});

export async function requireOwner(): Promise<Profile> {
  const profile = await requireStaff();
  if (profile.role !== "owner") redirect("/");
  return profile;
}

export const LOCATION_COOKIE = "cs_location";
export const ALL_LOCATIONS = "all";

/** The active locations and the one that the selector shows. */
export const getLocations = cache(async (): Promise<{ locations: Location[]; selected: string }> => {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, name, active").eq("active", true).order("name");
  const locations = (data ?? []) as Location[];
  const wanted = (await cookies()).get(LOCATION_COOKIE)?.value;
  const valid = wanted === ALL_LOCATIONS || locations.some((l) => l.id === wanted);
  return { locations, selected: valid ? wanted! : (locations[0]?.id ?? ALL_LOCATIONS) };
});
