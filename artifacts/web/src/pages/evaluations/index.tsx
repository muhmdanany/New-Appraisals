import { useState } from "react";
import { Link } from "wouter";
import {
  useListEvaluations,
  useListEmployees,
  useEvaluationFormData,
  useCreateEvaluation,
  getEvaluationFormDataQueryKey,
  getListEvaluationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField, useCanManage } from "@/components/form-fields";

const MODE_OPTIONS = [
  { value: "BOTH", label: "الجدارات المشتركة والتخصصية" },
  { value: "SHARED", label: "الجدارات المشتركة فقط" },
  { value: "SPECIFIC", label: "الجدارات التخصصية فقط" },
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  ACKNOWLEDGED: "تم الاطلاع",
  OBJECTED: "معترض عليه",
};

function ScoreInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="number"
      min={0}
      max={100}
      className="w-24"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function EvaluationFormBody({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useEvaluationFormData(
    { employeeId },
    { query: { queryKey: getEvaluationFormDataQueryKey({ employeeId }) } },
  );
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateEvaluation();

  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [mode, setMode] = useState("BOTH");
  const [kpiWeight, setKpiWeight] = useState("50");
  const [shared, setShared] = useState<Record<string, string>>({});
  const [job, setJob] = useState<Record<string, string>>({});
  const [kpis, setKpis] = useState<Record<string, string>>({});

  const num = (s: string) => (s.trim() === "" ? 0 : Number(s));

  const submit = () => {
    if (!period.trim()) {
      toast({ title: "الفترة مطلوبة", variant: "destructive" });
      return;
    }
    const sharedScores: Record<string, number> = {};
    Object.entries(shared).forEach(([k, v]) => {
      if (v.trim() !== "") sharedScores[k] = num(v);
    });
    const jobScores: Record<string, number> = {};
    Object.entries(job).forEach(([k, v]) => {
      if (v.trim() !== "") jobScores[k] = num(v);
    });
    const kpiList = (data?.kpis ?? [])
      .filter((k) => (kpis[k.name] ?? "").trim() !== "")
      .map((k) => ({ name: k.name, achievement: num(kpis[k.name]) }));

    create.mutate(
      {
        data: {
          employeeId,
          period,
          mode,
          kpiWeight: Number(kpiWeight) || 0,
          sharedScores,
          jobScores,
          kpis: kpiList,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "تم إنشاء التقييم" });
          qc.invalidateQueries({ queryKey: getListEvaluationsQueryKey() });
          onClose();
        },
        onError: () => toast({ title: "حدث خطأ أثناء إنشاء التقييم", variant: "destructive" }),
      },
    );
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return <p className="text-muted-foreground">تعذّر تحميل نموذج التقييم.</p>;

  const showShared = mode === "SHARED" || mode === "BOTH";
  const showJob = mode === "SPECIFIC" || mode === "BOTH";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>الفترة</Label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <SelectField label="نمط التقييم" value={mode} onChange={setMode} options={MODE_OPTIONS} />
        <div className="space-y-1.5">
          <Label>وزن المؤشرات %</Label>
          <Input type="number" value={kpiWeight} onChange={(e) => setKpiWeight(e.target.value)} />
        </div>
      </div>

      {showShared &&
        Object.entries(data.shared).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h4 className="font-semibold bg-muted px-2 py-1 rounded text-sm">{category}</h4>
            {items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2">
                <span className="text-sm">{item.name}</span>
                <ScoreInput value={shared[item.key] ?? ""} onChange={(v) => setShared({ ...shared, [item.key]: v })} />
              </div>
            ))}
          </div>
        ))}

      {showJob && data.jobCompetencies.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold bg-muted px-2 py-1 rounded text-sm">الجدارات التخصصية</h4>
          {data.jobCompetencies.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2">
              <span className="text-sm">{item.name}</span>
              <ScoreInput value={job[item.key] ?? ""} onChange={(v) => setJob({ ...job, [item.key]: v })} />
            </div>
          ))}
        </div>
      )}

      {data.kpis.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold bg-muted px-2 py-1 rounded text-sm">مؤشرات الأداء (نسبة الإنجاز %)</h4>
          {data.kpis.map((k) => (
            <div key={k.name} className="flex items-center justify-between gap-2">
              <span className="text-sm">
                {k.name}
                {k.target ? <span className="text-muted-foreground"> ({k.target})</span> : null}
              </span>
              <ScoreInput value={kpis[k.name] ?? ""} onChange={(v) => setKpis({ ...kpis, [k.name]: v })} />
            </div>
          ))}
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
          إلغاء
        </Button>
        <Button type="button" onClick={submit} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
          حفظ التقييم
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Evaluations() {
  const { data: evaluations, isLoading } = useListEvaluations();
  const { data: employees } = useListEmployees();
  const canManage = useCanManage(["ADMIN", "FIRST_LEVEL_MANAGER"]);

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  const openCreate = () => {
    setEmployeeId("");
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">التقييمات</h1>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 ml-2" />
            تقييم جديد
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة التقييمات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الفترة</TableHead>
                  <TableHead className="text-right">النتيجة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations?.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell>{ev.employeeName}</TableCell>
                    <TableCell>{ev.period}</TableCell>
                    <TableCell>{ev.totalScore ? `${ev.totalScore}%` : "-"}</TableCell>
                    <TableCell>{STATUS_LABELS[ev.status] ?? ev.status}</TableCell>
                    <TableCell>
                      <Link href={`/evaluations/${ev.id}`}>
                        <a className="text-primary hover:underline text-sm">التفاصيل</a>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-right">
            <DialogTitle>تقييم جديد</DialogTitle>
          </DialogHeader>
          <SelectField
            label="الموظف"
            value={employeeId}
            onChange={setEmployeeId}
            options={(employees ?? []).map((e) => ({ value: e.id, label: `${e.name} (${e.employeeNumber})` }))}
            required
          />
          {employeeId ? (
            <EvaluationFormBody key={employeeId} employeeId={employeeId} onClose={() => setOpen(false)} />
          ) : (
            <p className="text-muted-foreground text-sm py-4">اختر موظفاً لعرض نموذج التقييم.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
