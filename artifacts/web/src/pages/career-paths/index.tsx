import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  useListCareerPaths,
  useCreateCareerPath,
  useUpdateCareerPath,
  useGenerateCareerPath,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { FormDialog, TextField, TextAreaField, useCanManage } from "@/components/form-fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const { t } = useTranslation();
  const { data: paths, isLoading } = useListCareerPaths();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const create = useCreateCareerPath();
  const update = useUpdateCareerPath();
  const generate = useGenerateCareerPath();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiField, setAiField] = useState("");
  const [toDeletePath, setToDeletePath] = useState<{ id: string; name: string } | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const uid = localStorage.getItem("selectedUserId");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) headers["X-User-Id"] = uid;
      const res = await fetch(`/api/career-paths/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(t("careerPaths.deleteFailed"));
      qc.invalidateQueries({ queryKey: getListCareerPathsQueryKey() });
      toast({ title: t("careerPaths.deleted") });
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    }
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ name: "", field: "", duration: "", description: "" });
  const [stages, setStages] = useState<StageRow[]>([{ ...emptyStage }]);
  const [collapsedStages, setCollapsedStages] = useState<Record<number, boolean>>({0: true});

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", field: "", duration: "", description: "" });
    setStages([{ ...emptyStage }]);
    setCollapsedStages({0: true});
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
    const mapped = r.stages && r.stages.length
      ? r.stages.map((s) => ({
            title: s.title,
            level: s.level ?? "",
            gradeNum: s.gradeNum ?? "",
            durationInRole: s.durationInRole ?? "",
            description: s.description ?? "",
            requiredCompetencies: (s.requiredCompetencies ?? []).join("، "),
            promotionCriteria: (s.promotionCriteria ?? []).join("، "),
          }))
      : [{ ...emptyStage }];
    setStages(mapped);
    setCollapsedStages(Object.fromEntries(mapped.map((_, i) => [i, true])));
    setOpen(true);
  };

  const setStage = (i: number, patch: Partial<StageRow>) =>
    setStages((ss) => ss.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const submit = () => {
    if (!form.name.trim()) {
      toast({ title: t("careerPaths.nameRequired"), variant: "destructive" });
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
      toast({ title: editing ? t("careerPaths.updated") : t("careerPaths.created") });
      setOpen(false);
      qc.invalidateQueries({ queryKey: getListCareerPathsQueryKey() });
    };
    const onError = () => toast({ title: t("common.genericError"), variant: "destructive" });
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("careerPaths.title")}</h1>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setAiOpen(true); setAiField(""); }}>
              <Sparkles className="w-4 h-4 ml-2" />
              {t("common.aiGenerate")}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 ml-2" />
              {t("careerPaths.addPath")}
            </Button>
          </div>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("careerPaths.list")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t("common.name")}</TableHead>
                  <TableHead className="text-right">{t("careerPaths.field")}</TableHead>
                  <TableHead className="text-right">{t("careerPaths.stageCount")}</TableHead>
                  {canManage && <TableHead className="text-right">{t("common.actions")}</TableHead>}
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
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDeletePath({ id: path.id, name: path.name })}>
                          <Trash2 className="w-4 h-4" />
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

      {/* Timeline View */}
      {paths && paths.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">{t("careerPaths.viewStages")}</h2>
          {paths.map((path) => {
            const p = path as Row;
            if (!p.stages || p.stages.length === 0) return null;
            return (
              <Card key={p.id} className="p-4">
                <h3 className="text-sm font-bold mb-3">{p.name} {p.field && `— ${p.field}`}</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {p.stages!.map((s, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-44 rounded-lg border p-3 text-xs space-y-1"
                      style={{
                        borderColor: `hsl(${210 + i * 30}, 60%, 50%)`,
                        background: `hsl(${210 + i * 30}, 60%, 97%)`,
                      }}
                    >
                      <div className="font-bold text-sm">{s.title}</div>
                      {s.level && <div className="text-muted-foreground">{t("careerPaths.stageLevel")} {s.level}</div>}
                      {s.gradeNum && <div className="text-muted-foreground">{t("careerPaths.stageGrade")} {s.gradeNum}</div>}
                      {s.durationInRole && <div className="text-muted-foreground">{t("careerPaths.stageDuration")} {s.durationInRole}</div>}
                      {i < p.stages!.length - 1 && (
                        <div className="text-center text-lg text-muted-foreground">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? t("careerPaths.editPath") : t("careerPaths.addPathTitle")}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t("careerPaths.pathName")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <TextField label={t("careerPaths.field")} value={form.field} onChange={(v) => setForm({ ...form, field: v })} />
          <TextField label={t("careerPaths.duration")} value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} />
        </div>
        <TextAreaField label={t("common.description")} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />

        <div className="space-y-2">
          <Label>{t("careerPaths.stages")}</Label>
          {stages.map((s, i) => {
            const isCollapsed = collapsedStages[i] ?? true;
            const toggleCollapse = () => setCollapsedStages(prev => ({ ...prev, [i]: !prev[i] }));
            return (
            <div key={i} className="rounded-lg border-2 border-border shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex w-full items-center justify-between p-3 bg-muted/60 hover:bg-muted transition-colors border-b border-border"
              >
                <span className="text-sm font-bold">{t("careerPaths.stageN", { n: i + 1 })}{s.title ? ` — ${s.title}` : ""}</span>
                <div className="flex items-center gap-2">
                  {stages.length > 1 && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setStages(stages.filter((_, idx) => idx !== i)); }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </span>
                  )}
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              {!isCollapsed && (
              <div className="p-4 space-y-3 bg-background">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("careerPaths.stageTitle")}</Label>
                  <Input value={s.title} onChange={(e) => setStage(i, { title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("careerPaths.stageLevel")}</Label>
                  <Input value={s.level} onChange={(e) => setStage(i, { level: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("careerPaths.stageGradeLabel")}</Label>
                  <Input value={s.gradeNum} onChange={(e) => setStage(i, { gradeNum: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("careerPaths.stageDurationLabel")}</Label>
                  <Input value={s.durationInRole} onChange={(e) => setStage(i, { durationInRole: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("careerPaths.stageDescription")}</Label>
                <Textarea rows={2} value={s.description} onChange={(e) => setStage(i, { description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("careerPaths.stageCompetencies")}</Label>
                <Textarea
                  rows={2}
                  value={s.requiredCompetencies}
                  onChange={(e) => setStage(i, { requiredCompetencies: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("careerPaths.stageCriteria")}</Label>
                <Textarea
                  rows={2}
                  value={s.promotionCriteria}
                  onChange={(e) => setStage(i, { promotionCriteria: e.target.value })}
                />
              </div>
              </div>
              )}
            </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const newIdx = stages.length;
              setStages([...stages, { ...emptyStage }]);
              setCollapsedStages(prev => ({ ...prev, [newIdx]: false }));
            }}
            className="w-full rounded-md border-2 border-dashed border-primary/40 py-3 text-sm font-medium text-primary hover:bg-primary/5 hover:border-primary transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> {t("careerPaths.addStage")}
          </button>
        </div>
      </FormDialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("careerPaths.aiTitle")}</DialogTitle>
            <DialogDescription>{t("careerPaths.aiDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TextField label={t("careerPaths.field")} value={aiField} onChange={setAiField} required />
            <Button
              disabled={!aiField.trim() || generate.isPending}
              className="w-full"
              onClick={() => {
                generate.mutate(
                  { data: { field: aiField.trim() } },
                  {
                    onSuccess: (res) => {
                      const stgs = (res.stages ?? []).map((s) => ({
                        title: s.title,
                        level: s.level ?? "",
                        gradeNum: s.gradeNum ?? "",
                        durationInRole: s.durationInRole ?? "",
                        description: s.description ?? "",
                        requiredCompetencies: (s.requiredCompetencies ?? []).join("، "),
                        promotionCriteria: (s.promotionCriteria ?? []).join("، "),
                      }));
                      setForm({
                        name: res.name ?? "",
                        field: res.field ?? aiField,
                        duration: res.duration ?? "",
                        description: res.description ?? "",
                      });
                      setStages(stgs.length ? stgs : [{ ...emptyStage }]);
                      setCollapsedStages(Object.fromEntries((stgs.length ? stgs : [emptyStage]).map((_, i) => [i, true])));
                      setEditing(null);
                      setAiOpen(false);
                      setOpen(true);
                      toast({ title: t("careerPaths.aiSuccess") });
                    },
                    onError: () =>
                      toast({ title: t("common.aiFailed"), variant: "destructive" }),
                  },
                );
              }}
            >
              {generate.isPending ? <Loader2 className="size-4 animate-spin ml-2" /> : <Sparkles className="size-4 ml-2" />}
              {t("common.generate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDeletePath} onOpenChange={(o) => !o && setToDeletePath(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("careerPaths.deletePathTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("careerPaths.deletePathDesc", { name: toDeletePath?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDeletePath) handleDelete(toDeletePath.id);
                setToDeletePath(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
