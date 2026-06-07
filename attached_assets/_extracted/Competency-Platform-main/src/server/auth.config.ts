import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/rbac";

/**
 * Edge-safe Auth.js base config. Contains NO database/bcrypt access so it can run
 * in the middleware (edge runtime). The Credentials provider (which needs Prisma +
 * bcrypt) is added in `auth.ts`, which runs in the Node runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // populated in auth.ts
  callbacks: {
    // Persist identity + role on the token at sign-in.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.employeeId = user.employeeId;
      }
      return token;
    },
    // Expose id + role + employeeId to the client session. These were placed on
    // the token in the `jwt` callback above, so we read them back here.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.employeeId = (token.employeeId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
