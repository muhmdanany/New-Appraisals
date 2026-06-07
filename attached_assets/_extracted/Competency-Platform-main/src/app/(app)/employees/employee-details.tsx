"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export function EmployeeDetails({ trigger, employeeId }: { trigger: React.ReactNode; employeeId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = api.employee.byId.useQuery({ id: employeeId }, { enabled: open });
  const extra = (data?.extraFields ?? {}) as Record<string, string>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>بيانات الموظف</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="py-6 text-center text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <div className="space-y-1">
            <Row label="الاسم" value={data.name} />
            <Row label="الرقم الوظيفي" value={data.employeeNumber} />
            <Row label="الوظيفة" value={data.job?.name ?? ""} />
            <Row label="الإدارة" value={data.department?.name ?? ""} />
            <Row label="الدرجة" value={data.grade ? `درجة ${data.grade.num} — ${data.grade.name}` : ""} />
            <Row
              label="المدير المباشر"
              value={data.manager ? `${data.manager.name} (${data.manager.employeeNumber})` : ""}
            />
            {Object.keys(extra).length > 0 && (
              <div className="pt-3">
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  حقول إضافية
                </div>
                {Object.entries(extra).map(([k, v]) => (
                  <Row key={k} label={k} value={String(v)} />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
