import { Suspense } from "react";
import { CountPreview } from "../count-preview";

/** A past count in the preview: always the large fixture result. */
export default function PreviewCountResult() {
  return (
    <Suspense>
      <CountPreview owner forceResult />
    </Suspense>
  );
}
