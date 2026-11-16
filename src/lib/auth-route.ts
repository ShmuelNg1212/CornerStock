/** The `error` value on the sign-in page when a session has no active profile. */
export const NO_ACCESS = "inactive";

export const NO_ACCESS_MESSAGE = "This account does not have access. Ask the owner.";

/**
 * What the proxy does with a request.
 * "check-access": a session that the app sent back to the sign-in page. The proxy reads the
 * profile. With no access, it signs out. A redirect home would start a loop.
 */
export function authRoute(url: URL, signedIn: boolean): "to-login" | "to-home" | "check-access" | "pass" {
  const onLogin = url.pathname === "/login";
  if (!signedIn) return onLogin ? "pass" : "to-login";
  if (!onLogin) return "pass";
  return url.searchParams.get("error") === NO_ACCESS ? "check-access" : "to-home";
}
