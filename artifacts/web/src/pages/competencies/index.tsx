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
import { Plus, Pencil, Trash2, Sparkles, Loader2, Upload, Settings2, X, Eye, EyeOff } from "lucide-react";
import { FormDialog, TextField, TextAreaField, SelectField, useCanManage } from "@/components/form-fields";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

type FieldOption = { value: string; label: string; active: boolean };

function useFieldOptions() {
  const [allTypes, setAllTypes] = useState<FieldOption[]>([]);
  const [allLevels, setAllLevels] = useState<FieldOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    const uid = localStorage.getItem("selectedUserId");
    const h: Record<string, string> = {};
    if (uid) h["X-User-Id"] = uid;
    fetch("/api/settings/field-options", { headers: h })
      .then((r) => r.json())
      .then((data) => {
        if (data.competencyTypes?.length) setAllTypes(data.competencyTypes);
        else setAllTypes(FALLBACK_TYPES.map((o) => ({ ...o, active: true })));
        if (data.competencyLevels?.length) setAllLevels(data.competencyLevels);
        else setAllLevels(FALLBACK_LEVELS.map((o) => ({ ...o, active: true })));
        setLoaded(true);
      })
      .catch(() => {
        setAllTypes(FALLBACK_TYPES.map((o) => ({ ...o, active: true })));
        setAllLevels(FALLBACK_LEVELS.map((o) => ({ ...o, active: true })));
        setLoaded(true);
      });
  };

  useEffect(() => { load(); }, []);

  const save = async (newTypes: FieldOption[], newLevels: FieldOption[]) => {
    const uid = localStorage.getItem("selectedUserId");
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (uid) h["X-User-Id"] = uid;
    await fetch("/api/settings/field-options", {
      method: "PUT",
      headers: h,
      body: JSON.stringify({ competencyTypes: newTypes, competencyLevels: newLevels }),
    });
  };

  const types = allTypes.filter((o) => o.active);
  const levels = allLevels.filter((o) => o.active);

  const updateTypes = async (newTypes: FieldOption[]) => {
    setAllTypes(newTypes);
    await save(newTypes, allLevels);
  };
  const updateLevels = async (newLevels: FieldOption[]) => {
    setAllLevels(newLevels);
    await save(allTypes, newLevels);
  };

  return { types, levels, allTypes, allLevels, updateTypes, updateLevels, loaded };
}

/* ── Inline-manageable select field ── */
function ManageableSelect({
  label,
  value,
  onChange,
  allOptions,
  onUpdateOptions,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allOptions: FieldOption[];
  onUpdateOptions: (opts: FieldOption[]) => void;
  required?: boolean;
}) {
  const [managing, setManaging] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const activeOptions = allOptions.filter((o) => o.active);

  const addOption = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const val = trimmed.toUpperCase().replace(/\s+/g, "_");
    if (allOptions.some((o) => o.value === val)) return;
    onUpdateOptions([...allOptions, { value: val, label: trimmed, active: true }]);
    setNewLabel("");
  };

  const toggleOption = (val: string) => {
    onUpdateOptions(allOptions.map((o) => o.value === val ? { ...o, active: !o.active } : o));
  };

  const removeOption = (val: string) => {
    onUpdateOptions(allOptions.filter((o) => o.value !== val));
  };

  if (managing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setManaging(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="rounded-md border border-border p-2 space-y-1.5 max-h-48 overflow-y-auto">
          {allOptions.map((opt) => (
            <div key={opt.value} className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50">
              <span className={`text-sm ${!opt.active ? "text-muted-foreground line-through" : ""}`}>{opt.label}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => toggleOption(opt.value)} className="p-1 rounded hover:bg-muted" title={opt.active ? "إخفاء" : "إظهار"}>
                  {opt.active ? <Eye className="w-3.5 h-3.5 text-green-600" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <button type="button" onClick={() => removeOption(opt.value)} className="p-1 rounded hover:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="اسم الخيار الجديد..."
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
            />
            <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={addOption} disabled={!newLabel.trim()}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
        <button type="button" onClick={() => setManaging(true)} className="text-muted-foreground hover:text-foreground transition-colors" title="إدارة الخيارات">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
      <Select value={value === "" ? undefined : value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
        <SelectContent>
          {activeOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
  const { types: TYPE_OPTIONS, levels: LEVEL_OPTIONS, allTypes, allLevels, updateTypes, updateLevels } = useFieldOptions();
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
        <ManageableSelect
          label={t("competencies.type")}
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          allOptions={allTypes}
          onUpdateOptions={updateTypes}
          required
        />
        <ManageableSelect
          label={t("competencies.level")}
          value={form.level}
          onChange={(v) => setForm({ ...form, level: v })}
          allOptions={allLevels}
          onUpdateOptions={updateLevels}
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
