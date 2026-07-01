"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import {
  COMPETENCY_TYPES,
  COMPETENCY_TYPE_LABELS,
  COMPETENCY_LEVELS,
  COMPETENCY_LEVEL_LABELS,
} from "@/lib/enums";
import { competencyInputSchema, type CompetencyInput } from "@/lib/validators/competency";
import { api } from "@/trpc/react";

type Competency = CompetencyInput & { id: string };

export function CompetencyForm({
  trigger,
  competency,
}: {
  trigger: React.ReactNode;
  competency?: Competency;
}) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const isEdit = Boolean(competency);

  const form = useForm<CompetencyInput>({
    resolver: zodResolver(competencyInputSchema),
    defaultValues: {
      name: "",
      type: "JOB",
      level: "BASIC",
      description: "",
      indicators: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: competency?.name ?? "",
        type: competency?.type ?? "JOB",
        level: competency?.level ?? "BASIC",
        description: competency?.description ?? "",
        indicators: competency?.indicators ?? "",
      });
    }
  }, [open, competency, form]);

  const onSuccess = async () => {
    await Promise.all([utils.competency.list.invalidate(), utils.competency.options.invalidate()]);
    toast.success(isEdit ? "تم تحديث الجدارة." : "تمت إضافة الجدارة.");
    setOpen(false);
  };

  const create = api.competency.create.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const update = api.competency.update.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const pending = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (competency) update.mutate({ id: competency.id, ...values });
    else create.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الجدارة" : "إضافة جدارة"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">اسم الجدارة *</Label>
            <Input id="c-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-type">النوع</Label>
              <Select id="c-type" {...form.register("type")}>
                {COMPETENCY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COMPETENCY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-level">المستوى</Label>
              <Select id="c-level" {...form.register("level")}>
                {COMPETENCY_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {COMPETENCY_LEVEL_LABELS[l]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">الوصف</Label>
            <Textarea id="c-desc" {...form.register("description")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-ind">المؤشرات</Label>
            <Textarea id="c-ind" {...form.register("indicators")} placeholder="افصل بين المؤشرات بفاصلة" />
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
