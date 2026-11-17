import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** A Supabase client that acts as the signed-in user. Row-level security applies. */
export async function createClient() {
  // Auth initialization reads the clock. Run it after a real request arrives.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // A Server Component cannot set cookies. The proxy refreshes the session.
        }
      },
    },
  });
}
