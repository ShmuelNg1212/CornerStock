// The Web Worker of the live viewfinder. It reads one frame at a time, off the main thread,
// so the camera view and the taps stay smooth.
import { prepareZXingModule } from "zxing-wasm/reader";
import { analyzeFrame, type FrameAnalysis } from "./frame-read";

export type FrameRequest = { id: number; data: Uint8ClampedArray; width: number; height: number };
export type FrameReply = { id: number; result: FrameAnalysis } | { id: number; error: string };

// The app serves its own copy of the reader, so a scan does not depend on a CDN.
prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path) },
});

self.onmessage = async (event: MessageEvent<FrameRequest>) => {
  const { id, data, width, height } = event.data;
  let reply: FrameReply;
  try {
    reply = { id, result: await analyzeFrame({ data, width, height }) };
  } catch (error) {
    reply = { id, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
