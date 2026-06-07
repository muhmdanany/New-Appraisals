import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetEvaluation,
  getGetEvaluationQueryKey,
  useSubmitEvaluation,
  useApproveEvaluation,
  useRejectEvaluation,
  useAcknowledgeEvaluation,
  useObjectEvaluation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FormDialog } from "@/components/form-fields";
import { CheckCircle, XCircle, Send, ThumbsUp, AlertTriangle } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  ACKNOWLEDGED: "تم الاطلاع",
  OBJECTED: "معترض عليه",
};

export default function EvaluationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: evaluation, isLoading } = useGetEvaluation(id!, {
    query: { enabled: !!id, queryKey: getGetEvaluationQueryKey(id!) },
  });

  const submit = useSubmitEvaluation();
  const approve = useApproveEvaluation();
  const reject = useRejectEvaluation();
  const acknowledge = useAcknowledgeEvaluation();
  const object = useObjectEvaluation();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [objectOpen, setObjectOpen] = useState(false);
  const [objectedItems, setObjectedItems] = useState<Record<string, boolean>>({});
  const [objectNote, setObjectNote] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: getGetEvaluationQueryKey(id!) });
  const ok = (msg: string) => () => {
    toast({ title: msg });
    refresh();
  };
  const err = () => toast({ title: "تعذّر تنفيذ الإجراء", variant: "destructive" });

  const role = user?.role;
  const status = evaluation?.status;
  const isManager = ["ADMIN", "FIRST_LEVEL_MANAGER"].includes(role ?? "");
  const isApprover = ["ADMIN", "SECOND_LEVEL_MANAGER"].includes(role ?? "");

  const doReject = () => {
    if (!reason.trim()) {
      toast({ title: "يرجى كتابة سبب الرفض", variant: "destructive" });
      return;
    }
    reject.mutate(
      { id: id!, data: { reason } },
      {
        onSuccess: () => {
          ok("تم رفض التقييم")();
          setRejectOpen(false);
          setReason("");
        },
        onError: err,
      },
    );
  };

  const doObject = () => {
    const items = (evaluation?.items ?? [])
      .filter((it) => objectedItems[it.id])
      .map((it) => ({ itemId: it.id, note: objectNote || undefined }));
    if (items.length === 0) {
      toast({ title: "اختر بنداً واحداً على الأقل للاعتراض", variant: "destructive" });
      return;
    }
    object.mutate(
      { id: id!, data: { items } },
      {
        onSuccess: () => {
          ok("تم تسجيل الاعتراض")();
          setObjectOpen(false);
          setObjectedItems({});
          setObjectNote("");
        },
        onError: err,
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">تفاصيل التقييم</h1>
        {!isLoading && evaluation && (
          <div className="flex gap-2">
            {status === "DRAFT" && isManager && (
              <Button onClick={() => submit.mutate({ id: id! }, { onSuccess: ok("تم إرسال التقييم للاعتماد"), onError: err })} disabled={submit.isPending}>
                <Send className="w-4 h-4 ml-2" />
                إرسال للاعتماد
              </Button>
            )}
            {status === "SUBMITTED" && isApprover && (
              <>
                <Button onClick={() => approve.mutate({ id: id! }, { onSuccess: ok("تم اعتماد التقييم"), onError: err })} disabled={approve.isPending}>
                  <CheckCircle className="w-4 h-4 ml-2" />
                  اعتماد
                </Button>
                <Button variant="outline" className="text-destructive" onClick={() => setRejectOpen(true)}>
                  <XCircle className="w-4 h-4 ml-2" />
                  رفض
                </Button>
              </>
            )}
            {status === "APPROVED" && (
              <>
                <Button onClick={() => acknowledge.mutate({ id: id! }, { onSuccess: ok("تم تأكيد الاطلاع"), onError: err })} disabled={acknowledge.isPending}>
                  <ThumbsUp className="w-4 h-4 ml-2" />
                  تأكيد الاطلاع
                </Button>
                <Button variant="outline" onClick={() => setObjectOpen(true)}>
                  <AlertTriangle className="w-4 h-4 ml-2" />
                  اعتراض
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>معلومات التقييم</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div><strong>الموظف:</strong> {evaluation?.employeeName}</div>
              <div><strong>الفترة:</strong> {evaluation?.period}</div>
              <div>
                <strong>الحالة:</strong>{" "}
                <Badge variant="secondary">{STATUS_LABELS[evaluation?.status ?? ""] ?? evaluation?.status}</Badge>
              </div>
              <div><strong>النتيجة النهائية:</strong> {evaluation?.totalScore != null ? `${evaluation.totalScore}%` : "-"}</div>
              <div><strong>نتيجة الجدارات:</strong> {evaluation?.competencyScore != null ? `${evaluation.competencyScore}%` : "-"}</div>
              <div><strong>نتيجة المؤشرات:</strong> {evaluation?.kpiScore != null ? `${evaluation.kpiScore}%` : "-"}</div>
              {evaluation?.ratingLabel && <div><strong>التقدير:</strong> {evaluation.ratingLabel}</div>}
              {evaluation?.rejectionReason && (
                <div className="col-span-2 text-destructive"><strong>سبب الرفض:</strong> {evaluation.rejectionReason}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && evaluation?.items && evaluation.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>بنود التقييم</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">البند</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">الدرجة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluation.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.label}</TableCell>
                    <TableCell>{it.kind}</TableCell>
                    <TableCell>{it.score != null ? it.score : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <FormDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="رفض التقييم"
        onSubmit={doReject}
        submitting={reject.isPending}
        submitLabel="تأكيد الرفض"
      >
        <div className="space-y-1.5">
          <Label>سبب الرفض</Label>
          <Textarea value={reason} rows={4} onChange={(e) => setReason(e.target.value)} />
        </div>
      </FormDialog>

      <FormDialog
        open={objectOpen}
        onOpenChange={setObjectOpen}
        title="الاعتراض على التقييم"
        onSubmit={doObject}
        submitting={object.isPending}
        submitLabel="تسجيل الاعتراض"
      >
        <div className="space-y-2">
          <Label>البنود المعترض عليها</Label>
          <div className="max-h-52 overflow-y-auto rounded-md border border-border p-2 space-y-1">
            {(evaluation?.items ?? []).map((it) => (
              <label key={it.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-secondary cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={!!objectedItems[it.id]}
                  onChange={(e) => setObjectedItems({ ...objectedItems, [it.id]: e.target.checked })}
                />
                {it.label}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>ملاحظة الاعتراض</Label>
          <Textarea value={objectNote} rows={3} onChange={(e) => setObjectNote(e.target.value)} />
        </div>
      </FormDialog>
    </div>
  );
}
