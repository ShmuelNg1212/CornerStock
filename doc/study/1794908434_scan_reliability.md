# Study: scan reliability

Date: 2026-11-17. Topic: the live scan sometimes does not capture a label.

## Question

Why does the live viewfinder sometimes fail to capture a label? Which changes make the capture reliable?

## Sources

- Code: `src/lib/label/camera.ts`, `barcodes.ts`, `frame-quality.ts`, `frame-read.ts`, `frame-worker.ts`, and `src/app/(app)/scan/use-viewfinder.ts`.
- The earlier plan: [../plan/1794837817_live_viewfinder.md](../plan/1794837817_live_viewfinder.md). Its task 8 (real phone check) is still open.
- A measurement on the 10 label fixtures (`src/lib/label/__fixtures__/`). The script ran on a Mac in Node with the same `zxing-wasm` build. Phone times are slower, but the ratios hold.

## How the capture works now

1. The camera asks for 1920 × 1080 (an "ideal" value; the browser can give less).
2. Each frame is scaled to 1920 px on the long side, then read in a Web Worker. The gap between frames is 200 ms, and the next frame waits for the last read.
3. The reader looks for all barcode formats, with `tryHarder`, `tryRotate`, and `tryDownscale`.
4. A capture needs two frames in a row. Each of the two frames must read both the UPC and the serial number. The last frame must also have a sharpness of 800 or more.

## Measurement

Per fixture: the codes found (U = UPC, S = serial, P = product code) and the read time.

| Case | Codes found (10 photos) | Read time |
|---|---|---|
| As now: 1920 px, all formats | Same as the regression test | 36 to 48 ms |
| Only UPC-A, EAN-13, Code 39 | Same codes on all 10 photos | 9 ms |
| Only 3 formats, no `tryHarder` | Serial lost on 8 photos | 3 to 4 ms |
| 1280 px | Serial lost on all photos that had it | 20 to 27 ms |
| JPEG quality 50 | Same codes | 37 to 51 ms |
| Blur (sigma 1) | Product code lost on 2 photos; serial kept | 33 to 43 ms |
| Label 30% smaller in the same frame | Serial lost on 6 of 7 photos that had it | 31 to 39 ms |

Bar unit of the serial barcode (the "module size") at 1920 px: 1.77 to 2.95 px. The serial fails at about 1.5 px.

## Findings

1. **The serial barcode is at the limit of the resolution.** It is the thinnest barcode on the label. It reads only when the label fills most of the frame. A label 30% smaller in the frame loses the serial on almost every photo.
2. **The live frames have fewer pixels than the fixtures.** The fixtures are 1440 px wide in portrait. A 1920 × 1080 video in portrait is only 1080 px wide. The barcodes run across the width. The serial thus gets about 25% fewer pixels than in the tests, which is near the 1.5 px failure point. The tests pass, but the phone fails. This is the most probable main cause.
3. **The real stream size is unknown.** The browser can give less than 1920 × 1080. The code does not check or show the real size. A 1280 × 720 stream (720 px wide in portrait) cannot read the serial at a normal distance.
4. **The reader does unnecessary work.** A restriction to the 3 formats on the labels gives the same codes 4 times faster. A faster read gives more frames each second, and less movement between frames.
5. **The capture rule is strict.** Each of two frames in a row must read both codes. If one frame reads both codes with a probability p, the capture needs about p². With a marginal serial, p is low, so p² is much lower. The reads are exact (a barcode reads correctly or fails), so the rule can combine reads from nearby frames.
6. **The sharpness gate can block a good read.** When both codes read, the frame is sharp enough for the barcodes. But a capture also needs a sharpness of 800 or more. The limit comes from still photos. A label that fills less of the frame, or a compressed video frame, gives a lower value. The probe with the smaller label gave 1122 to 2746. A live frame can be lower.
7. **Focus and the lens are not controlled.** Continuous focus is set only where the browser allows it. The browser selects the rear lens. A phone with a long minimum focus distance cannot get close enough to make the serial large.

## Options

| Option | Effect | Cost |
|---|---|---|
| A. Diagnostic overlay (`?debug=1`) | Shows the real stream size, the read time, the sharpness, the module size, and the codes found in each frame. Gives facts from the real phone. | Small |
| B. Read only the 3 label formats | 4 times faster reads, same codes | Very small |
| C. Ask for a larger stream (ideal 3840 × 2160) and read a centre crop at full resolution, not a scaled-down full frame | More pixels on the serial barcode. The label can be farther from the camera. | Medium; needs a cap on the crop size to keep reads fast |
| D. Combine reads across frames | The serial and the UPC can read in different frames. Capture when the same serial reads 2 times and the UPC reads 1 time in a short window, with no different value in that window. | Small; pure function with tests |
| E. No sharpness gate when both codes read | Removes a block on good reads | Very small |
| F. Camera zoom where the browser allows it | More pixels without a closer distance | Unknown support on iPhone Safari; needs research on the phone |

## Recommendation

Do A to E in one plan. Keep F out until the overlay shows the real phone values. Then decide the thresholds from the real values, not from the fixtures.
