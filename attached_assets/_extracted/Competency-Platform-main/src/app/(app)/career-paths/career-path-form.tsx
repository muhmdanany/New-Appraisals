"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { CAREER_STAGE_LEVELS, CAREER_STAGE_LEVEL_LABELS, type CareerStageLevel } from "@/lib/enums";
import { splitList } from "@/lib/xlsx";
import { api } from "@/trpc/react";
import type { AiCareerPath } from "@/lib/validators/career-path";

type StageForm = {
  title: string;
  level: CareerStageLevel;
  gradeNum: string;
  durationInRole: string;
  description: string;
  requiredCompetencies: string[];
  promotionCriteria: string[];
};
const emptyStage = (): StageForm => ({
  title: "",
  level: "ENTRY",
  gradeNum: "",
  durationInRole: "",
  description: "",
  requiredCompetencies: [],
  promotionCriteria: [],
});

export function CareerPathForm({
  trigger,
  pathId,
  initial,
  onSaved,
}: {
  trigger: React.ReactNode;
  pathId?: string;
  /** Prefill (e.g. from AI generation) for a new path. */
  initial?: AiCareerPath;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const utils = api.useUtils();
  const isEdit = Boolean(pathId);

  const existing = api.careerPath.byId.useQuery({ id: pathId! }, { enabled: open && Boolean(pathId) });

  const [name, setName] = useState("");
  const [field, setField] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<StageForm[]>([emptyStage()]);

  function seedFrom(src: {
    name: string;
    field?: string | null;
    duration?: string | null;
    description?: string | null;
    stages: { title: string; level: CareerStageLevel; gradeNum?: string | null; durationInRole?: string | null; description?: string | null; requiredCompetencies: string[]; promotionCriteria: string[] }[];
  }) {
    setName(src.name);
    setField(src.field ?? "");
    setDuration(src.duration ?? "");
    setDescription(src.description ?? "");
    setStages(
      src.stages.map((s) => ({
        title: s.title,
        level: s.level,
        gradeNum: s.gradeNum ?? "",
        durationInRole: s.durationInRole ?? "",
        description: s.description ?? "",
        requiredCompetencies: s.requiredCompetencies,
        promotionCriteria: s.promotionCriteria,
      })),
    );
  }

  if (open && !seeded) {
    if (existing.data) {
      setSeeded(true);
      seedFrom(existing.data);
    } else if (initial) {
      setSeeded(true);
      seedFrom(initial);
    } else if (!pathId) {
      setSeeded(true);
    }
  }

  const onSuccess = async () => {
    await utils.careerPath.list.invalidate();
    if (pathId) await utils.careerPath.byId.invalidate({ id: pathId });
    toast.success(isEdit ? "تم تحديث المسار." : "تم حفظ المسار.");
    setOpen(false);
    onSaved?.();
  };
  const create = api.careerPath.create.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const update = api.careerPath.update.useMutation({ onSuccess, onError: (e) => toast.error(e.message) });
  const pending = create.isPending || update.isPending;

  const updateStage = (i: number, patch: Partial<StageForm>) =>
    setStages((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  function onSubmit() {
    const cleaned = stages.filter((s) => s.title.trim());
    if (!name.trim() || !cleaned.length) {
      toast.error("أدخل اسم المسار ومرحلة واحدة على الأقل بعنوان.");
      return;
    }
    const payload = {
      name: name.trim(),
      field: field || undefined,
      duration: duration || undefined,
      description: description || undefined,
      stages: cleaned.map((s) => ({
        title: s.title.trim(),
        level: s.level,
        gradeNum: s.gradeNum || undefined,
        durationInRole: s.durationInRole || undefined,
        description: s.description || undefined,
        requiredCompetencies: s.requiredCompetencies,
        promotionCriteria: s.promotionCriteria,
      })),
    };
    if (pathId) update.mutate({ id: pathId, ...payload });
    else create.mutate(payload);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSeeded(false);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل المسار الوظيفي" : "مسار وظيفي جديد"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>اسم المسار *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>المجال</Label>
              <Input value={field} onChange={(e) => setField(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>المدة الإجمالية</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="مثال: 10-14 سنة" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>الوصف</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>المراحل ({stages.length})</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setStages((s) => [...s, emptyStage()])}>
              <Plus className="size-4" /> مرحلة
            </Button>
          </div>

          <div className="max-h-[45vh] space-y-3 overflow-y-auto">
            {stages.map((s, i) => (
              <Card key={i} className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">المرحلة {i + 1}</span>
                  {stages.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => setStages((ss) => ss.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="col-span-2">
                    <Label className="text-xs">المسمى</Label>
                    <Input value={s.title} onChange={(e) => updateStage(i, { title: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">المستوى</Label>
                    <Select value={s.level} onChange={(e) => updateStage(i, { level: e.target.value as CareerStageLevel })}>
                      {CAREER_STAGE_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {CAREER_STAGE_LEVEL_LABELS[l]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الدرجة</Label>
                    <Input value={s.gradeNum} onChange={(e) => updateStage(i, { gradeNum: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">المدة في المرحلة</Label>
                    <Input value={s.durationInRole} onChange={(e) => updateStage(i, { durationInRole: e.target.value })} />
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <Label className="text-xs">الجدارات المطلوبة (افصل بفاصلة)</Label>
                    <Input
                      value={s.requiredCompetencies.join("، ")}
                      onChange={(e) => updateStage(i, { requiredCompetencies: splitList(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <Label className="text-xs">معايير الترقية (افصل بفاصلة)</Label>
                    <Input
                      value={s.promotionCriteria.join("، ")}
                      onChange={(e) => updateStage(i, { promotionCriteria: splitList(e.target.value) })}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button disabled={pending} onClick={onSubmit}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
