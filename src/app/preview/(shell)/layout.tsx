import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { previewSignOut } from "../actions";
import { locations, staff } from "../fixtures";

export default function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <Shell base="/preview" account={{ name: staff[0].full_name, owner: true, locations, selected: locations[0].id, signOut: previewSignOut }}>
        {children}
      </Shell>
    </Suspense>
  );
}
