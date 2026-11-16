import type { Metadata } from "next";
import { ALL_LOCATIONS, getLocations } from "@/lib/auth";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Scan label" };

export default async function ScanPage() {
  const { locations, selected } = await getLocations();
  return <ScanFlow locations={locations} defaultLocationId={selected === ALL_LOCATIONS ? "" : selected} />;
}
