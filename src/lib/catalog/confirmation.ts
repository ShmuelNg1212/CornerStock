import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ImportPayload } from "./review";

export type Confirmation = {
  payload: ImportPayload;
  requestId: string;
  expiresAt: number;
  signature: string;
};
const message = (value: Omit<Confirmation, "signature">, actor: string) =>
  JSON.stringify([actor, value.requestId, value.expiresAt, value.payload]);

export function signConfirmation(
  payload: ImportPayload,
  actor: string,
  secret: string,
  now = Date.now(),
): Confirmation {
  const value = {
    payload,
    requestId: randomUUID(),
    expiresAt: now + 30 * 60 * 1000,
  };
  return {
    ...value,
    signature: createHmac("sha256", secret)
      .update(message(value, actor))
      .digest("hex"),
  };
}

export function verifyConfirmation(
  value: Confirmation,
  actor: string,
  secret: string,
  now = Date.now(),
): ImportPayload {
  if (
    !value ||
    typeof value.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.signature) ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt < now
  ) {
    throw new Error("This review expired. Review the file again.");
  }
  const expected = createHmac("sha256", secret)
    .update(message(value, actor))
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(value.signature, "hex")))
    throw new Error("The review changed. Review the file again.");
  return value.payload;
}
