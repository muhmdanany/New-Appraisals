"use client";

import { useState } from "react";
import { Loader2, Sparkles, Save } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { api } from "@/trpc/react";
import {
  COMPETENCY_TYPE_LABELS,
  COMPETENCY_LEVEL_LABELS,
  type CompetencyType,
} from "@/lib/enums";
import type { AiCompetency } from "@/lib/validators/competency";

const TYPE_VARIANT: Record<CompetencyType, BadgeProps["variant"]> = {
  LEADERSHIP: "purple",
  TECHNICAL: "default",
  BEHAVIORAL: "success",
  JOB: "warning",
  MANAGERIAL: "destructive",
};

export function CompetencyGenerateDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState("");
  const [suggestions, setSuggestions] = useState<AiCompetency[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const utils = api.useUtils();

  const jobs = api.job.list.useQuery({ take: 500, skip: 0 }, { enabled: open });
  const aiEnabled = api.competency.aiEnabled.useQuery(undefined, { enabled: open });

  const generate = api.competency.generate.useMutation({
    onSuccess: (res) => {
      setSuggestions(res.competencies);
      setSelected(new Set(res.competencies.map((_, i) => i)));
    },
    onError: (e) => toast.error(e.message),
  });
  const saveGenerated = api.competency.saveGenerated.useMutation({
    onSuccess: async (res) => {
      await Promise.all([
        utils.competency.list.invalidate(),
        utils.competency.options.invalidate(),
        utils.job.list.invalidate(),
        utils.job.byId.invalidate({ id: jobId }),
      ]);
      toast.success(`تمت إضافة ${res.created} جدارة جديدة وربط ${res.linked} بالوظيفة.`);
      setOpen(false);
      setSuggestions(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const aiOff = aiEnabled.data === false;

  function toggle(i: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function onSave() {
    if (!suggestions) return;
    const chosen = suggestions.filter((_, i) => selected.has(i));
    if (!chosen.length) {
      toast.error("اختر جدارة واحدة على الأقل.");
      return;
    }
    saveGenerated.mutate({ jobId, competencies: chosen });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSuggestions(null);
          setJobId("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>توليد جدارات بالذكاء الاصطناعي</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>اختر الوظيفة</Label>
              <Select value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">— اختر —</option>
                {jobs.data?.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="accent"
              disabled={!jobId || aiOff || generate.isPending}
              title={aiOff ? "أضف مفتاح OpenRouter لتفعيل التوليد" : undefined}
              onClick={() => generate.mutate({ jobId })}
            >
              {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              توليد
            </Button>
          </div>

          {aiOff && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              ميزة التوليد بالذكاء الاصطناعي غير مفعّلة. أضف <code>OPENROUTER_API_KEY</code> و<code>AI_ENABLED=true</code>.
            </p>
          )}

          {suggestions && (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              <p className="text-xs text-muted-foreground">
                اختر الجدارات المراد إضافتها وربطها بالوظيفة ({selected.size}/{suggestions.length}):
              </p>
              {suggestions.map((c, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[hsl(var(--primary))]"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{c.name}</span>
                      <Badge variant={TYPE_VARIANT[c.type]}>{COMPETENCY_TYPE_LABELS[c.type]}</Badge>
                      <span className="text-[11px] text-muted-foreground">{COMPETENCY_LEVEL_LABELS[c.level]}</span>
                    </div>
                    {c.indicators && <div className="mt-0.5 text-[11px] text-muted-foreground">📌 {c.indicators}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button disabled={!suggestions || saveGenerated.isPending} onClick={onSave}>
            {saveGenerated.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ المحدّد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
