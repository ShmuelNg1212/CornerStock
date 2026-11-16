"use client";

import { useRef } from "react";
import { inputClass } from "@/components/ui/field";
import type { Location } from "@/lib/types";
import { ScanBatch } from "./scan-batch";
import { ScanConfirm } from "./scan-confirm";
import { ScanReading } from "./scan-reading";
import { ScanStart } from "./scan-start";
import { useScan } from "./use-scan";

const hidden = { className: "sr-only", tabIndex: -1, "aria-hidden": true, type: "file", accept: "image/*" } as const;

/** The scan of a ball box label: one photo, a batch of photos, or typed details. */
export function ScanFlow({ locations, defaultLocationId }: { locations: Location[]; defaultLocationId: string }) {
  const scan = useScan({ locations, defaultLocationId });
  const camera = useRef<HTMLInputElement>(null);
  const batchCamera = useRef<HTMLInputElement>(null);
  const batchLibrary = useRef<HTMLInputElement>(null);

  const locationSelect = (
    <select value={scan.locationId} onChange={(event) => scan.setLocationId(event.target.value)} className={inputClass} required>
      {!scan.locationId && <option value="">Select a location</option>}
      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.name}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <input
        {...hidden}
        ref={camera}
        capture="environment"
        onChange={(event) => {
          void scan.onPhoto(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        {...hidden}
        ref={batchCamera}
        capture="environment"
        onChange={(event) => {
          scan.addPhotos(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <input
        {...hidden}
        ref={batchLibrary}
        multiple
        onChange={(event) => {
          scan.addPhotos(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {scan.step === "start" && (
        <ScanStart
          saved={scan.saved}
          batchAdded={scan.batchAdded}
          onTakePhoto={() => camera.current?.click()}
          onType={scan.typeDetails}
          onBatch={scan.startBatch}
        />
      )}
      {scan.step === "reading" && <ScanReading preview={scan.preview} />}
      {scan.step === "batch" && (
        <ScanBatch
          batch={scan.batch}
          message={scan.message}
          saving={scan.saving}
          locationSelect={locationSelect}
          onCamera={() => batchCamera.current?.click()}
          onLibrary={() => batchLibrary.current?.click()}
          onOpen={scan.openItem}
          onRemove={scan.removeItem}
          onSaveAll={() => void scan.saveAll()}
          onDone={scan.finishBatch}
        />
      )}
      {scan.step === "confirm" && (
        <ScanConfirm
          fields={scan.fields}
          errors={scan.errors}
          unread={scan.unread}
          knownModel={scan.knownModel}
          editModel={scan.editModel}
          existingBallId={scan.existingBallId}
          message={scan.message}
          saving={scan.saving}
          preview={scan.preview}
          canRetake={scan.hasOwnPhoto}
          fromBatch={scan.fromBatch}
          locationSelect={locationSelect}
          onField={scan.setField}
          onShowModel={scan.showModel}
          onSave={scan.save}
          onRetake={() => camera.current?.click()}
          onCancel={scan.fromBatch ? scan.backToBatch : scan.cancel}
        />
      )}
    </>
  );
}
