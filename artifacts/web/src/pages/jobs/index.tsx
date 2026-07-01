import { useState } from "react";
import {
  useListJobs,
  useCreateJob,
  useUpdateJob,
  useListDepartments,
  useListGrades,
  useListCompetencies,
  getListJobsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, FileText, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FormDialog,
  TextField,
  TextAreaField,
  SelectField,
  MultiSelectField,
  useCanManage,
} from "@/components/form-fields";

type Row = {
  id: string;
  name: string;
  description?: string | null;
  contractType?: string | null;
  experienceLevel?: string | null;
  departmentId?: string | null;
  gradeId?: string | null;
  reportsToJobId?: string | null;
  competencyIds?: string[] | null;
};

const CONTRACT_TYPES = [
  { value: "FULL_TIME", label: "دوام كامل" },
  { value: "PART_TIME", label: "دوام جزئي" },
  { value: "CONTRACT", label: "عقد" },
  { value: "TEMPORARY", label: "مؤقت" },
];

const empty = {
  name: "",
  description: "",
  contractType: "FULL_TIME",
  experienceLevel: "",
  departmentId: "",
  gradeId: "",
  reportsToJobId: "",
  competencyIds: [] as string[],
};

export default function Jobs() {
  const { data: jobs, isLoading } = useListJobs();
  const { data: departments } = useListDepartments();
  const { data: grades } = useListGrades();
  const { data: competencies } = useListCompetencies();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const create = useCreateJob();
  const update = useUpdateJob();
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/jobs/${id}`, {
        method: "DELETE",
        headers: { "X-User-Id": localStorage.getItem("selectedUserId") ?? "" },
      }).then((r) => { if (!r.ok) throw new Error("Delete failed"); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListJobsQueryKey() }); toast({ title: "تم الحذف" }); },
    onError: () => toast({ title: "فشل الحذف — قد تكون الوظيفة مرتبطة بموظفين", variant: "destructive" }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [profileJob, setProfileJob] = useState<Row | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? "",
      contractType: r.contractType ?? "",
      experienceLevel: r.experienceLevel ?? "",
      departmentId: r.departmentId ?? "",
      gradeId: r.gradeId ?? "",
      reportsToJobId: r.reportsToJobId ?? "",
      competencyIds: r.competencyIds ?? [],
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast({ title: "المسمى الوظيفي مطلوب", variant: "destructive" });
      return;
    }
    const data = {
      name: form.name,
      description: form.description || undefined,
      contractType: form.contractType || undefined,
      experienceLevel: form.experienceLevel || undefined,
      departmentId: form.departmentId || undefined,
      gradeId: form.gradeId || undefined,
      reportsToJobId: form.reportsToJobId || undefined,
      competencyIds: form.competencyIds,
    };
    const onSuccess = () => {
      toast({ title: editing ? "تم تحديث الوظيفة" : "تمت إضافة الوظيفة" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
    };
    const onError = () => toast({ title: "حدث خطأ", variant: "destructive" });
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">الوظائف</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة وظيفة
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة الوظائف</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المسمى الوظيفي</TableHead>
                  <TableHead className="text-right">الإدارة</TableHead>
                  <TableHead className="text-right">الدرجة</TableHead>
                  <TableHead className="text-right">نوع العقد</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs?.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.name}</TableCell>
                    <TableCell>{job.departmentName}</TableCell>
                    <TableCell>{job.gradeName}</TableCell>
                    <TableCell>
                      {CONTRACT_TYPES.find((c) => c.value === job.contractType)?.label ?? job.contractType}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="ملف الوظيفة" onClick={() => setProfileJob(job as Row)}>
                          <FileText className="w-4 h-4" />
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(job as Row)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("هل أنت متأكد من حذف هذه الوظيفة؟")) deleteMut.mutate(job.id); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
        title={editing ? "تعديل وظيفة" : "إضافة وظيفة"}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField label="المسمى الوظيفي" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <SelectField
            label="نوع العقد"
            value={form.contractType}
            onChange={(v) => setForm({ ...form, contractType: v })}
            options={CONTRACT_TYPES}
          />
          <SelectField
            label="الإدارة"
            value={form.departmentId}
            onChange={(v) => setForm({ ...form, departmentId: v })}
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            allowEmpty
          />
          <SelectField
            label="الدرجة"
            value={form.gradeId}
            onChange={(v) => setForm({ ...form, gradeId: v })}
            options={(grades ?? []).map((g) => ({ value: g.id, label: `${g.num} - ${g.name}` }))}
            allowEmpty
          />
          <TextField
            label="مستوى الخبرة"
            value={form.experienceLevel}
            onChange={(v) => setForm({ ...form, experienceLevel: v })}
          />
          <SelectField
            label="يرفع تقاريره إلى"
            value={form.reportsToJobId}
            onChange={(v) => setForm({ ...form, reportsToJobId: v })}
            options={(jobs ?? []).filter((j) => j.id !== editing?.id).map((j) => ({ value: j.id, label: j.name }))}
            allowEmpty
          />
        </div>
        <TextAreaField
          label="الوصف"
          value={form.description}
          onChange={(v) => setForm({ ...form, description: v })}
        />
        <MultiSelectField
          label="الجدارات المرتبطة"
          values={form.competencyIds}
          onChange={(v) => setForm({ ...form, competencyIds: v })}
          options={(competencies ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
      </FormDialog>

      {/* Job Profile Dialog (printable) */}
      <Dialog open={!!profileJob} onOpenChange={(o) => !o && setProfileJob(null)}>
        <DialogContent className="max-w-lg print:max-w-full print:shadow-none">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>ملف الوظيفة</span>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
                طباعة / حفظ PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          {profileJob && (() => {
            const dept = (departments ?? []).find((d) => d.id === profileJob.departmentId);
            const grade = (grades ?? []).find((g) => g.id === profileJob.gradeId);
            const reportsTo = (jobs ?? []).find((j) => j.id === profileJob.reportsToJobId);
            const jobComps = (competencies ?? []).filter((c) => profileJob.competencyIds?.includes(c.id));
            return (
              <div className="space-y-3 text-sm">
                <div className="bg-gradient-to-l from-[hsl(219_62%_15%)] to-[hsl(212_67%_24%)] rounded-lg p-4 text-white">
                  <div className="text-lg font-bold">{profileJob.name}</div>
                  {dept && <div className="text-xs text-white/70">{dept.name}</div>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">الدرجة:</span> {grade ? `${grade.num} - ${grade.name}` : "—"}</div>
                  <div><span className="text-muted-foreground">نوع العقد:</span> {CONTRACT_TYPES.find((c) => c.value === profileJob.contractType)?.label ?? "—"}</div>
                  <div><span className="text-muted-foreground">مستوى الخبرة:</span> {profileJob.experienceLevel ?? "—"}</div>
                  <div><span className="text-muted-foreground">يرفع تقاريره إلى:</span> {reportsTo?.name ?? "—"}</div>
                </div>
                {profileJob.description && (
                  <div>
                    <div className="font-bold mb-1">الوصف الوظيفي</div>
                    <p className="text-muted-foreground whitespace-pre-wrap">{profileJob.description}</p>
                  </div>
                )}
                {jobComps.length > 0 && (
                  <div>
                    <div className="font-bold mb-1">الجدارات المطلوبة</div>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {jobComps.map((c) => <li key={c.id}>{c.name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
