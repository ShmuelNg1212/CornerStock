import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authRoute } from "@/lib/auth-route";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Refreshes the session cookie and sends signed-out visitors to the sign-in page.
// This is a first check only. Pages, actions, and the database do the real checks.
export async function proxy(request: NextRequest) {
  // The preview route shows the screens with fixture data. It exists in development only.
  if (process.env.NODE_ENV !== "production" && request.nextUrl.pathname.startsWith("/preview")) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims checks the token signature locally with the cached project key. It refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const route = authRoute(request.nextUrl, Boolean(userId));

  if (route === "to-login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (route === "check-access") {
    // Row-level security shows no profile to an inactive account.
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId!).maybeSingle();
    if (!profile) {
      // The sign-out clears the session cookies on the response. The sign-in page then shows.
      await supabase.auth.signOut({ scope: "local" });
      return response;
    }
  }
  if (route === "to-home" || route === "check-access") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|webp|wasm)$).*)"],
};
