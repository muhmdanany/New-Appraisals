import { useState } from "react";
import { useListGrades, useCreateGrade, getListGradesQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { FormDialog, TextField, NumberField, useCanManage } from "@/components/form-fields";

const numOrUndef = (s: string) => (s.trim() === "" ? undefined : Number(s));

type LevelRow = { level: string; label: string; minScore: string; stayYears: string; competencies: string };
const emptyLevel: LevelRow = { level: "1", label: "", minScore: "85", stayYears: "", competencies: "" };

export default function Grades() {
  const { data: grades, isLoading } = useListGrades();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const create = useCreateGrade();
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/grades/${id}`, {
        method: "DELETE",
        headers: { "X-User-Id": localStorage.getItem("selectedUserId") ?? "" },
      }).then((r) => { if (!r.ok) throw new Error("Delete failed"); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListGradesQueryKey() }); toast({ title: "تم الحذف" }); },
    onError: () => toast({ title: "فشل الحذف — قد تكون الدرجة مرتبطة بموظفين", variant: "destructive" }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ num: "", name: "", classification: "", leaveDays: "21" });
  const [levels, setLevels] = useState<LevelRow[]>([{ ...emptyLevel }]);

  const openCreate = () => {
    setForm({ num: "", name: "", classification: "", leaveDays: "21" });
    setLevels([{ ...emptyLevel }]);
    setOpen(true);
  };

  const setLevel = (i: number, patch: Partial<LevelRow>) =>
    setLevels((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = () => {
    if (!form.num.trim() || !form.name.trim()) {
      toast({ title: "رقم الدرجة والاسم مطلوبان", variant: "destructive" });
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
    create.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "تمت إضافة الدرجة" });
          setOpen(false);
          qc.invalidateQueries({ queryKey: getListGradesQueryKey() });
        },
        onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">الدرجات الوظيفية</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة درجة
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة الدرجات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الدرجة</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  {canManage && <TableHead className="w-16">إجراءات</TableHead>}
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
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("هل أنت متأكد من حذف هذه الدرجة؟")) deleteMut.mutate(grade.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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
        title="إضافة درجة وظيفية"
        onSubmit={submit}
        submitting={create.isPending}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField label="رقم الدرجة" value={form.num} onChange={(v) => setForm({ ...form, num: v })} required />
          <TextField label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <TextField
            label="التصنيف"
            value={form.classification}
            onChange={(v) => setForm({ ...form, classification: v })}
          />
          <NumberField label="أيام الإجازة" value={form.leaveDays} onChange={(v) => setForm({ ...form, leaveDays: v })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>المستويات</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setLevels([...levels, { ...emptyLevel, level: String(levels.length + 1) }])}>
              <Plus className="w-4 h-4 ml-1" /> مستوى
            </Button>
          </div>
          {levels.map((l, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">مستوى {i + 1}</span>
                {levels.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setLevels(levels.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">المسمى</Label>
                  <Input value={l.label} onChange={(e) => setLevel(i, { label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">رقم المستوى</Label>
                  <Input type="number" value={l.level} onChange={(e) => setLevel(i, { level: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الحد الأدنى للدرجة</Label>
                  <Input type="number" value={l.minScore} onChange={(e) => setLevel(i, { minScore: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">سنوات البقاء</Label>
                  <Input type="number" value={l.stayYears} onChange={(e) => setLevel(i, { stayYears: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الجدارات المطلوبة</Label>
                <Input value={l.competencies} onChange={(e) => setLevel(i, { competencies: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </FormDialog>
    </div>
  );
}
