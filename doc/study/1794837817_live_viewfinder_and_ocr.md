# Live viewfinder, glare hint, and free text reading

## Human direction (2026-11-16)

- Do not use the Claude API yet. It costs money for each scan.
- Build a live viewfinder that captures the label when it is ready.
- Build a glare hint.
- List free, open-source ways to read the label text that can run in the production build.

## Current state

- The scan opens the phone camera app through a file input (`capture="environment"`). Staff take a photo, then the app reads it. See `src/app/(app)/scan/scan-flow.tsx`.
- `src/lib/label/read-photo.ts` reads the barcodes with `zxing-wasm` in the browser. It scales the photo to a maximum of 3200 px.
- A bad photo shows only after the read. Staff then take the photo again. This is the main delay in the scan.
- Barcodes give the UPC, the serial number, and the product code. The printed text (gross weight, top weight, pin distance, boxed date, and model details for a new UPC) is typed by staff.

## Findings: live viewfinder

- `navigator.mediaDevices.getUserMedia` gives a live camera stream in the page. It needs a secure context (HTTPS or localhost). Production is HTTPS.
- The same `zxing-wasm` reader can read frames of the stream. A frame read must not block the page. Run it in a Web Worker and read about 4 to 6 frames each second.
- The app can then capture the frame automatically when all of these are true:
  - The UPC and the serial barcode both read.
  - The same serial reads in 2 frames in a row (the label is still).
  - The frame is sharp (a sharpness score above a limit).
  - The glare check passes.
- The captured frame goes into the existing flow (`onPhoto` / `addPhotos`). The confirm screen, the upload, and the save do not change.
- A frame has the resolution of the stream, not of a full photo. Ask for a high resolution (ideal 1920×1080 or more). A test with the sample label must show that all three barcodes read at the stream resolution.
- Batch scan fits the viewfinder well: the camera stays open, and each new serial adds one item. No tap is needed for each box.
- A fallback is necessary. When the camera permission is refused, when `getUserMedia` is missing, or when the stream fails, the current photo button stays available.
- The camera must stop when the viewfinder closes, when the page is hidden, and when the user leaves the scan. An open camera uses the battery and keeps the camera light on.
- Torch: some Android browsers let a page turn on the torch (`torch` capability of the track). iOS Safari does not. Show the torch button only when the capability exists.
- Under the reduced-motion setting, the viewfinder shows its state with text and icons only. Nothing moves.

## Findings: glare hint

- Without a text reader, the glare check uses the pixels of the frame. It does not need AI.
- Glare is a patch of blown-out pixels. Measure the fraction of pixels with a brightness near the maximum (for example 250 of 255) in the label area. Also measure the size of the largest bright patch.
- The hint shows when the glare fraction stays above a limit for about 1 second, and the barcodes do not all read.
- Hint text: "Glare on the label. Tilt the box or move away from the light."
- A second hint covers a dark or soft frame: "Hold the phone still, a little farther away." This uses the sharpness score.
- The limits need real frames. Use the sample photo and a few photos of real boxes under the shop lights. The plan keeps the limits in one file, so a change is one edit.

## Free, open-source text reading (OCR)

None of these is in this plan. They are the options for a later study.

| Option | Licence | Where it runs | Quality on a box label | Cost to the app |
|---|---|---|---|---|
| Tesseract.js | Apache-2.0 | Browser (WASM) and Node | Fair on a clean, flat crop. Weak on glossy, small, or tilted text. | Language data of a few MB, loaded one time and cached |
| PaddleOCR (PP-OCR mobile models) through `onnxruntime-web` | Apache-2.0 | Browser (WASM or WebGPU) | Better than Tesseract on phone photos | Models of about 10 to 20 MB, loaded one time and cached |
| Transformers.js with a document model (for example Florence-2, TrOCR) | MIT / Apache-2.0 models | Browser | Good, and can find fields | Models of hundreds of MB. Too slow on most phones |
| A text reader on a server (Tesseract or PaddleOCR in a container) | Free software | Needs a server of its own | Same as the browser versions | Hosting cost. Vercel functions are a poor fit: size limits and slow cold starts |
| `TextDetector` (Shape Detection API) | Browser built-in | Chrome behind a flag only | Unknown | Not usable in production |

Recommendation for the later study: PaddleOCR in the browser, or Tesseract.js as the smaller start. Both run on the device. Neither costs money for each scan. Both work in the production build, because they are static files that the app serves.

OCR gives lines of text, not fields. The "intelligence" is a parser: it finds anchor words ("Top Weight", "Pin", "Boxed") and reads the value next to each one. Then the existing `validateLabel` rules check each value. The parser needs a label sample from each maker that the shop stocks. The project has one sample (Storm). This is the main risk of OCR, more than the choice of engine.

The live viewfinder also helps a later OCR step: a sharp frame with no glare is the best input for any text reader.

## Open questions

See the plan.
