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
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";
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

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);

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
                  {canManage && <TableHead className="text-right">إجراءات</TableHead>}
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
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(job as Row)}>
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
    </div>
  );
}
