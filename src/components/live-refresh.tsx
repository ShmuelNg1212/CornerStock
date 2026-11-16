"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Reloads the page data when stock changes on another device. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel("stock")
      .on("postgres_changes", { event: "*", schema: "public", table: "balls" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ball_models" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, refresh)
      .subscribe();
    // A phone that comes back from sleep can have missed changes.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
