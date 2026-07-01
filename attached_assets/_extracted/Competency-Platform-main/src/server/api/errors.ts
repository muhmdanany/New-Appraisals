import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/**
 * Rethrows a Prisma unique-constraint violation (P2002) as a tRPC CONFLICT with a
 * friendly Arabic message; otherwise rethrows the original error.
 */
export function handleUniqueError(err: unknown, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new TRPCError({ code: "CONFLICT", message });
  }
  throw err;
}
