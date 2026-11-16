/** Turns a database error into a message for staff. */
export function stockErrorMessage(error: { message?: string; code?: string } | null): string {
  const text = error?.message ?? "";
  if (text.includes("DUPLICATE_SERIAL")) return "This serial number is already recorded.";
  if (text.includes("NOT_AUTHORIZED") || error?.code === "42501") return "Your account cannot do this.";
  if (text.includes("WRONG_STATUS")) return "This ball changed a moment ago. Check its current status.";
  if (text.includes("BALL_NOT_FOUND")) return "This ball is not in the records.";
  if (text.includes("LOCATION_NOT_FOUND")) return "This location is not available. Select another location.";
  if (text.includes("SAME_LOCATION")) return "The ball is already in this location.";
  if (text.includes("REASON_REQUIRED")) return "Write a reason.";
  if (text.includes("LAST_OWNER")) return "There must be one active owner or more.";
  if (error?.code === "23505") return "This name or number is already in use.";
  if (error?.code === "23514" || error?.code === "22P02" || text.includes("INVALID_LABEL")) {
    return "One or more values are not valid. Check the fields.";
  }
  return "The change was not saved. Check the connection and try again.";
}
