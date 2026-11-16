import { requireOwner, getLocations } from "@/lib/auth";
import { ImportFlow } from "@/components/catalog/import-flow";
export const metadata = { title: "Import catalog or stock" };
export default async function ImportPage() {
  await requireOwner();
  const { locations, selected } = await getLocations();
  return <ImportFlow locations={locations} selected={selected} />;
}
