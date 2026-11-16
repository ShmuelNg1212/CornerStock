import { describe, expect, it } from "vitest";
import { signConfirmation, verifyConfirmation } from "./confirmation";

const payload = { kind: "catalog" as const, reason: "", models: [], balls: [] };
const secret = "test-server-secret";
describe("review confirmation", () => {
  it("binds the approved payload to its owner and request", () => {
    const confirmation = signConfirmation(payload, "owner-a", secret, 1000);
    expect(verifyConfirmation(confirmation, "owner-a", secret, 2000)).toEqual(
      payload,
    );
    expect(() =>
      verifyConfirmation(confirmation, "owner-b", secret, 2000),
    ).toThrow();
    expect(() =>
      verifyConfirmation(
        { ...confirmation, payload: { ...payload, reason: "changed" } },
        "owner-a",
        secret,
        2000,
      ),
    ).toThrow();
    expect(() =>
      verifyConfirmation(
        { ...confirmation, requestId: crypto.randomUUID() },
        "owner-a",
        secret,
        2000,
      ),
    ).toThrow();
  });
  it("requires a new review after expiry", () => {
    const confirmation = signConfirmation(payload, "owner-a", secret, 1000);
    expect(() =>
      verifyConfirmation(confirmation, "owner-a", secret, 1_801_001),
    ).toThrow(/review/i);
  });
});
