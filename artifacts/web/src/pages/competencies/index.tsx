import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  useListCompetencies,
  useCreateCompetency,
  useUpdateCompetency,
  useDeleteCompetency,
  useListJobs,
  useGenerateCompetencies,
  useImportCompetencies,
  getListCompetenciesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Sparkles, Loader2, Upload } from "lucide-react";
import { FormDialog, TextField, TextAreaField, SelectField, useCanManage } from "@/components/form-fields";

const FALLBACK_TYPES = [
  { value: "BEHAVIORAL", label: "سلوكية" },
  { value: "LEADERSHIP", label: "قيادية" },
  { value: "TECHNICAL", label: "فنية" },
];
const FALLBACK_LEVELS = [
  { value: "BASIC", label: "أساسي" },
  { value: "INTERMEDIATE", label: "متوسط" },
  { value: "ADVANCED", label: "متقدم" },
  { value: "EXPERT", label: "خبير" },
];

function useFieldOptions() {
  const [types, setTypes] = useState(FALLBACK_TYPES);
  const [levels, setLevels] = useState(FALLBACK_LEVELS);
  useEffect(() => {
    fetch("/api/settings/field-options", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.competencyTypes?.length)
          setTypes(data.competencyTypes.filter((o: any) => o.active).map((o: any) => ({ value: o.value, label: o.label })));
        if (data.competencyLevels?.length)
          setLevels(data.competencyLevels.filter((o: any) => o.active).map((o: any) => ({ value: o.value, label: o.label })));
      })
      .catch(() => {});
  }, []);
  return { types, levels };
}

type Row = { id: string; name: string; type: string; level: string; description?: string | null; indicators?: string | null };

const empty = { name: "", type: "BEHAVIORAL", level: "BASIC", description: "", indicators: "" };

export default function Competencies() {
  const { data: competencies, isLoading } = useListCompetencies();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const { t } = useTranslation();
  const importMut = useImportCompetencies();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { types: TYPE_OPTIONS, levels: LEVEL_OPTIONS } = useFieldOptions();
  const typeLabel = (v: string) => TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
  const levelLabel = (l: string) => LEVEL_OPTIONS.find((o) => o.value === l)?.label ?? l;

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const uid = localStorage.getItem("selectedUserId");
    fetch("/api/competencies/import", {
      method: "POST",
      headers: uid ? { "X-User-Id": uid } : {},
      body: formData,
    })
      .then((res) => { if (!res.ok) throw new Error(t("competencies.importFailed")); return res.json(); })
      .then((data) => {
        toast({ title: t("competencies.importSuccess", { count: data.imported ?? "" }) });
        qc.invalidateQueries({ queryKey: getListCompetenciesQueryKey() });
      })
      .catch((err) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }));
    e.target.value = "";
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCompetenciesQueryKey() });
  const create = useCreateCompetency();
  const update = useUpdateCompetency();
  const del = useDeleteCompetency();
  const generate = useGenerateCompetencies();
  const { data: jobs } = useListJobs();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiJobId, setAiJobId] = useState("");
  const [aiResults, setAiResults] = useState<{ name: string; type: string; level?: string; description?: string; indicators?: string }[]>([]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      name: r.name,
      type: r.type,
      level: r.level ?? "",
      description: r.description ?? "",
      indicators: r.indicators ?? "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast({ title: t("competencies.nameRequired"), variant: "destructive" });
      return;
    }
    const data = {
      name: form.name,
      type: form.type,
      level: form.level || undefined,
      description: form.description || undefined,
      indicators: form.indicators || undefined,
    };
    const onSuccess = () => {
      toast({ title: editing ? t("competencies.updated") : t("competencies.created") });
      setOpen(false);
      invalidate();
    };
    const onError = () => toast({ title: t("common.genericError"), variant: "destructive" });
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    del.mutate(
      { id: toDelete.id },
      {
        onSuccess: () => {
          toast({ title: t("competencies.deleted") });
          setToDelete(null);
          invalidate();
        },
        onError: () => {
          toast({ title: t("competencies.deleteFailed"), variant: "destructive" });
          setToDelete(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("competencies.title")}</h1>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 ml-2" />
              {t("common.importLabel")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" onClick={() => { setAiOpen(true); setAiResults([]); setAiJobId(""); }}>
              <Sparkles className="w-4 h-4 ml-2" />
              {t("common.aiGenerate")}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 ml-2" />
              {t("competencies.addCompetency")}
            </Button>
          </div>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("competencies.list")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t("competencies.competency")}</TableHead>
                  <TableHead className="text-right">{t("competencies.type")}</TableHead>
                  <TableHead className="text-right">{t("competencies.level")}</TableHead>
                  {canManage && <TableHead className="text-right">{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {competencies?.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell>{comp.name}</TableCell>
                    <TableCell>{typeLabel(comp.type)}</TableCell>
                    <TableCell>{levelLabel(comp.level)}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(comp as Row)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(comp as Row)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
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
        title={editing ? t("competencies.editCompetency") : t("competencies.addCompetency")}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
      >
        <TextField label={t("common.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <SelectField
          label={t("competencies.type")}
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          options={TYPE_OPTIONS}
          required
        />
        <SelectField
          label={t("competencies.level")}
          value={form.level}
          onChange={(v) => setForm({ ...form, level: v })}
          options={LEVEL_OPTIONS}
        />
        <TextAreaField label={t("common.description")} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <TextAreaField
          label={t("competencies.indicators")}
          value={form.indicators}
          onChange={(v) => setForm({ ...form, indicators: v })}
        />
      </FormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("competencies.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("competencies.deleteDesc", { name: toDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("competencies.aiTitle")}</DialogTitle>
            <DialogDescription>{t("competencies.aiDesc")}</DialogDescription>
          </DialogHeader>
          {aiResults.length === 0 ? (
            <div className="space-y-3">
              <SelectField
                label={t("competencies.aiJob")}
                value={aiJobId}
                onChange={setAiJobId}
                options={(jobs ?? []).map((j: any) => ({ value: j.id, label: j.name }))}
                required
              />
              <Button
                disabled={!aiJobId || generate.isPending}
                className="w-full"
                onClick={() => {
                  generate.mutate(
                    { data: { jobId: aiJobId } },
                    {
                      onSuccess: (res) => setAiResults(res.competencies ?? []),
                      onError: () => toast({ title: t("common.aiFailed"), variant: "destructive" }),
                    },
                  );
                }}
              >
                {generate.isPending ? <Loader2 className="size-4 animate-spin ml-2" /> : <Sparkles className="size-4 ml-2" />}
                {t("common.generate")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {aiResults.map((r, i) => (
                <Card key={i} className="p-3 text-sm">
                  <div className="font-bold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{typeLabel(r.type)} · {r.level ? levelLabel(r.level) : "—"}</div>
                  {r.description && <div className="text-xs mt-1">{r.description}</div>}
                </Card>
              ))}
            </div>
          )}
          {aiResults.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAiResults([])}>{t("common.regenerate")}</Button>
              <Button
                onClick={() => {
                  Promise.all(
                    aiResults.map((r) =>
                      create.mutateAsync({
                        data: {
                          name: r.name,
                          type: r.type,
                          level: r.level || undefined,
                          description: r.description || undefined,
                          indicators: r.indicators || undefined,
                        },
                      }),
                    ),
                  ).then(() => {
                    toast({ title: t("competencies.aiGenerated", { count: aiResults.length }) });
                    setAiOpen(false);
                    invalidate();
                  });
                }}
              >
                {t("competencies.saveAll", { count: aiResults.length })}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
