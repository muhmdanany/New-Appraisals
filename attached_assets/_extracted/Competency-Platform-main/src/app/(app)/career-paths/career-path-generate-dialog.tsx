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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import type { AiCareerPath } from "@/lib/validators/career-path";
import { StageTimeline } from "./stage-timeline";

export function CareerPathGenerateDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState("");
  const [preview, setPreview] = useState<AiCareerPath | null>(null);
  const utils = api.useUtils();

  const aiEnabled = api.careerPath.aiEnabled.useQuery(undefined, { enabled: open });
  const aiOff = aiEnabled.data === false;

  const generate = api.careerPath.generate.useMutation({
    onSuccess: (res) => setPreview(res),
    onError: (e) => toast.error(e.message),
  });
  const create = api.careerPath.create.useMutation({
    onSuccess: async () => {
      await utils.careerPath.list.invalidate();
      toast.success("تم حفظ المسار المُولّد.");
      setOpen(false);
      setPreview(null);
      setField("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setPreview(null);
          setField("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>توليد مسار وظيفي بالذكاء الاصطناعي</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>المجال أو التخصص</Label>
              <Input value={field} onChange={(e) => setField(e.target.value)} placeholder="مثال: تقنية المعلومات، الموارد البشرية" />
            </div>
            <Button
              variant="accent"
              disabled={field.trim().length < 2 || aiOff || generate.isPending}
              title={aiOff ? "أضف مفتاح OpenRouter لتفعيل التوليد" : undefined}
              onClick={() => generate.mutate({ field: field.trim() })}
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

          {preview && (
            <div className="space-y-3">
              <div className="rounded-md bg-primary/5 p-3">
                <div className="font-bold text-primary">{preview.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[preview.field, preview.duration].filter(Boolean).join(" · ")}
                </div>
                {preview.description && <p className="mt-1 text-xs text-muted-foreground">{preview.description}</p>}
              </div>
              <div className="max-h-[45vh] overflow-y-auto">
                <StageTimeline stages={preview.stages} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button disabled={!preview || create.isPending} onClick={() => preview && create.mutate(preview)}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ المسار
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
