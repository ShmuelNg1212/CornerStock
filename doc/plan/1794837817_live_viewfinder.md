# Plan: live viewfinder and glare hint

Study: [../study/1794837817_live_viewfinder_and_ocr.md](../study/1794837817_live_viewfinder_and_ocr.md)

Mode: mixed. Technical part first, then the design pass, then rendezvous.
Skills: `tdd` (tasks 1–3), impeccable `shape` before task 5, `mobile-native` (task 5), `code-review` and impeccable `critique` / `audit` / `polish` (rendezvous), `break-ui` is not needed (no new lists or user data).

Out of scope: text reading (OCR) and the Claude API.

## Decisions (human, 2026-11-16)

1. The scan opens the live viewfinder at once. "Take a photo instead" stays as a link.
2. The batch scan also uses the live viewfinder (task 6).
3. The viewfinder has a manual shutter button.
4. The human gave 10 label photos. The human found that the camera flash makes the barcodes easier to read. The viewfinder gets a torch button (task 5).

## Findings from the 10 label photos

Brands: Storm (1), 900 Global (6), Roto Grip (3). All three use the same label layout.

Barcode read with the current reader options, at three image sizes (long side):

| Photo | Full size | 1920 px | 1280 px | Cause of a miss |
|---|---|---|---|---|
| 1 Storm Solid Lock | serial, UPC | serial, UPC | UPC | product code too small |
| 2 Vengeance 14 | all 3 | all 3 | all 3 | |
| 3 Vengeance 13 | all 3 | all 3 | UPC | |
| 4 Vengeance 14 | serial, product | serial, product | serial, product | glare on the UPC |
| 5 Vengeance 13 | serial, product | serial, product | none | glare on the UPC |
| 6 Viking | UPC | UPC | UPC | label tilted and soft |
| 7 Attention Sign | none | none | none | label at about 60°, not a 90° step |
| 8 Attention Sign | UPC, product | UPC, product | UPC, product | glare on the serial barcode, label upside down |
| 9 Attention Sign | all 3 | serial, UPC | serial, UPC | |
| 10 Attention Sign | all 3 | all 3 | UPC | |

- A 1920 px frame reads the same codes as the full photo. A 1280 px frame loses codes. The stream must be 1920 px or more on the long side.
- 5 of 10 photos give both the UPC and the serial. Each miss has a cause that a live hint can fix: glare (4, 5, 8), a label at an angle (7), or a tilted, soft label (6).
- The flash helps contrast, but it also makes the glare in photos 4, 5, and 8. The glare hint must also say "Turn off the torch" when the torch is on.
- The reader rotates only in 90° steps. A label at an angle needs a hint: "Line the phone up with the label."

## Torch (flash) in the viewfinder

- A live stream cannot fire a flash. It can keep the light on (torch) with `track.applyConstraints({ advanced: [{ torch: true }] })`.
- Chrome on Android supports this. Support on iPhone depends on the iOS version. The app checks `track.getCapabilities().torch` and shows the button only when it works. Task 8 checks the human's iPhone.
- The torch turns off when the viewfinder closes.

## Tasks

- [x] **1. Frame checks (pure functions).** `tests: first`
  - Add `src/lib/label/frame-quality.ts`: `sharpness(gray)` (variance of the Laplacian), `glare(gray)` (fraction of near-white pixels and largest bright patch), and `captureDecision(history)` that returns `capture`, `glare`, `soft`, or `wait`.
  - Keep all limits in one exported constant.
  - Acceptance: unit tests on synthetic image data show: a flat image is soft; an image with a white patch above the limit is glare; a sharp image with 2 matching serial reads gives `capture`; one serial read gives `wait`.
  - Done when: `npm test` passes with the new tests.

- [x] **2. Frame reader in a Web Worker.** `tests: first`
  - Add a worker that takes an `ImageBitmap`, runs `zxing-wasm` with the existing `READER_OPTIONS`, runs the frame checks on a centre crop, and returns the barcodes and the scores.
  - Reuse `classifyBarcodes`. The worker serves the same `/zxing_reader.wasm` file.
  - Add the 10 label photos as test fixtures in `src/lib/label/__fixtures__/`, scaled to 1920 px on the long side (JPEG, quality 80).
  - Acceptance: a test runs the worker logic on each fixture and gets at least the codes in the 1920 px column of the findings table. Photo 1 gives the UPC `887970617601` and the serial `23VSLE30B047`.
  - Acceptance: the frame checks report glare on photos 4, 5, and 8, and no glare on photos 2, 3, and 10.
  - Done when: the test passes and `npm run build` includes the worker.

- [x] **3. Viewfinder hook.** `tests: first` for the state rules, `tests: alongside` for the camera.
  - Add `useViewfinder`: open the rear camera (ideal 1920×1080 or more), send about 5 frames each second to the worker, keep the last results, and call `onCapture(blob)` on a `capture` decision.
  - Stop all tracks on close, on unmount, and when the page is hidden. Restart when the page shows again.
  - Report `unsupported`, `denied`, and `failed` states.
  - Acceptance: the state rules have unit tests. The browser probe in task 7 shows that the camera light goes off after the viewfinder closes (the track state is `ended`).
  - Done when: tests pass.

- [x] **4. Wire the capture into the scan.** `tests: alongside`
  - The captured frame goes to the existing `onPhoto`. The confirm screen, the upload, and the save do not change.
  - The current file input stays as the fallback for `unsupported`, `denied`, and `failed`, and for "Take a photo instead".
  - Acceptance: with the fake camera (task 7), the scan reaches the confirm screen with the UPC and the serial filled, and no tap on a shutter.
  - Done when: the probe passes.

- [x] **5. Viewfinder screen.** `tests: alongside`. Design pass with impeccable and `mobile-native`.
  - Full-height camera view on phones, with the corner frame of the brand mark as the aim guide.
  - A status line: "Point at the label", "Hold still", "Glare on the label. Tilt the box or move away from the light.", "Hold the phone still, a little farther away.", and, after 4 seconds with no barcode, "Line the phone up with the label."
  - When the torch is on and the glare check fails, the glare hint says "Glare on the label. Turn off the torch or tilt the box."
  - Corners change color when the barcodes read. Text and icon show each state, not color alone.
  - Shutter button, torch button only when the track supports it, close button.
  - Under reduced motion, nothing moves.
  - Safe-area insets, no page zoom, no pull-to-refresh on the view.
  - Acceptance: screenshots at 390×844 and 1280×800 show no overflow. The glare text shows on a glare frame in the probe.
  - Done when: the design pass is recorded in this plan.

- [x] **6. Batch with the viewfinder.** `tests: alongside`
  - The camera stays open. Each capture with a serial that is new in this batch adds one item through `addPhotos`. The same serial again does not add an item.
  - A count shows the balls added. "Done" closes the camera and shows the batch list.
  - Acceptance: in the probe, the fake camera shows the same label for 5 seconds and the batch has 1 item, not many.
  - Done when: the probe passes.

- [x] **7. Browser probe with a fake camera.** `tests: alongside`
  - Make a Y4M video from the sample label with `ffmpeg`. Also make a glare version (a white patch over the label).
  - Run Chromium with `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<file>` against the dev server, signed in.
  - Checks: auto-capture reaches the confirm screen; the glare video shows the glare hint and does not capture; a refused permission shows the photo button.
  - Done when: all checks pass, and the results are recorded here.

- [ ] **8. Real phone check.** Human step.
  - Open the preview on an iPhone (home-screen app and Safari) and an Android phone. Scan 3 real boxes, including one with glare and one at an angle.
  - Check if the torch button shows on the iPhone.
  - Acceptance: each box captures without a tap, or the hint says why not.
  - Done when: the human reports the result.

## Deviations from the plan

- Glare: the blown-out patch check does not see the glare on the photos. Glossy ink reflects, and the bars go silver, not white. The glare rule is therefore: a sharp frame where a barcode reads but a neighbour does not. The patch check stays for real white reflections.
- New hint "far" ("Move closer, so the label fills the frame."). A partial read with a bar unit under 1.8 px is distance, not glare. The fake camera showed this case.
- Fix in `classifyBarcodes`: on photo 8 (upside down) the product code was taken as the serial. The order now follows the barcode orientation. A single code below the UPC that starts with a letter is the product code.
- The probe ran on `/preview/scan` (development only), not on the signed-in `/scan`. The agent has no staff account and did not make one in the production database. Task 8 covers the signed-in path.
- A label at an angle with one code read shows the glare hint, not the "line up" hint. The advice ("tilt the box") still helps. Kept.
- The design detector flags the aim-frame corner brackets as side-tab borders. They are the Cornerstock corner mark. Ignore added for this file only (`.impeccable/config.json`).

## Rendezvous checks (2026-11-16)

- `npm test`: 113 unit tests and 31 database tests pass. `npm run typecheck`, `npx eslint .`, `npm run build` pass.
- Production bundle: the hook constructs the bundled `turbopack-worker` entry with the reader chunks.
- Code review (read-only agent): 1 high, 3 medium, 4 low findings. Fixed: repeat capture of the saved ball (high); batch duplicates after a reopen, worker crash with no message, leaked stream on a second start (medium); a failed camera locked off, play failure, stop during start (low). A complete but soft frame now shows the soft hint. Kept: glare hint on a partly visible label.
- Browser probe, Chromium with a fake camera made from the fixtures:
  - Clean label (photo 2, full scale): captures with no tap; confirm screen shows serial `26GRNE12A043` and the UPC.
  - Glare label (photo 4): "Hold still", then the glare hint; no capture.
  - Batch, same label for 9 s: 1 item.
  - Close: the track goes from `live` to `ended`; page scroll returns.
  - Refused permission (full Chromium): state `denied`, the photo button shows.
- Screens checked at 390×844 and 1280×800. The controls moved to solid navy bars after the first look, because the shutter and the link were not legible over a white label.
- Not checked: the signed-in `/scan`, iPhone Safari, the torch on a real phone. These are task 8.

## Sync docs

- `doc/wiki/spec.md`: replace the scan line under "Built" with the viewfinder behaviour and the fallback.
