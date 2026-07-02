import { useState, useRef } from "react";
import { useTranslation } from "@/lib/i18n";
import { useListGrades, useCreateGrade, getListGradesQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Upload } from "lucide-react";
import { FormDialog, TextField, NumberField, useCanManage } from "@/components/form-fields";
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

const numOrUndef = (s: string) => (s.trim() === "" ? undefined : Number(s));

type LevelRow = { level: string; label: string; minScore: string; stayYears: string; competencies: string };
const emptyLevel: LevelRow = { level: "1", label: "", minScore: "85", stayYears: "", competencies: "" };

export default function Grades() {
  const { data: grades, isLoading } = useListGrades();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const uid = localStorage.getItem("selectedUserId");
    fetch("/api/grades/import", {
      method: "POST",
      headers: uid ? { "X-User-Id": uid } : {},
      body: formData,
    })
      .then((res) => { if (!res.ok) throw new Error(t("grades.importFailed")); return res.json(); })
      .then((data) => {
        toast({ title: t("grades.importSuccess", { count: data.imported ?? "" }) });
        qc.invalidateQueries({ queryKey: getListGradesQueryKey() });
      })
      .catch((err) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }));
    e.target.value = "";
  };
  const create = useCreateGrade();
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/grades/${id}`, {
        method: "DELETE",
        headers: { "X-User-Id": localStorage.getItem("selectedUserId") ?? "" },
      }).then((r) => { if (!r.ok) throw new Error("Delete failed"); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListGradesQueryKey() }); toast({ title: t("grades.deleted") }); },
    onError: () => toast({ title: t("grades.deleteFailed"), variant: "destructive" }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ num: "", name: "", classification: "", leaveDays: "21" });
  const [levels, setLevels] = useState<LevelRow[]>([{ ...emptyLevel }]);
  const [toDelete, setToDelete] = useState<any>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ num: "", name: "", classification: "", leaveDays: "21" });
    setLevels([{ ...emptyLevel }]);
    setOpen(true);
  };

  const openEdit = (grade: any) => {
    setEditing(grade);
    setForm({
      num: grade.num || "",
      name: grade.name || "",
      classification: grade.classification || "",
      leaveDays: String(grade.leaveDays ?? 21),
    });
    setLevels(
      grade.levels?.length
        ? grade.levels.map((l: any) => ({
            level: String(l.level ?? 1),
            label: l.label || "",
            minScore: String(l.minScore ?? 85),
            stayYears: String(l.stayYears ?? ""),
            competencies: l.competencies || "",
          }))
        : [{ ...emptyLevel }],
    );
    setOpen(true);
  };

  const setLevel = (i: number, patch: Partial<LevelRow>) =>
    setLevels((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = () => {
    if (!form.num.trim() || !form.name.trim()) {
      toast({ title: t("grades.numNameRequired"), variant: "destructive" });
      return;
    }
    const data = {
      num: form.num,
      name: form.name,
      classification: form.classification || undefined,
      leaveDays: numOrUndef(form.leaveDays),
      levels: levels
        .filter((l) => l.label.trim())
        .map((l) => ({
          level: Number(l.level) || 1,
          label: l.label,
          minScore: numOrUndef(l.minScore),
          stayYears: numOrUndef(l.stayYears),
          competencies: l.competencies || undefined,
        })),
    };
    // UpsertGrade handles both create and update via ON CONFLICT(num)
    create.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: editing ? t("grades.updated") : t("grades.created") });
          setOpen(false);
          qc.invalidateQueries({ queryKey: getListGradesQueryKey() });
        },
        onError: () => toast({ title: t("common.genericError"), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("grades.title")}</h1>
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
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 ml-2" />
              {t("grades.addGrade")}
            </Button>
          </div>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("grades.list")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t("grades.grade")}</TableHead>
                  <TableHead className="text-right">{t("common.name")}</TableHead>
                  <TableHead className="text-right">{t("grades.classification")}</TableHead>
                  {canManage && <TableHead className="w-16">{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades?.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>{grade.num}</TableCell>
                    <TableCell>{grade.name}</TableCell>
                    <TableCell>{grade.classification}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(grade)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(grade)}>
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
        title={editing ? t("grades.editGrade") : t("grades.addGradeTitle")}
        onSubmit={submit}
        submitting={create.isPending}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t("grades.gradeNum")} value={form.num} onChange={(v) => setForm({ ...form, num: v })} required />
          <TextField label={t("common.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <TextField
            label={t("grades.classification")}
            value={form.classification}
            onChange={(v) => setForm({ ...form, classification: v })}
          />
          <NumberField label={t("grades.leaveDays")} value={form.leaveDays} onChange={(v) => setForm({ ...form, leaveDays: v })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("grades.levels")}</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setLevels([...levels, { ...emptyLevel, level: String(levels.length + 1) }])}>
              <Plus className="w-4 h-4 ml-1" /> {t("grades.addLevel")}
            </Button>
          </div>
          {levels.map((l, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("grades.levelN", { n: i + 1 })}</span>
                {levels.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setLevels(levels.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("grades.levelTitle")}</Label>
                  <Input value={l.label} onChange={(e) => setLevel(i, { label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("grades.levelNum")}</Label>
                  <Input type="number" value={l.level} onChange={(e) => setLevel(i, { level: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("grades.minScore")}</Label>
                  <Input type="number" value={l.minScore} onChange={(e) => setLevel(i, { minScore: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("grades.stayYears")}</Label>
                  <Input type="number" value={l.stayYears} onChange={(e) => setLevel(i, { stayYears: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("grades.requiredCompetencies")}</Label>
                <Input value={l.competencies} onChange={(e) => setLevel(i, { competencies: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </FormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("grades.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("grades.deleteDesc", { name: toDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) deleteMut.mutate(toDelete.id);
                setToDelete(null);
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
