import { requireOwner } from "@/lib/auth";
import { NewModel } from "@/components/catalog/new-model";
export const metadata = { title: "Add catalog model" };
export default async function NewModelPage() {
  await requireOwner();
  return <NewModel />;
}
