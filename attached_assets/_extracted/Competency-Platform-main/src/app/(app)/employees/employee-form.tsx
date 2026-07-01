"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { employeeInputSchema, type EmployeeInput } from "@/lib/validators/employee";
import { api } from "@/trpc/react";

type Pair = { key: string; value: string };

const NEW_DEFAULTS: EmployeeInput = {
  name: "",
  employeeNumber: "",
  jobId: "",
  departmentId: "",
  gradeId: "",
  managerId: "",
  extraFields: {},
};

export function EmployeeForm({ trigger, employeeId }: { trigger: React.ReactNode; employeeId?: string }) {
  const [open, setOpen] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const utils = api.useUtils();
  const isEdit = Boolean(employeeId);

  const departments = api.department.list.useQuery(undefined, { enabled: open });
  const grades = api.grade.options.useQuery(undefined, { enabled: open });
  const jobs = api.job.list.useQuery({ take: 500, skip: 0 }, { enabled: open });
  const managers = api.employee.options.useQuery(undefined, { enabled: open });
  const existing = api.employee.byId.useQuery({ id: employeeId! }, { enabled: open && Boolean(employeeId) });

  const form = useForm<EmployeeInput>({
    resolver: zodResolver(employeeInputSchema),
    defaultValues: NEW_DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (existing.data) {
      const e = existing.data;
      const extra = (e.extraFields ?? {}) as Record<string, string>;
      form.reset({
        name: e.name,
        employeeNumber: e.employeeNumber,
        jobId: e.job?.id ?? "",
        departmentId: e.department?.id ?? "",
        gradeId: e.grade?.id ?? "",
        managerId: e.manager?.id ?? "",
        extraFields: extra,
      });
      setPairs(Object.entries(extra).map(([key, value]) => ({ key, value: String(value) })));
    } else if (!employeeId) {
      form.reset(NEW_DEFAULTS);
      setPairs([]);
    }
  }, [open, existing.data, employeeId, form]);

  function syncExtra(next: Pair[]) {
    setPairs(next);
    const obj: Record<string, string> = {};
    for (const p of next) if (p.key.trim()) obj[p.key.trim()] = p.value;
    form.setValue("extraFields", obj, { shouldDirty: true });
  }

  const onSuccess = async () => {
    await Promise.all([utils.employee.list.invalidate(), utils.employee.options.invalidate()]);
    if (employeeId) await utils.employee.byId.invalidate({ id: employeeId });
    toast.success(isEdit ? "تم تحديث الموظف." : "تمت إضافة الموظف.");
    setOpen(false);
  };
  const create = api.employee.create.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const update = api.employee.update.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const pending = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (employeeId) update.mutate({ id: employeeId, ...values });
    else create.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل موظف" : "إضافة موظف"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-name">الاسم *</Label>
              <Input id="e-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-num">الرقم الوظيفي *</Label>
              <Input id="e-num" dir="ltr" {...form.register("employeeNumber")} />
              {form.formState.errors.employeeNumber && (
                <p className="text-xs text-destructive">{form.formState.errors.employeeNumber.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-job">الوظيفة</Label>
              <Select id="e-job" {...form.register("jobId")}>
                <option value="">— بدون —</option>
                {jobs.data?.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-dept">الإدارة</Label>
              <Select id="e-dept" {...form.register("departmentId")}>
                <option value="">— بدون —</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-grade">الدرجة</Label>
              <Select id="e-grade" {...form.register("gradeId")}>
                <option value="">— بدون —</option>
                {grades.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    درجة {g.num} — {g.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-mgr">المدير المباشر</Label>
              <Select id="e-mgr" {...form.register("managerId")}>
                <option value="">— بدون —</option>
                {managers.data
                  ?.filter((m) => m.id !== employeeId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.employeeNumber})
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>حقول إضافية</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => syncExtra([...pairs, { key: "", value: "" }])}
              >
                <Plus className="size-4" />
                حقل
              </Button>
            </div>
            {pairs.length === 0 && <p className="text-xs text-muted-foreground">لا توجد حقول إضافية.</p>}
            {pairs.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="اسم الحقل"
                  value={p.key}
                  onChange={(e) => syncExtra(pairs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                />
                <Input
                  placeholder="القيمة"
                  value={p.value}
                  onChange={(e) => syncExtra(pairs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-destructive"
                  onClick={() => syncExtra(pairs.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
