import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  // Protect /ballot and /settings and all their sub-paths.
  // Lowercase only (URLs are canonicalized elsewhere).
  matcher: ["/ballot/:path*", "/settings/:path*"],
};
