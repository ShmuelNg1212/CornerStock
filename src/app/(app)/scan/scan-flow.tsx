"use client";

import { useCallback, useRef, useState } from "react";
import { inputClass } from "@/components/ui/field";
import type { Location } from "@/lib/types";
import { ScanBatch } from "./scan-batch";
import { ScanConfirm } from "./scan-confirm";
import { ScanReading } from "./scan-reading";
import { ScanStart } from "./scan-start";
import { ScanViewfinder } from "./scan-viewfinder";
import { useScan } from "./use-scan";
import type { CameraState } from "./use-viewfinder";

const hidden = { className: "sr-only", tabIndex: -1, "aria-hidden": true, type: "file", accept: "image/*" } as const;

type CameraProblem = Exclude<CameraState, "starting" | "live">;

/** The scan of a ball box label: the live camera, one photo, a batch of photos, or typed details. */
export function ScanFlow({ locations, defaultLocationId }: { locations: Location[]; defaultLocationId: string }) {
  const scan = useScan({ locations, defaultLocationId });
  const camera = useRef<HTMLInputElement>(null);
  const batchCamera = useRef<HTMLInputElement>(null);
  const batchLibrary = useRef<HTMLInputElement>(null);
  // The scan opens the live camera at once. Staff can close it, and the photo button stays.
  const [live, setLive] = useState(true);
  const [batchLive, setBatchLive] = useState(true);
  // When the live camera cannot run, the scan uses the phone camera app, as before.
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const onUnavailable = useCallback((state: CameraProblem) => {
    setProblem(state);
    setLive(false);
    setBatchLive(false);
  }, []);

  const openLive = (mode: "single" | "batch") => {
    // A refused or missing camera stays off. A camera that failed once can try again.
    if (problem && problem !== "failed") (mode === "single" ? camera : batchCamera).current?.click();
    else {
      setProblem(null);
      (mode === "single" ? setLive : setBatchLive)(true);
    }
  };

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

      {scan.step === "start" && live && !problem && (
        <ScanViewfinder
          mode="single"
          saved={scan.saved}
          // The box of the ball that was just saved is often still in front of the camera.
          skipSerials={scan.saved ? [scan.saved.serial] : []}
          onCapture={(file) => void scan.onPhoto(file)}
          onClose={() => setLive(false)}
          onTakePhoto={() => camera.current?.click()}
          onUnavailable={onUnavailable}
        />
      )}
      {scan.step === "batch" && batchLive && !problem && (
        <ScanViewfinder
          mode="batch"
          added={scan.batch.length}
          skipSerials={scan.batch.flatMap((item) => (item.fields.serial ? [item.fields.serial] : []))}
          onCapture={(file, codes) => scan.addPhotos([file], [codes])}
          onClose={() => setBatchLive(false)}
          onTakePhoto={() => batchCamera.current?.click()}
          onUnavailable={onUnavailable}
        />
      )}

      {scan.step === "start" && (
        <ScanStart
          saved={scan.saved}
          batchAdded={scan.batchAdded}
          cameraProblem={problem}
          onTakePhoto={() => openLive("single")}
          onType={scan.typeDetails}
          onBatch={() => {
            setBatchLive(true);
            scan.startBatch();
          }}
        />
      )}
      {scan.step === "reading" && <ScanReading preview={scan.preview} />}
      {scan.step === "batch" && (
        <ScanBatch
          batch={scan.batch}
          message={scan.message}
          saving={scan.saving}
          locationSelect={locationSelect}
          onCamera={() => openLive("batch")}
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
          onRetake={() => {
            // A new photo starts again from the camera.
            scan.cancel();
            openLive("single");
          }}
          onCancel={scan.fromBatch ? scan.backToBatch : scan.cancel}
        />
      )}
    </>
  );
}
