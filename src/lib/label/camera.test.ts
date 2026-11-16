import { describe, expect, it } from "vitest";
import { cameraProblem, frameSize } from "./camera";

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
  it("keeps a frame of 1920 px or less", () => {
    expect(frameSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
  });

  it("makes a larger frame 1920 px on the long side", () => {
    expect(frameSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });
});
