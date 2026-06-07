"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_TYPES, CONTRACT_TYPE_LABELS, COMPETENCY_TYPE_LABELS, EXPERIENCE_LEVELS } from "@/lib/enums";
import { jobInputSchema, type JobInput } from "@/lib/validators/job";
import { api } from "@/trpc/react";

export function JobForm({ trigger, jobId }: { trigger: React.ReactNode; jobId?: string }) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const isEdit = Boolean(jobId);

  const departments = api.department.list.useQuery(undefined, { enabled: open });
  const grades = api.grade.options.useQuery(undefined, { enabled: open });
  const competencies = api.competency.options.useQuery(undefined, { enabled: open });
  const jobsList = api.job.list.useQuery({ take: 500, skip: 0 }, { enabled: open });
  const aiEnabled = api.job.aiEnabled.useQuery(undefined, { enabled: open });
  const existing = api.job.byId.useQuery({ id: jobId! }, { enabled: open && Boolean(jobId) });

  const form = useForm<JobInput>({
    resolver: zodResolver(jobInputSchema),
    defaultValues: {
      name: "",
      departmentId: "",
      gradeId: "",
      reportsToJobId: "",
      contractType: "FULL_TIME",
      experienceLevel: "",
      description: "",
      competencyIds: [],
    },
  });

  useEffect(() => {
    if (!open) return;
    if (existing.data) {
      form.reset({
        name: existing.data.name,
        departmentId: existing.data.departmentId ?? "",
        gradeId: existing.data.gradeId ?? "",
        reportsToJobId: existing.data.reportsToJobId ?? "",
        contractType: existing.data.contractType,
        experienceLevel: existing.data.experienceLevel ?? "",
        description: existing.data.description ?? "",
        competencyIds: existing.data.competencyIds,
      });
    } else if (!jobId) {
      form.reset({
        name: "",
        departmentId: "",
        gradeId: "",
        reportsToJobId: "",
        contractType: "FULL_TIME",
        experienceLevel: "",
        description: "",
        competencyIds: [],
      });
    }
  }, [open, existing.data, jobId, form]);

  const onSuccess = async () => {
    await utils.job.list.invalidate();
    if (jobId) await utils.job.byId.invalidate({ id: jobId });
    toast.success(isEdit ? "تم تحديث الوظيفة." : "تمت إضافة الوظيفة.");
    setOpen(false);
  };
  const create = api.job.create.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const update = api.job.update.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const pending = create.isPending || update.isPending;

  const genDesc = api.job.generateDescription.useMutation({
    onSuccess: (res) => {
      form.setValue("description", res.description, { shouldDirty: true });
      toast.success("تم توليد الوصف. يمكنك تعديله.");
    },
    onError: (e) => toast.error(e.message),
  });

  function onGenerateDescription() {
    const name = form.getValues("name").trim();
    if (name.length < 2) {
      toast.error("أدخل المسمى الوظيفي أولاً.");
      return;
    }
    const ids = new Set(form.getValues("competencyIds"));
    const competencyNames = (competencies.data ?? []).filter((c) => ids.has(c.id)).map((c) => c.name);
    const departmentName = departments.data?.find((d) => d.id === form.getValues("departmentId"))?.name;
    const grade = grades.data?.find((g) => g.id === form.getValues("gradeId"));
    genDesc.mutate({
      name,
      competencyNames,
      departmentName: departmentName ?? undefined,
      gradeName: grade ? `درجة ${grade.num} — ${grade.name}` : undefined,
    });
  }

  const selectedIds = form.watch("competencyIds");
  const toggleCompetency = (id: string) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    form.setValue("competencyIds", Array.from(set), { shouldDirty: true });
  };

  const onSubmit = form.handleSubmit((values) => {
    if (jobId) update.mutate({ id: jobId, ...values });
    else create.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الوظيفة" : "إضافة وظيفة"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="j-name">المسمى الوظيفي *</Label>
            <Input id="j-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="j-dept">الإدارة</Label>
              <Select id="j-dept" {...form.register("departmentId")}>
                <option value="">— بدون —</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-grade">الدرجة</Label>
              <Select id="j-grade" {...form.register("gradeId")}>
                <option value="">— بدون —</option>
                {grades.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    درجة {g.num} — {g.name}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-muted-foreground">تُحدَّد تلقائياً من مستوى الخبرة، ويمكن تعديلها.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="j-contract">نوع العقد</Label>
              <Select id="j-contract" {...form.register("contractType")}>
                {CONTRACT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {CONTRACT_TYPE_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-exp">مستوى الخبرة</Label>
              <Select
                id="j-exp"
                {...form.register("experienceLevel", {
                  onChange: (e) => {
                    const match = EXPERIENCE_LEVELS.find((x) => x.label === e.target.value);
                    const grade = match ? grades.data?.find((g) => g.num === match.gradeNum) : undefined;
                    if (grade) form.setValue("gradeId", grade.id, { shouldDirty: true });
                  },
                })}
              >
                <option value="">— اختر —</option>
                {EXPERIENCE_LEVELS.map((x) => (
                  <option key={x.label} value={x.label}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="j-reports">الرئيس المباشر (الوظيفة الأعلى)</Label>
            <Select id="j-reports" {...form.register("reportsToJobId")}>
              <option value="">— بدون —</option>
              {jobsList.data
                ?.filter((j) => j.id !== jobId)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="j-desc">الوصف</Label>
              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={aiEnabled.data === false || genDesc.isPending}
                title={aiEnabled.data === false ? "أضف مفتاح OpenRouter لتفعيل التوليد" : undefined}
                onClick={onGenerateDescription}
              >
                {genDesc.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                توليد بالذكاء الاصطناعي
              </Button>
            </div>
            <Textarea id="j-desc" rows={5} {...form.register("description")} />
            {aiEnabled.data === false && (
              <p className="text-[11px] text-muted-foreground">ميزة التوليد غير مفعّلة (أضف مفتاح OpenRouter).</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>الجدارات المطلوبة ({selectedIds.length})</Label>
            <div className="max-h-44 overflow-y-auto rounded-md border border-border p-2">
              {competencies.data?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {competencies.data.map((c) => {
                    const active = selectedIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCompetency(c.id)}
                        className={
                          "rounded-full border px-2.5 py-1 text-xs transition-colors " +
                          (active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted")
                        }
                      >
                        {c.name}
                        <span className="opacity-60"> · {COMPETENCY_TYPE_LABELS[c.type]}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="p-2 text-xs text-muted-foreground">لا توجد جدارات. أضفها من صفحة الجدارات.</p>
              )}
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
