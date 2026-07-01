"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "@/trpc/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCReactProvider>{children}</TRPCReactProvider>
      <Toaster position="top-center" dir="rtl" richColors closeButton />
    </SessionProvider>
  );
}
