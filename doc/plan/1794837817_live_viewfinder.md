# Plan: live viewfinder and glare hint

Study: [../study/1794837817_live_viewfinder_and_ocr.md](../study/1794837817_live_viewfinder_and_ocr.md)

Mode: mixed. Technical part first, then the design pass, then rendezvous.
Skills: `tdd` (tasks 1–3), impeccable `shape` before task 5, `mobile-native` (task 5), `code-review` and impeccable `critique` / `audit` / `polish` (rendezvous), `break-ui` is not needed (no new lists or user data).

Out of scope: text reading (OCR) and the Claude API.

## OPEN QUESTIONS

1. **Default.** Should the scan open the live viewfinder at once, or should the viewfinder be a second button beside "Take a photo"? Recommendation: open the viewfinder at once and keep "Take a photo instead" as a link.
2. **Batch.** Should the batch scan also use the live viewfinder, with the camera open and one item added for each new serial? Recommendation: yes (task 6). It removes one tap for each box.
3. **Manual shutter.** Should the viewfinder also have a shutter button for a label that does not auto-capture? Recommendation: yes. It captures the current frame and uses the normal read.
4. **Real frames.** Can you give 5 to 10 photos of real ball boxes under the shop lights, some with glare? They set the glare and sharpness limits. Without them, the limits come from the sample photo only.

## Tasks

- [ ] **1. Frame checks (pure functions).** `tests: first`
  - Add `src/lib/label/frame-quality.ts`: `sharpness(gray)` (variance of the Laplacian), `glare(gray)` (fraction of near-white pixels and largest bright patch), and `captureDecision(history)` that returns `capture`, `glare`, `soft`, or `wait`.
  - Keep all limits in one exported constant.
  - Acceptance: unit tests on synthetic image data show: a flat image is soft; an image with a white patch above the limit is glare; a sharp image with 2 matching serial reads gives `capture`; one serial read gives `wait`.
  - Done when: `npm test` passes with the new tests.

- [ ] **2. Frame reader in a Web Worker.** `tests: first`
  - Add a worker that takes an `ImageBitmap`, runs `zxing-wasm` with the existing `READER_OPTIONS`, runs the frame checks on a centre crop, and returns the barcodes and the scores.
  - Reuse `classifyBarcodes`. The worker serves the same `/zxing_reader.wasm` file.
  - Acceptance: a test runs the worker logic on the sample label image and gets the UPC `887970617601` and the serial `23VSLE30B047`.
  - Done when: the test passes and `npm run build` includes the worker.

- [ ] **3. Viewfinder hook.** `tests: first` for the state rules, `tests: alongside` for the camera.
  - Add `useViewfinder`: open the rear camera (ideal 1920×1080 or more), send about 5 frames each second to the worker, keep the last results, and call `onCapture(blob)` on a `capture` decision.
  - Stop all tracks on close, on unmount, and when the page is hidden. Restart when the page shows again.
  - Report `unsupported`, `denied`, and `failed` states.
  - Acceptance: the state rules have unit tests. The browser probe in task 7 shows that the camera light goes off after the viewfinder closes (the track state is `ended`).
  - Done when: tests pass.

- [ ] **4. Wire the capture into the scan.** `tests: alongside`
  - The captured frame goes to the existing `onPhoto`. The confirm screen, the upload, and the save do not change.
  - The current file input stays as the fallback for `unsupported`, `denied`, and `failed`, and for "Take a photo instead".
  - Acceptance: with the fake camera (task 7), the scan reaches the confirm screen with the UPC and the serial filled, and no tap on a shutter.
  - Done when: the probe passes.

- [ ] **5. Viewfinder screen.** `tests: alongside`. Design pass with impeccable and `mobile-native`.
  - Full-height camera view on phones, with the corner frame of the brand mark as the aim guide.
  - A status line: "Point at the label", "Hold still", "Glare on the label. Tilt the box or move away from the light.", "Hold the phone still, a little farther away."
  - Corners change color when the barcodes read. Text and icon show each state, not color alone.
  - Shutter button (if question 3 is yes), torch button only when the track supports it, close button.
  - Under reduced motion, nothing moves.
  - Safe-area insets, no page zoom, no pull-to-refresh on the view.
  - Acceptance: screenshots at 390×844 and 1280×800 show no overflow. The glare text shows on a glare frame in the probe.
  - Done when: the design pass is recorded in this plan.

- [ ] **6. Batch with the viewfinder** (only if question 2 is yes). `tests: alongside`
  - The camera stays open. Each capture with a serial that is new in this batch adds one item through `addPhotos`. The same serial again does not add an item.
  - A count shows the balls added. "Done" closes the camera and shows the batch list.
  - Acceptance: in the probe, the fake camera shows the same label for 5 seconds and the batch has 1 item, not many.
  - Done when: the probe passes.

- [ ] **7. Browser probe with a fake camera.** `tests: alongside`
  - Make a Y4M video from the sample label with `ffmpeg`. Also make a glare version (a white patch over the label).
  - Run Chromium with `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<file>` against the dev server, signed in.
  - Checks: auto-capture reaches the confirm screen; the glare video shows the glare hint and does not capture; a refused permission shows the photo button.
  - Done when: all checks pass, and the results are recorded here.

- [ ] **8. Real phone check.** Human step.
  - Open the preview on an iPhone (home-screen app and Safari) and an Android phone. Scan 3 real boxes.
  - Acceptance: each box captures without a tap, or the hint says why not.
  - Done when: the human reports the result.

## Rendezvous checks

To be recorded after execute.

## Sync docs

- `doc/wiki/spec.md`: replace the scan line under "Built" with the viewfinder behaviour and the fallback.
