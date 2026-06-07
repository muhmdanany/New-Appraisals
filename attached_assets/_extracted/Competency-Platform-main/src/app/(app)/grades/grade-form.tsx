"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { gradeInputSchema, type GradeInput } from "@/lib/validators/grade";
import { api } from "@/trpc/react";

const emptyLevel = (level: number) => ({
  level,
  label: "",
  minScore: 85,
  stayYears: 0,
  minYrsSecondary: 0,
  minYrsDiploma: 0,
  minYrsBachelor: 0,
  minYrsMaster: 0,
  minYrsPhd: 0,
  competencies: "",
});

const NEW_DEFAULTS: GradeInput = {
  num: "",
  name: "",
  classification: "",
  leaveDays: 21,
  salaryMin: null,
  salaryMax: null,
  housing: "",
  transport: "",
  bonus: "",
  benefits: "",
  levels: [emptyLevel(1)],
};

export function GradeForm({ trigger, gradeId }: { trigger: React.ReactNode; gradeId?: string }) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const isEdit = Boolean(gradeId);
  const existing = api.grade.byId.useQuery({ id: gradeId! }, { enabled: open && Boolean(gradeId) });

  const form = useForm<GradeInput>({
    resolver: zodResolver(gradeInputSchema),
    defaultValues: NEW_DEFAULTS,
  });
  const levels = useFieldArray({ control: form.control, name: "levels" });

  useEffect(() => {
    if (!open) return;
    if (existing.data) {
      const g = existing.data;
      form.reset({
        num: g.num,
        name: g.name,
        classification: g.classification ?? "",
        leaveDays: g.leaveDays,
        salaryMin: g.salaryMin ? Number(g.salaryMin) : null,
        salaryMax: g.salaryMax ? Number(g.salaryMax) : null,
        housing: g.housing ?? "",
        transport: g.transport ?? "",
        bonus: g.bonus ?? "",
        benefits: g.benefits ?? "",
        levels: g.levels.map((l) => ({
          level: l.level,
          label: l.label,
          minScore: l.minScore,
          stayYears: l.stayYears,
          minYrsSecondary: l.minYrsSecondary,
          minYrsDiploma: l.minYrsDiploma,
          minYrsBachelor: l.minYrsBachelor,
          minYrsMaster: l.minYrsMaster,
          minYrsPhd: l.minYrsPhd,
          competencies: l.competencies ?? "",
        })),
      });
    } else if (!gradeId) {
      form.reset(NEW_DEFAULTS);
    }
  }, [open, existing.data, gradeId, form]);

  const onSuccess = async () => {
    await Promise.all([utils.grade.list.invalidate(), utils.grade.options.invalidate()]);
    if (gradeId) await utils.grade.byId.invalidate({ id: gradeId });
    toast.success(isEdit ? "تم تحديث الدرجة." : "تمت إضافة الدرجة.");
    setOpen(false);
  };
  const create = api.grade.create.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const update = api.grade.update.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const pending = create.isPending || update.isPending;

  const num = (name: Parameters<typeof form.register>[0]) =>
    form.register(name, { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) });

  const onSubmit = form.handleSubmit((values) => {
    if (gradeId) update.mutate({ id: gradeId, ...values });
    else create.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الدرجة" : "إضافة درجة"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="g-num">رقم الدرجة *</Label>
              <Input id="g-num" {...form.register("num")} />
              {form.formState.errors.num && (
                <p className="text-xs text-destructive">{form.formState.errors.num.message}</p>
              )}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="g-name">اسم الدرجة *</Label>
              <Input id="g-name" {...form.register("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-leave">أيام الإجازة</Label>
              <Input id="g-leave" type="number" {...form.register("leaveDays", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="g-smin">الحد الأدنى للراتب</Label>
              <Input id="g-smin" type="number" {...num("salaryMin")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-smax">الحد الأعلى للراتب</Label>
              <Input id="g-smax" type="number" {...num("salaryMax")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-house">بدل السكن</Label>
              <Input id="g-house" {...form.register("housing")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-trans">بدل النقل</Label>
              <Input id="g-trans" {...form.register("transport")} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>المستويات داخل الدرجة *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => levels.append(emptyLevel(levels.fields.length + 1))}
              >
                <Plus className="size-4" />
                مستوى
              </Button>
            </div>
            {form.formState.errors.levels?.message && (
              <p className="text-xs text-destructive">{form.formState.errors.levels.message}</p>
            )}
            <div className="space-y-3">
              {levels.fields.map((field, i) => (
                <div key={field.id} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">المستوى {i + 1}</span>
                    {levels.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => levels.remove(i)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="col-span-2">
                      <Label className="text-xs">المسمى</Label>
                      <Input {...form.register(`levels.${i}.label`)} />
                    </div>
                    <div>
                      <Label className="text-xs">رقم المستوى</Label>
                      <Input type="number" {...form.register(`levels.${i}.level`, { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-xs">الحد الأدنى للدرجة</Label>
                      <Input type="number" {...form.register(`levels.${i}.minScore`, { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-xs">سنوات البقاء</Label>
                      <Input type="number" {...form.register(`levels.${i}.stayYears`, { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-xs">دبلوم</Label>
                      <Input type="number" {...form.register(`levels.${i}.minYrsDiploma`, { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-xs">بكالوريوس</Label>
                      <Input type="number" {...form.register(`levels.${i}.minYrsBachelor`, { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-xs">ماجستير</Label>
                      <Input type="number" {...form.register(`levels.${i}.minYrsMaster`, { valueAsNumber: true })} />
                    </div>
                    <div className="col-span-2 sm:col-span-4">
                      <Label className="text-xs">الجدارات</Label>
                      <Textarea className="min-h-[44px]" {...form.register(`levels.${i}.competencies`)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
