import { LocationSettings, StaffSettings } from "@/app/(app)/settings/settings-forms";
import { closedLocation, locations, staff } from "../../fixtures";

export default function PreviewSettings() {
  return (
    <div className="mx-auto max-w-2xl lg:mx-0">
      <h1 className="text-2xl font-bold">Settings</h1>
      <LocationSettings locations={[...locations, closedLocation]} inStock={{ "loc-main": 86, "loc-room": 1 }} />
      <StaffSettings staff={staff} ownId={staff[0].id} />
    </div>
  );
}
