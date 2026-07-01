"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Save, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

type Kpi = {
  name: string;
  description?: string;
  measure?: string;
  target?: string;
  frequency?: string;
  weight?: string;
};
type Group = { competencyName: string; compType?: string; kpis: Kpi[] };

const emptyKpi = (): Kpi => ({ name: "", measure: "", target: "", frequency: "", weight: "" });

export function KpiBuilder({ jobId }: { jobId: string }) {
  const utils = api.useUtils();
  const { data, isLoading } = api.kpi.get.useQuery({ jobId });
  const aiEnabled = api.kpi.aiEnabled.useQuery();

  const [summary, setSummary] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [seeded, setSeeded] = useState(false);

  if (!seeded && data) {
    setSeeded(true);
    if (data.kpiSet) {
      setSummary(data.kpiSet.summary ?? "");
      setAiGenerated(data.kpiSet.isAiGenerated);
      setGroups(
        data.kpiSet.groups.map((g) => ({
          competencyName: g.competencyName,
          compType: g.compType ?? "",
          kpis: g.kpis.map((k) => ({
            name: k.name,
            description: k.description ?? "",
            measure: k.measure ?? "",
            target: k.target ?? "",
            frequency: k.frequency ?? "",
            weight: k.weight ?? "",
          })),
        })),
      );
    } else {
      setGroups(data.job.competencies.map((name) => ({ competencyName: name, compType: "", kpis: [emptyKpi()] })));
    }
  }

  const save = api.kpi.save.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.kpi.get.invalidate({ jobId }), utils.kpi.list.invalidate()]);
      toast.success("تم حفظ المؤشرات.");
    },
    onError: (e) => toast.error(e.message),
  });
  const generate = api.kpi.generate.useMutation({
    onSuccess: (res) => {
      setSummary(res.summary ?? "");
      setAiGenerated(true);
      setGroups(
        res.groups.map((g) => ({
          competencyName: g.competencyName,
          compType: g.compType ?? "",
          kpis: g.kpis.map((k) => ({
            name: k.name,
            description: k.description ?? "",
            measure: k.measure ?? "",
            target: k.target ?? "",
            frequency: k.frequency ?? "",
            weight: k.weight ?? "",
          })),
        })),
      );
      toast.success("تم توليد المؤشرات. راجعها ثم احفظ.");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateGroup = (gi: number, patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updateKpi = (gi: number, ki: number, patch: Partial<Kpi>) =>
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi ? { ...g, kpis: g.kpis.map((k, j) => (j === ki ? { ...k, ...patch } : k)) } : g,
      ),
    );

  function onSave() {
    const cleaned = groups
      .map((g) => ({ ...g, kpis: g.kpis.filter((k) => k.name.trim()) }))
      .filter((g) => g.competencyName.trim() && g.kpis.length > 0);
    if (!cleaned.length) {
      toast.error("أضف مجموعة واحدة على الأقل تحتوي مؤشراً باسم.");
      return;
    }
    save.mutate({ jobId, summary: summary || undefined, isAiGenerated: aiGenerated, groups: cleaned });
  }

  function onExport() {
    let csv = "الجدارة,المؤشر,طريقة القياس,المستهدف,التكرار,الوزن\n";
    for (const g of groups) {
      for (const k of g.kpis) {
        csv += `"${g.competencyName}","${k.name}","${k.measure ?? ""}","${k.target ?? ""}","${k.frequency ?? ""}","${k.weight ?? ""}"\n`;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `KPIs_${data?.job.name ?? "job"}.csv`;
    a.click();
  }

  if (isLoading || !data) return <div className="py-10 text-center text-muted-foreground">جارٍ التحميل…</div>;

  const aiOff = aiEnabled.data === false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">مؤشرات وظيفة: {data.job.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="accent"
            size="sm"
            disabled={aiOff || generate.isPending}
            title={aiOff ? "أضف مفتاح OpenRouter لتفعيل التوليد" : undefined}
            onClick={() => generate.mutate({ jobId })}
          >
            {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            توليد بالذكاء الاصطناعي
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="size-4" /> CSV
          </Button>
          <Button size="sm" disabled={save.isPending} onClick={onSave}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ
          </Button>
        </div>
      </div>

      {aiOff && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          ميزة التوليد بالذكاء الاصطناعي غير مفعّلة. أضف <code>OPENROUTER_API_KEY</code> و<code>AI_ENABLED=true</code> في إعدادات الخادم.
        </p>
      )}

      <div className="space-y-1.5">
        <Label>ملخص</Label>
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="ملخص اختياري لمنظومة المؤشرات" />
      </div>

      {groups.map((g, gi) => (
        <Card key={gi} className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Input
              className="font-semibold"
              placeholder="اسم الجدارة"
              value={g.competencyName}
              onChange={(e) => updateGroup(gi, { competencyName: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-destructive"
              onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {g.kpis.map((k, ki) => (
              <div key={ki} className="rounded-md border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="اسم المؤشر"
                    value={k.name}
                    onChange={(e) => updateKpi(gi, ki, { name: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-destructive"
                    onClick={() =>
                      setGroups((gs) =>
                        gs.map((gr, i) => (i === gi ? { ...gr, kpis: gr.kpis.filter((_, j) => j !== ki) } : gr)),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input placeholder="طريقة القياس" value={k.measure ?? ""} onChange={(e) => updateKpi(gi, ki, { measure: e.target.value })} />
                  <Input placeholder="المستهدف" value={k.target ?? ""} onChange={(e) => updateKpi(gi, ki, { target: e.target.value })} />
                  <Input placeholder="التكرار" value={k.frequency ?? ""} onChange={(e) => updateKpi(gi, ki, { frequency: e.target.value })} />
                  <Input placeholder="الوزن %" value={k.weight ?? ""} onChange={(e) => updateKpi(gi, ki, { weight: e.target.value })} />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroups((gs) => gs.map((gr, i) => (i === gi ? { ...gr, kpis: [...gr.kpis, emptyKpi()] } : gr)))}
            >
              <Plus className="size-4" /> مؤشر
            </Button>
          </div>
        </Card>
      ))}

      <Button
        variant="outline"
        onClick={() => setGroups((gs) => [...gs, { competencyName: "", compType: "", kpis: [emptyKpi()] }])}
      >
        <Plus className="size-4" /> إضافة مجموعة جدارة
      </Button>
    </div>
  );
}
