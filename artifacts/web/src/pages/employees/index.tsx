import { useState } from "react";
import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useListJobs,
  useListDepartments,
  useListGrades,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Eye, Trash2 } from "lucide-react";
import { FormDialog, TextField, SelectField, useCanManage } from "@/components/form-fields";

type Row = {
  id: string;
  name: string;
  employeeNumber: string;
  jobId?: string | null;
  departmentId?: string | null;
  gradeId?: string | null;
  managerId?: string | null;
};

const empty = {
  name: "",
  employeeNumber: "",
  jobId: "",
  departmentId: "",
  gradeId: "",
  managerId: "",
};

export default function Employees() {
  const { data: employees, isLoading } = useListEmployees();
  const { data: jobs } = useListJobs();
  const { data: departments } = useListDepartments();
  const { data: grades } = useListGrades();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/employees/${id}`, {
        method: "DELETE",
        headers: { "X-User-Id": localStorage.getItem("selectedUserId") ?? "" },
      }).then((r) => { if (!r.ok) throw new Error("Delete failed"); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() }); toast({ title: "تم الحذف" }); },
    onError: () => toast({ title: "فشل الحذف — قد يكون مرتبط بتقييمات", variant: "destructive" }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [detailEmp, setDetailEmp] = useState<Row | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      name: r.name,
      employeeNumber: r.employeeNumber,
      jobId: r.jobId ?? "",
      departmentId: r.departmentId ?? "",
      gradeId: r.gradeId ?? "",
      managerId: r.managerId ?? "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim() || !form.employeeNumber.trim()) {
      toast({ title: "الاسم والرقم الوظيفي مطلوبان", variant: "destructive" });
      return;
    }
    const data = {
      name: form.name,
      employeeNumber: form.employeeNumber,
      jobId: form.jobId || undefined,
      departmentId: form.departmentId || undefined,
      gradeId: form.gradeId || undefined,
      managerId: form.managerId || undefined,
    };
    const onSuccess = () => {
      toast({ title: editing ? "تم تحديث الموظف" : "تمت إضافة الموظف" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    };
    const onError = (e: unknown) => {
      const err = e as { status?: number; data?: { detail?: string } };
      const title =
        err?.status === 409
          ? err.data?.detail ?? "الرقم الوظيفي مستخدم مسبقًا"
          : "حدث خطأ";
      toast({ title, variant: "destructive" });
    };
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">الموظفين</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة موظف
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة الموظفين</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الرقم الوظيفي</TableHead>
                  <TableHead className="text-right">الوظيفة</TableHead>
                  <TableHead className="text-right">الإدارة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees?.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.employeeNumber}</TableCell>
                    <TableCell>{emp.jobName}</TableCell>
                    <TableCell>{emp.departmentName}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailEmp(emp as Row)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp as Row)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) deleteMut.mutate(emp.id); }}>
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
        title={editing ? "تعديل موظف" : "إضافة موظف"}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <TextField
            label="الرقم الوظيفي"
            value={form.employeeNumber}
            onChange={(v) => setForm({ ...form, employeeNumber: v })}
            required
          />
          <SelectField
            label="الوظيفة"
            value={form.jobId}
            onChange={(v) => setForm({ ...form, jobId: v })}
            options={(jobs ?? []).map((j) => ({ value: j.id, label: j.name }))}
            allowEmpty
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
          <SelectField
            label="المدير المباشر"
            value={form.managerId}
            onChange={(v) => setForm({ ...form, managerId: v })}
            options={(employees ?? []).filter((e) => e.id !== editing?.id).map((e) => ({ value: e.id, label: e.name }))}
            allowEmpty
          />
        </div>
      </FormDialog>

      {/* Employee Details Dialog */}
      <Dialog open={!!detailEmp} onOpenChange={(o) => !o && setDetailEmp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل الموظف</DialogTitle>
          </DialogHeader>
          {detailEmp && (() => {
            const job = (jobs ?? []).find((j) => j.id === detailEmp.jobId);
            const dept = (departments ?? []).find((d) => d.id === detailEmp.departmentId);
            const grade = (grades ?? []).find((g) => g.id === detailEmp.gradeId);
            const mgr = (employees ?? []).find((e) => e.id === detailEmp.managerId);
            return (
              <div className="space-y-3">
                <div className="bg-gradient-to-l from-[hsl(219_62%_15%)] to-[hsl(212_67%_24%)] rounded-lg p-4 text-white">
                  <div className="text-lg font-bold">{detailEmp.name}</div>
                  <div className="text-xs text-white/70">{detailEmp.employeeNumber}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">الوظيفة</div>
                    <div className="font-medium">{job?.name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">الإدارة</div>
                    <div className="font-medium">{dept?.name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">الدرجة</div>
                    <div className="font-medium">{grade ? `${grade.num} - ${grade.name}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">المدير المباشر</div>
                    <div className="font-medium">{mgr?.name ?? "—"}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
