import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "r53_session";

// Next.js 16 convention: proxy.ts (formerly middleware.ts). Cookie presence is
// only an optimistic check — the AuthGuard + backend do the real auth.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSession ? "/route53/v2/hostedzones" : "/login", request.url),
    );
  }
  if (pathname.startsWith("/route53") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/route53/:path*"],
};
