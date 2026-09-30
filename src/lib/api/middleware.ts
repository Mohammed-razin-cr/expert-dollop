import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { apiEnv } from "./env";

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/aptitude-form",
  "/onboard",
  "/api/onboard",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // The local Digital Marketing test flow is intentionally database-free.
  // Skip session setup before apiEnv() so it also works on a fresh checkout
  // without API credentials.
  if (
    process.env.NODE_ENV === "development" &&
    (path === "/login" || path === "/marketing-preview")
  ) {
    return response;
  }

  // Throws with the variable names when the deployment is unconfigured.
  // This runs on every matched path, so getting it wrong takes the whole
  // site down — worth saying why rather than returning a bare 500.
  const { url, anonKey } = apiEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() must run to refresh the auth token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Unauthenticated → bounce to /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting /login → send to dashboard
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_key")
      .eq("id", user.id)
      .single();
    if (
      profile?.role_key === "digital_marketing" &&
      !["/dashboard", "/profile"].includes(path) &&
      !path.startsWith("/marketing")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
