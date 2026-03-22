import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // This refreshes the session if expired - must be called
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes - redirect to login if not authenticated
  const protectedPrefixes = [
    "/settings",
    "/tasks",
    "/habits",
    "/journal",
    "/workouts",
    "/focus",
    "/dashboard",
    "/review",
    "/admin",
    "/projects",
    "/calendar",
    "/goals",
  ];

  if (!user && protectedPrefixes.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Auth routes - redirect to chat if already authenticated
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/settings/:path*",
    "/tasks/:path*",
    "/habits/:path*",
    "/journal/:path*",
    "/workouts/:path*",
    "/focus/:path*",
    "/dashboard/:path*",
    "/review/:path*",
    "/admin/:path*",
    "/projects/:path*",
    "/calendar/:path*",
    "/goals/:path*",
  ],
};
