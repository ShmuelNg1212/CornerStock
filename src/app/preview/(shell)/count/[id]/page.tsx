import { Suspense } from "react";
import { CountPreview } from "../count-preview";

/** A past count in the preview: a count finished in this session, or the large fixture result. */
export default async function PreviewCountResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CountPreview owner countId={id} />
    </Suspense>
  );
}
