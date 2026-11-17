import { describe, expect, it } from "vitest";
import { CAMERA_CONSTRAINTS, cameraProblem, frameSize } from "./camera";

describe("cameraProblem", () => {
  it("reads a refused permission as denied", () => {
    expect(cameraProblem(new DOMException("no", "NotAllowedError"))).toBe("denied");
    expect(cameraProblem(new DOMException("no", "SecurityError"))).toBe("denied");
  });

  it("reads a missing or busy camera as failed", () => {
    expect(cameraProblem(new DOMException("none", "NotFoundError"))).toBe("failed");
    expect(cameraProblem(new DOMException("busy", "NotReadableError"))).toBe("failed");
    expect(cameraProblem(new Error("other"))).toBe("failed");
  });
});

describe("frameSize", () => {
  it("keeps a 1440p frame, so the serial barcode keeps its pixels", () => {
    expect(frameSize(1440, 2560)).toEqual({ width: 1440, height: 2560 });
    expect(frameSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
  });

  it("makes a larger frame 2560 px on the long side", () => {
    expect(frameSize(2160, 3840)).toEqual({ width: 1440, height: 2560 });
  });
});

describe("CAMERA_CONSTRAINTS", () => {
  it("asks for a 1440p stream, not 4K", () => {
    expect(CAMERA_CONSTRAINTS.video).toMatchObject({ width: { ideal: 2560 }, height: { ideal: 1440 } });
  });
});
