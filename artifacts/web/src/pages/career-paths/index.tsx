import { useState } from "react";
import {
  useListCareerPaths,
  useCreateCareerPath,
  useUpdateCareerPath,
  getListCareerPathsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { FormDialog, TextField, TextAreaField, useCanManage } from "@/components/form-fields";

type StageRow = {
  title: string;
  level: string;
  gradeNum: string;
  durationInRole: string;
  description: string;
  requiredCompetencies: string;
  promotionCriteria: string;
};
const emptyStage: StageRow = {
  title: "",
  level: "",
  gradeNum: "",
  durationInRole: "",
  description: "",
  requiredCompetencies: "",
  promotionCriteria: "",
};

type Row = {
  id: string;
  name: string;
  field?: string | null;
  duration?: string | null;
  description?: string | null;
  stages?: {
    title: string;
    level?: string | null;
    gradeNum?: string | null;
    durationInRole?: string | null;
    description?: string | null;
    requiredCompetencies?: string[] | null;
    promotionCriteria?: string[] | null;
  }[];
};

const splitLines = (s: string) =>
  s
    .split(/[\n،,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function CareerPaths() {
  const { data: paths, isLoading } = useListCareerPaths();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const create = useCreateCareerPath();
  const update = useUpdateCareerPath();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ name: "", field: "", duration: "", description: "" });
  const [stages, setStages] = useState<StageRow[]>([{ ...emptyStage }]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", field: "", duration: "", description: "" });
    setStages([{ ...emptyStage }]);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      name: r.name,
      field: r.field ?? "",
      duration: r.duration ?? "",
      description: r.description ?? "",
    });
    setStages(
      r.stages && r.stages.length
        ? r.stages.map((s) => ({
            title: s.title,
            level: s.level ?? "",
            gradeNum: s.gradeNum ?? "",
            durationInRole: s.durationInRole ?? "",
            description: s.description ?? "",
            requiredCompetencies: (s.requiredCompetencies ?? []).join("، "),
            promotionCriteria: (s.promotionCriteria ?? []).join("، "),
          }))
        : [{ ...emptyStage }],
    );
    setOpen(true);
  };

  const setStage = (i: number, patch: Partial<StageRow>) =>
    setStages((ss) => ss.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const submit = () => {
    if (!form.name.trim()) {
      toast({ title: "اسم المسار مطلوب", variant: "destructive" });
      return;
    }
    const data = {
      name: form.name,
      field: form.field || undefined,
      duration: form.duration || undefined,
      description: form.description || undefined,
      stages: stages
        .filter((s) => s.title.trim())
        .map((s) => ({
          title: s.title,
          level: s.level || undefined,
          gradeNum: s.gradeNum || undefined,
          durationInRole: s.durationInRole || undefined,
          description: s.description || undefined,
          requiredCompetencies: splitLines(s.requiredCompetencies),
          promotionCriteria: splitLines(s.promotionCriteria),
        })),
    };
    const onSuccess = () => {
      toast({ title: editing ? "تم تحديث المسار" : "تمت إضافة المسار" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: getListCareerPathsQueryKey() });
    };
    const onError = () => toast({ title: "حدث خطأ", variant: "destructive" });
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">المسارات المهنية</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة مسار
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة المسارات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">المجال</TableHead>
                  <TableHead className="text-right">عدد المراحل</TableHead>
                  {canManage && <TableHead className="text-right">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paths?.map((path) => (
                  <TableRow key={path.id}>
                    <TableCell>{path.name}</TableCell>
                    <TableCell>{path.field}</TableCell>
                    <TableCell>{path.stageCount}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(path as Row)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "تعديل مسار مهني" : "إضافة مسار مهني"}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField label="اسم المسار" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <TextField label="المجال" value={form.field} onChange={(v) => setForm({ ...form, field: v })} />
          <TextField label="المدة" value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} />
        </div>
        <TextAreaField label="الوصف" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>المراحل</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setStages([...stages, { ...emptyStage }])}>
              <Plus className="w-4 h-4 ml-1" /> مرحلة
            </Button>
          </div>
          {stages.map((s, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">مرحلة {i + 1}</span>
                {stages.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setStages(stages.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">المسمى</Label>
                  <Input value={s.title} onChange={(e) => setStage(i, { title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المستوى</Label>
                  <Input value={s.level} onChange={(e) => setStage(i, { level: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الدرجة</Label>
                  <Input value={s.gradeNum} onChange={(e) => setStage(i, { gradeNum: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المدة في الدور</Label>
                  <Input value={s.durationInRole} onChange={(e) => setStage(i, { durationInRole: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الوصف</Label>
                <Textarea rows={2} value={s.description} onChange={(e) => setStage(i, { description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الجدارات المطلوبة (افصل بفاصلة)</Label>
                <Textarea
                  rows={2}
                  value={s.requiredCompetencies}
                  onChange={(e) => setStage(i, { requiredCompetencies: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">معايير الترقية (افصل بفاصلة)</Label>
                <Textarea
                  rows={2}
                  value={s.promotionCriteria}
                  onChange={(e) => setStage(i, { promotionCriteria: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </FormDialog>
    </div>
  );
}
