import { cookies } from "next/headers";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { previewSignOut } from "../actions";
import { locations, staff } from "../fixtures";

/** The cookie `preview-role=staff` shows the staff navigation. It lets a probe change the role on an open page. */
async function PreviewAccountShell({ children }: { children: React.ReactNode }) {
  const owner = (await cookies()).get("preview-role")?.value !== "staff";
  return (
    <Shell base="/preview" account={{ name: staff[0].full_name, owner, locations, selected: locations[0].id, signOut: previewSignOut }}>
      {children}
    </Shell>
  );
}

export default function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PreviewAccountShell>{children}</PreviewAccountShell>
    </Suspense>
  );
}
