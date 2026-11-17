import { cookies } from "next/headers";
import { Suspense } from "react";
import { CountPreview } from "./count-preview";

/** The cookie `preview-role=staff` shows the staff view of the result. */
async function Preview() {
  const owner = (await cookies()).get("preview-role")?.value !== "staff";
  return <CountPreview owner={owner} />;
}

export default function PreviewCount() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}
