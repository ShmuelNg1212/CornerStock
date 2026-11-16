import { describe, expect, it } from "vitest";
import { authRoute, NO_ACCESS } from "./auth-route";

const at = (path: string, search = "") => new URL(`https://app.test${path}${search}`);

describe("authRoute", () => {
  it("sends a signed-out visitor to the sign-in page", () => {
    expect(authRoute(at("/"), false)).toBe("to-login");
    expect(authRoute(at("/balls/1"), false)).toBe("to-login");
  });

  it("lets a signed-out visitor see the sign-in page", () => {
    expect(authRoute(at("/login"), false)).toBe("pass");
    expect(authRoute(at("/login", `?error=${NO_ACCESS}`), false)).toBe("pass");
  });

  it("sends a signed-in visitor from the sign-in page to the app", () => {
    expect(authRoute(at("/login"), true)).toBe("to-home");
  });

  it("checks access, not a redirect home, when the app sent a session back for no access", () => {
    // A redirect home here starts the loop: home sends the session back to the sign-in page.
    expect(authRoute(at("/login", `?error=${NO_ACCESS}`), true)).toBe("check-access");
  });

  it("lets a signed-in visitor through to the app", () => {
    expect(authRoute(at("/"), true)).toBe("pass");
  });
});
