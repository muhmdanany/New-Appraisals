import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { writeAudit } from "./services/audit";
import type { Role } from "@/lib/rbac";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Full Auth.js instance (Node runtime). Credentials provider verifies the email +
 * password against the Prisma `User` table using bcrypt.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    // Record every successful sign-in in the audit trail.
    async signIn({ user }) {
      if (user.id) {
        await writeAudit(db, {
          userId: user.id,
          action: "auth.signIn",
          entityType: "User",
          entityId: user.id,
        });
      }
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.hashedPassword || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          employeeId: user.employeeId,
        };
      },
    }),
  ],
});
