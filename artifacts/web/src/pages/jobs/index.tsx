import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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

const CONTRACT_TYPE_KEYS = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY"] as const;

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
  const { t } = useTranslation();
  const CONTRACT_TYPES = CONTRACT_TYPE_KEYS.map((k) => ({ value: k, label: t(`jobs.contractTypes.${k}`) }));
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: getListJobsQueryKey() }); toast({ title: t("jobs.deleted") }); },
    onError: () => toast({ title: t("jobs.deleteFailed"), variant: "destructive" }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [profileJob, setProfileJob] = useState<Row | null>(null);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

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
      toast({ title: t("jobs.titleRequired"), variant: "destructive" });
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
      toast({ title: editing ? t("jobs.updated") : t("jobs.created") });
      setOpen(false);
      qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
    };
    const onError = () => toast({ title: t("common.genericError"), variant: "destructive" });
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("jobs.title")}</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            {t("jobs.addJob")}
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("jobs.jobList")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t("jobs.jobTitle")}</TableHead>
                  <TableHead className="text-right">{t("jobs.department")}</TableHead>
                  <TableHead className="text-right">{t("jobs.grade")}</TableHead>
                  <TableHead className="text-right">{t("jobs.contractType")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
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
                        <Button variant="ghost" size="icon" title={t("jobs.jobProfile")} onClick={() => setProfileJob(job as Row)}>
                          <FileText className="w-4 h-4" />
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(job as Row)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => setToDeleteId(job.id)}>
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
        title={editing ? t("jobs.editJob") : t("jobs.addJob")}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t("jobs.jobTitle")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <SelectField
            label={t("jobs.contractType")}
            value={form.contractType}
            onChange={(v) => setForm({ ...form, contractType: v })}
            options={CONTRACT_TYPES}
          />
          <SelectField
            label={t("jobs.department")}
            value={form.departmentId}
            onChange={(v) => setForm({ ...form, departmentId: v })}
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            allowEmpty
          />
          <SelectField
            label={t("jobs.grade")}
            value={form.gradeId}
            onChange={(v) => setForm({ ...form, gradeId: v })}
            options={(grades ?? []).map((g) => ({ value: g.id, label: `${g.num} - ${g.name}` }))}
            allowEmpty
          />
          <TextField
            label={t("jobs.expLevel")}
            value={form.experienceLevel}
            onChange={(v) => setForm({ ...form, experienceLevel: v })}
          />
          <SelectField
            label={t("jobs.reportsTo")}
            value={form.reportsToJobId}
            onChange={(v) => setForm({ ...form, reportsToJobId: v })}
            options={(jobs ?? []).filter((j) => j.id !== editing?.id).map((j) => ({ value: j.id, label: j.name }))}
            allowEmpty
          />
        </div>
        <TextAreaField
          label={t("jobs.description")}
          value={form.description}
          onChange={(v) => setForm({ ...form, description: v })}
        />
        <MultiSelectField
          label={t("jobs.linkedCompetencies")}
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
              <span>{t("jobs.jobProfile")}</span>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
                {t("common.printPDF")}
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
                  <div><span className="text-muted-foreground">{t("jobs.grade")}:</span> {grade ? `${grade.num} - ${grade.name}` : "—"}</div>
                  <div><span className="text-muted-foreground">{t("jobs.contractType")}:</span> {CONTRACT_TYPES.find((c) => c.value === profileJob.contractType)?.label ?? "—"}</div>
                  <div><span className="text-muted-foreground">{t("jobs.expLevel")}:</span> {profileJob.experienceLevel ?? "—"}</div>
                  <div><span className="text-muted-foreground">{t("jobs.reportsTo")}:</span> {reportsTo?.name ?? "—"}</div>
                </div>
                {profileJob.description && (
                  <div>
                    <div className="font-bold mb-1">{t("jobs.jobDescription")}</div>
                    <p className="text-muted-foreground whitespace-pre-wrap">{profileJob.description}</p>
                  </div>
                )}
                {jobComps.length > 0 && (
                  <div>
                    <div className="font-bold mb-1">{t("jobs.requiredCompetencies")}</div>
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

      <AlertDialog open={!!toDeleteId} onOpenChange={(o) => !o && setToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("jobs.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDeleteId) deleteMut.mutate(toDeleteId);
                setToDeleteId(null);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
