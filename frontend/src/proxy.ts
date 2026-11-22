import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = new Set(["/login", "/register"]);
const OPEN_PUBLIC_ROUTES = new Set(["/policy"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie =
    request.cookies.has("access_token") || request.cookies.has("refresh_token");

  if (OPEN_PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_AUTH_ROUTES.has(pathname)) {
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL("/time-tracking", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/time-tracking") {
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|logo/|favicon\\.ico|icon\\.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
