"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/rbac";

export function Topbar({ name, role }: { name: string; role: Role }) {
  const initials = name.trim().charAt(0) || "؟";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5 shadow-sm print:hidden">
      <div className="text-sm text-muted-foreground">
        مرحباً، <span className="font-semibold text-foreground">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">{name}</div>
            <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[role]}</div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-4" />
          خروج
        </Button>
      </div>
    </header>
  );
}
