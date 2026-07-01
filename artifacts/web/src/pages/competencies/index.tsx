import { useState } from "react";
import {
  useListCompetencies,
  useCreateCompetency,
  useUpdateCompetency,
  useDeleteCompetency,
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { FormDialog, TextField, TextAreaField, SelectField, useCanManage } from "@/components/form-fields";

const TYPE_OPTIONS = [
  { value: "BEHAVIORAL", label: "سلوكية" },
  { value: "LEADERSHIP", label: "قيادية" },
  { value: "TECHNICAL", label: "فنية" },
];
const typeLabel = (t: string) => TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
const LEVEL_OPTIONS = [
  { value: "BASIC", label: "أساسي" },
  { value: "INTERMEDIATE", label: "متوسط" },
  { value: "ADVANCED", label: "متقدم" },
  { value: "EXPERT", label: "خبير" },
];
const levelLabel = (l: string) => LEVEL_OPTIONS.find((o) => o.value === l)?.label ?? l;

type Row = { id: string; name: string; type: string; level: string; description?: string | null; indicators?: string | null };

const empty = { name: "", type: "BEHAVIORAL", level: "BASIC", description: "", indicators: "" };

export default function Competencies() {
  const { data: competencies, isLoading } = useListCompetencies();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCompetenciesQueryKey() });
  const create = useCreateCompetency();
  const update = useUpdateCompetency();
  const del = useDeleteCompetency();

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
      toast({ title: "الاسم مطلوب", variant: "destructive" });
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
      toast({ title: editing ? "تم تحديث الجدارة" : "تمت إضافة الجدارة" });
      setOpen(false);
      invalidate();
    };
    const onError = () => toast({ title: "حدث خطأ", variant: "destructive" });
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    del.mutate(
      { id: toDelete.id },
      {
        onSuccess: () => {
          toast({ title: "تم حذف الجدارة" });
          setToDelete(null);
          invalidate();
        },
        onError: () => {
          toast({ title: "تعذّر الحذف", variant: "destructive" });
          setToDelete(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">الجدارات</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة جدارة
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة الجدارات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الجدارة</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المستوى</TableHead>
                  {canManage && <TableHead className="text-right">إجراءات</TableHead>}
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
        title={editing ? "تعديل جدارة" : "إضافة جدارة"}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
      >
        <TextField label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <SelectField
          label="النوع"
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          options={TYPE_OPTIONS}
          required
        />
        <SelectField
          label="المستوى"
          value={form.level}
          onChange={(v) => setForm({ ...form, level: v })}
          options={LEVEL_OPTIONS}
        />
        <TextAreaField label="الوصف" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <TextAreaField
          label="المؤشرات"
          value={form.indicators}
          onChange={(v) => setForm({ ...form, indicators: v })}
        />
      </FormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الجدارة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف «{toDelete?.name}»؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
