import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { apiEnv } from "./env";
import { DEMO_SESSION_COOKIE, isDemoMode } from '@/lib/demo'

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

  // A Vercel-only preview has no database or API credentials. It exposes the
  // self-contained Digital Marketing workspace behind one demo account instead
  // of allowing the missing backend configuration to crash every request.
  if (isDemoMode()) {
    const signedIn = request.cookies.get(DEMO_SESSION_COOKIE)?.value === 'active'
    if (path === '/login') {
      return signedIn
        ? NextResponse.redirect(new URL('/marketing-preview', request.url))
        : response
    }
    if (path.startsWith('/marketing-preview')) {
      return signedIn
        ? response
        : NextResponse.redirect(new URL('/login', request.url))
    }
    if (path.startsWith('/auth/demo')) return response
    return NextResponse.redirect(new URL('/marketing-preview', request.url))
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
