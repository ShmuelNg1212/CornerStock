# Plan: scan reliability

Study: [../study/1794908434_scan_reliability.md](../study/1794908434_scan_reliability.md). Branch: `fix/scan-reliability`.

Mode: technical. Skills: `tdd` (tasks 2 to 4), `diagnosing-bugs` (when a fixture test fails), `mobile-native` (task 1 overlay on the phone). Rendezvous: `code-review`, `simplify`. No design pass: the overlay is a staff diagnostic tool, not a product screen.

## Answers from the human (2026-11-17)

1. Phones: 4K cameras are not readily available. Do not ask for a 4K stream. The study option C is removed.
2. Failure: the time to capture is not consistent. The staff must adjust the phone for a long time before it captures. This matches study findings 4, 5, and 6 (slow reads, a strict two-frame rule, the sharpness gate).
3. Release: one release with all tasks.

## Goal

The live scan captures a normal ball box label in 2 seconds or less, held at a comfortable distance, on the staff phone.

## Out of scope

- A 4K stream and a full-resolution crop (study option C). The human rejected 4K. At 1920 × 1080 the reader already gets the full resolution, so a crop gives no more pixels.
- Camera zoom (option F of the study). Decide after the overlay shows the real phone values.
- New hints or a new viewfinder design.
- Changes to the confirm screen, the save, or the batch list.

## Tasks

- [x] **1. Diagnostic overlay.** `tests: alongside`
  - On `/scan` and the batch scan, `?debug=1` shows a small panel on the camera view.
  - The panel shows: the real stream size (from the track settings), the frame size sent to the reader, the read time (last and average), the frames each second, the sharpness, the module size, which codes read (U, S, P) in the last frame and in the capture window, and the current hint.
  - No value leaves the device. Without `?debug=1`, nothing changes.
  - Acceptance: the browser probe with the fake camera shows the panel with `?debug=1`, and no panel without it. The stream size in the panel is the size of the fake video.
  - Done when: the probe passes.

- [x] **2. Read only the label formats.** `tests: first`
  - Add `formats: ["UPC-A", "EAN-13", "Code39"]` to the reader options of the live frame read and the photo read.
  - Acceptance: the fixture regression test (`frame-read.test.ts`) passes with no change to its expected codes. A new test shows that the reader options name only these 3 formats.
  - Done when: `npm test` passes.

- [x] **3. Combine reads across frames.** `tests: first`
  - Change `decideFrame`: capture when, inside a window of 1.5 s, the same serial reads in 2 or more frames and the same UPC reads in 1 or more frames.
  - Do not capture when a frame in the window reads a different serial or a different UPC. Wait until the window holds only one value of each.
  - Keep the skip rule for serials already saved or in the batch.
  - The captured photo is the latest frame that read the serial.
  - Acceptance: unit tests show: serial in frames 1 and 3 and UPC in frame 2 captures; serial in only 1 frame does not capture; two different serials in the window do not capture; a skipped serial does not capture; frames older than the window do not count.
  - Done when: `npm test` passes.

- [x] **4. No sharpness gate on a complete read.** `tests: first`
  - When the window gives a capture by task 3, do not also need a sharpness of 800. Keep the sharpness value for the "soft" hint when no code reads.
  - Acceptance: a unit test shows that a complete read with a sharpness of 300 captures. The existing test for the "soft" hint with no code still passes.
  - Done when: `npm test` passes.

- [x] **5. Fake camera probe.** `tests: alongside`
  - Run the scan with the fake camera (a video of a fixture label at 1080 × 1920) on `/preview/scan`.
  - Acceptance: the scan reaches the confirm screen with the UPC and the serial filled, with no tap. The same label held for 5 seconds in the batch gives 1 item, not many.
  - Done when: both checks pass, and the time to capture shows in the overlay and is recorded here.

- [x] **6. A 1440p stream.** `tests: first`. Added on 2026-11-17 with the approval of the human.
  - Ask for an ideal stream of 2560 × 1440. A phone that cannot give it falls back to a smaller stream.
  - Raise the reader frame size to 2560 px on the long side, so the larger stream is not scaled down.
  - The stream is not stored. The label photo is still shrunk to 1800 px before the upload.
  - Acceptance: a unit test shows that a 1440 × 2560 frame keeps its size, and a 2160 × 3840 frame becomes 1440 × 2560. A fixture test shows that the serial of photo 2 at the photo framing reads at 1440 px wide and not at 1080 px wide. A probe with a 1440 × 2560 video at the photo framing captures.
  - Done when: `npm test` passes and the probe captures.

- [x] **7. "Move closer" before "glare".** `tests: first`. Added on 2026-11-17 with the approval of the human.
  - When the barcodes that read are too small, the hint is "far", also when a white patch shows glare.
  - Acceptance: a unit test with a partial read, a module size of 1.5 px, and a glare patch gives "far". The glare tests of photos 4, 5, and 8 still pass.
  - Done when: `npm test` passes.

- Not done: a new shape of the aim frame (study option, rendezvous of 2026-11-17). The human wants the aim frame to show the full label, for a later vision model.

- [ ] **8. Real phone check.** Human step, after the release.
  - Open `/scan?debug=1` on the staff phone. Scan 10 different boxes.
  - Record for each box: captured (yes or no), the time to capture, and the stream size and module size from the panel.
  - Acceptance: 9 of 10 boxes capture in 2 seconds or less, with little adjustment of the phone.
  - Done when: the results are recorded here. If the result is less, the panel values decide the next step (for example zoom, or a new crop cap).

## Deviations from the plan

- Task 2: the formats are UPC-A, EAN-13, Code 39, and Code 128. Code 128 stays for labels of other brands. It costs almost nothing: 9.7 ms against 9.4 ms on the fixtures, with the same codes.
- Task 3: a UPC from any frame is not safe. A fast move from box A to box B can join the UPC of A with the serial of B. In a batch, that ball saves with one tap. The rule is thus: one frame reads the UPC and the serial together, and one more frame reads the same serial.
- Task 3: the single scan and the batch read the captured photo again, and used only that read. The captured frame can miss the UPC that an earlier frame read. `mergeLabelCodes` now keeps the live codes, and the photo read fills the gaps.

## Execute checks (2026-11-17)

- `npm run typecheck` and `npx eslint .` pass. 244 unit tests pass.
- Fixtures at the short side of a portrait video (1080 px): the serial reads on 1 of 7 photos that give it at 1440 px. The label framing of the photos is too far for a 1080 px stream.
- Fake camera probe, Chrome, 390 × 844, `/preview/scan?step=viewfinder&debug=1`:
  - Label that fills the width: capture in 0.5 to 0.7 s from the page load, 0.2 s after the first code. Confirm screen: serial `26GRNE12A043`, UPC `887970778029`. 3 runs of 3.
  - Same label in the batch for 8 s: 1 item.
  - Label at the photo framing, 1080 px wide stream (before task 6): no capture in 12 s. Module size 1.53 px, only the UPC reads. Before task 7 the hint was "glare". After task 7 it is "far".
  - Label at the photo framing, 1440 px wide stream (task 6): capture in 0.7 s from the page load, 0.2 s after the first code. Module size 1.95 px. 4 runs of 4. Batch for 8 s: 1 item.
  - The panel shows with `?debug=1` and does not show without it.

## Rendezvous checks (2026-11-17)

- `npm test`: 248 unit tests and 58 database tests pass. `npm run typecheck`, `npx eslint .`, and `npm run build` pass.
- Standards review (read-only agent): no violation, no correctness bug. Fixed: the duplicate empty-codes constant (now `NO_CODES` in `barcodes.ts`), a shadowed name in the hook, a long comment line. The diagnostic counters now run only with `?debug=1`.
- Spec review (read-only agent): fixed: the shutter with a failed photo read showed "No barcode was found" and not "The photo could not be read". `mergeLabelCodes` now gives the photo read when the live camera read no code. Test added first. Fixed: the panel now shows the codes of the capture window (row "window"). Kept: "added" now also shows on a frame that reads only a saved serial.
- Probe after the fixes: the panel shows the "window" row. The 1440 px stream captures; the 1080 px stream at the photo framing shows "far".

## Completion

All tasks ticked. `npm test`, `npm run typecheck`, `npx eslint .`, and `npm run build` pass. The wiki section on the scan states the new capture rule.
