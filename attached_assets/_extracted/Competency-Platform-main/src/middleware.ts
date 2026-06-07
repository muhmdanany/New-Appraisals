import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth.config";
import { canAccessPath, defaultPathForRole, type Role } from "@/lib/rbac";

// Edge-safe Auth.js instance (no DB/bcrypt) used purely to read the JWT session.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  // Unauthenticated → allow public pages, otherwise send to login.
  if (!isLoggedIn) {
    if (isPublic) return NextResponse.next();
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role as Role;

  // Authenticated user hitting the login page → go to their landing route.
  if (path === "/login") {
    return NextResponse.redirect(new URL(defaultPathForRole(role), nextUrl));
  }

  // Role-based route protection. Denied routes fall back to the role's landing page.
  if (!canAccessPath(path, role)) {
    return NextResponse.redirect(new URL(defaultPathForRole(role), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|api/trpc|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
