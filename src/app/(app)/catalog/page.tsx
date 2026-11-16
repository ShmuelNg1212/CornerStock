import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { readCatalog } from "@/lib/catalog/queries";
import { CatalogList } from "@/components/catalog/catalog-list";

export const metadata = { title: "Catalog" };
async function Catalog() {
  const [profile, models] = await Promise.all([requireStaff(), readCatalog()]);
  return <CatalogList models={models} owner={profile.role === "owner"} />;
}
export default function CatalogPage() {
  return (
    <Suspense fallback={<p role="status">Loading catalog…</p>}>
      <Catalog />
    </Suspense>
  );
}
