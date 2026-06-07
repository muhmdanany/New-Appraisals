"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Send, Check, X, ThumbsUp, MessageSquareWarning, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { PromptDialog } from "@/components/data/prompt-dialog";
import { EVALUATION_STATUS_LABELS, EVALUATION_STATUS_VARIANT } from "@/lib/evaluation-status";
import { DistributionGuardrail } from "@/components/evaluation/distribution-guardrail";

const isSharedKey = (refKey: string) => /^[blt]\d+$/.test(refKey);

type Item = {
  id: string;
  label: string;
  score: number | null;
  note: string | null;
  objected: boolean;
  objectionNote: string | null;
};
type ObjectionState = Record<string, { checked: boolean; note: string }>;

export default function EvaluationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const utils = api.useUtils();

  const { data: ev, isLoading } = api.evaluation.byId.useQuery({ id });
  const [objections, setObjections] = useState<ObjectionState>({});

  const refresh = async () => {
    await Promise.all([utils.evaluation.byId.invalidate({ id }), utils.evaluation.list.invalidate()]);
  };
  const onErr = (e: { message: string }) => toast.error(e.message);
  const submit = api.evaluation.submit.useMutation({ onSuccess: () => { toast.success("أُرسل للاعتماد."); void refresh(); }, onError: onErr });
  const approve = api.evaluation.approve.useMutation({ onSuccess: () => { toast.success("تم الاعتماد."); void refresh(); }, onError: onErr });
  const reject = api.evaluation.reject.useMutation({ onSuccess: () => { toast.success("تم الرفض."); void refresh(); }, onError: onErr });
  const acknowledge = api.evaluation.acknowledge.useMutation({ onSuccess: () => { toast.success("تم الإقرار."); void refresh(); }, onError: onErr });
  const object = api.evaluation.object.useMutation({ onSuccess: () => { toast.success("تم تسجيل الاعتراض."); void refresh(); }, onError: onErr });
  const del = api.evaluation.delete.useMutation({
    onSuccess: () => { toast.success("تم الحذف."); router.push("/evaluations"); },
    onError: onErr,
  });

  const distribution = api.evaluation.departmentDistribution.useQuery(
    { employeeId: ev?.employee.id ?? "", period: ev?.period ?? "" },
    { enabled: Boolean(ev?.employee.id && ev?.period) },
  );

  if (isLoading || !ev || !user) {
    return <div className="py-10 text-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  const isOwnerOrAdmin = user.role === "ADMIN" || ev.evaluator.id === user.id;
  const editable = isOwnerOrAdmin && (ev.status === "DRAFT" || ev.status === "REJECTED");
  const canApprove = (user.role === "ADMIN" || user.role === "SECOND_LEVEL_MANAGER") && ev.status === "SUBMITTED";
  const canAck = user.role === "EMPLOYEE" && ev.status === "APPROVED" && ev.employee.id === user.employeeId;

  const kpiItems = ev.items.filter((i) => i.kind === "KPI");
  const sharedItems = ev.items.filter((i) => i.kind === "COMPETENCY" && isSharedKey(i.refKey));
  const jobItems = ev.items.filter((i) => i.kind === "COMPETENCY" && !isSharedKey(i.refKey));

  const toggleObjection = (itemId: string) =>
    setObjections((o) => ({ ...o, [itemId]: { checked: !o[itemId]?.checked, note: o[itemId]?.note ?? "" } }));
  const setObjectionNote = (itemId: string, note: string) =>
    setObjections((o) => ({ ...o, [itemId]: { checked: o[itemId]?.checked ?? true, note } }));

  const chosen = Object.entries(objections).filter(([, v]) => v.checked);
  const submitObjections = () =>
    object.mutate({ id, items: chosen.map(([itemId, v]) => ({ itemId, note: v.note.trim() || undefined })) });

  const tableProps = { editable: canAck, objections, onToggle: toggleObjection, onNote: setObjectionNote };

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">تقييم: {ev.employee.name}</h1>
          <p className="text-sm text-muted-foreground">{ev.period} · المُقيِّم: {ev.evaluator.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة
          </Button>
          {editable && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/evaluations/${id}/edit`}><Pencil className="size-4" /> تعديل</Link>
            </Button>
          )}
          {editable && (
            <ConfirmDialog
              title="إرسال للاعتماد"
              description="بعد الإرسال لا يمكن التعديل إلا بعد الرفض."
              confirmLabel="إرسال"
              onConfirm={async () => { await submit.mutateAsync({ id }); }}
              trigger={<Button size="sm"><Send className="size-4" /> إرسال للاعتماد</Button>}
            />
          )}
          {canApprove && (
            <>
              <ConfirmDialog
                title="اعتماد التقييم"
                confirmLabel="اعتماد"
                onConfirm={async () => { await approve.mutateAsync({ id }); }}
                trigger={<Button size="sm" variant="success"><Check className="size-4" /> اعتماد</Button>}
              />
              <PromptDialog
                title="رفض التقييم"
                placeholder="سبب الرفض…"
                confirmLabel="رفض"
                confirmVariant="destructive"
                onConfirm={async (reason) => { await reject.mutateAsync({ id, reason }); }}
                trigger={<Button size="sm" variant="destructive"><X className="size-4" /> رفض</Button>}
              />
            </>
          )}
          {canAck && (
            <>
              <ConfirmDialog
                title="الإقرار بالاطلاع"
                description="الدرجة نهائية؛ الإقرار يعني الاطلاع على النتيجة دون اعتراض."
                confirmLabel="إقرار"
                onConfirm={async () => { await acknowledge.mutateAsync({ id }); }}
                trigger={<Button size="sm" variant="success"><ThumbsUp className="size-4" /> إقرار</Button>}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={chosen.length === 0 || object.isPending}
                onClick={submitObjections}
              >
                <MessageSquareWarning className="size-4" /> إرسال الاعتراضات{chosen.length > 0 ? ` (${chosen.length})` : ""}
              </Button>
            </>
          )}
          {(user.role === "ADMIN" || (editable && ev.evaluator.id === user.id)) && (
            <ConfirmDialog
              title="حذف التقييم"
              description="سيُحذف التقييم نهائياً."
              onConfirm={async () => { await del.mutateAsync({ id }); }}
              trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="size-4" /> حذف</Button>}
            />
          )}
        </div>
      </div>

      {/* Score summary */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-muted-foreground">الدرجة الإجمالية</div>
            <div className="text-3xl font-extrabold text-primary">{ev.totalScore ?? "—"} / 100</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">التقدير</div>
            <div className="text-lg font-bold">{ev.ratingLabel ?? "—"}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            <div>KPIs: {ev.kpiScore?.toFixed(0) ?? "—"} (وزن {ev.kpiWeight}%)</div>
            <div>الجدارات: {ev.competencyScore?.toFixed(0) ?? "—"} (وزن {ev.competencyWeight}%)</div>
          </div>
        </div>
        <Badge variant={EVALUATION_STATUS_VARIANT[ev.status]}>{EVALUATION_STATUS_LABELS[ev.status]}</Badge>
      </Card>

      {ev.status === "REJECTED" && ev.rejectionReason && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm">
          <span className="font-bold text-destructive">سبب الرفض: </span>
          {ev.rejectionReason}
        </Card>
      )}
      {ev.status === "OBJECTED" && (
        <Card className="border-warning/40 bg-warning/5 p-4 text-sm text-warning">
          سجّل الموظف اعتراضاً على بنود محددة (موضّحة أدناه). الدرجة النهائية لم تتغيّر.
        </Card>
      )}

      {canAck && (
        <Card className="border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground print:hidden">
          يمكنك <span className="font-bold text-foreground">الإقرار</span> بالاطلاع، أو الاعتراض على بنود محددة: فعّل خانة «اعتراض» بجانب البند وأضف ملاحظة، ثم اضغط «إرسال الاعتراضات». الدرجة نهائية ولا تتغيّر بالاعتراض.
        </Card>
      )}

      {distribution.data && (
        <div className="print:hidden">
          <DistributionGuardrail data={distribution.data} />
        </div>
      )}

      {kpiItems.length > 0 && <ItemTable title="مؤشرات الأداء (KPIs)" items={kpiItems} unit="%" {...tableProps} />}
      {sharedItems.length > 0 && <ItemTable title="الجدارات المشتركة" items={sharedItems} unit="/5" {...tableProps} />}
      {jobItems.length > 0 && <ItemTable title="الجدارات الوظيفية" items={jobItems} unit="/5" {...tableProps} />}
    </div>
  );
}

function ItemTable({
  title,
  items,
  unit,
  editable,
  objections,
  onToggle,
  onNote,
}: {
  title: string;
  items: Item[];
  unit: string;
  editable?: boolean;
  objections?: ObjectionState;
  onToggle?: (id: string) => void;
  onNote?: (id: string, note: string) => void;
}) {
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>البند</TableHead>
            <TableHead className="w-24 text-center">الدرجة</TableHead>
            <TableHead>ملاحظات</TableHead>
            {editable && <TableHead className="w-56 text-center print:hidden">اعتراض</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => {
            const checked = objections?.[i.id]?.checked ?? false;
            return (
              <TableRow key={i.id}>
                <TableCell className="font-medium align-top">
                  {i.label}
                  {i.objected && (
                    <div className="mt-0.5 text-[11px] text-destructive">
                      اعتراض الموظف: {i.objectionNote || "—"}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center align-top font-bold">
                  {i.score ?? "—"}
                  {unit}
                </TableCell>
                <TableCell className="align-top text-muted-foreground">{i.note ?? "—"}</TableCell>
                {editable && (
                  <TableCell className="align-top print:hidden">
                    <label className="flex items-center justify-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="size-4 accent-[hsl(var(--destructive))]"
                        checked={checked}
                        onChange={() => onToggle?.(i.id)}
                      />
                      اعتراض
                    </label>
                    {checked && (
                      <Input
                        className="mt-1.5 h-8 text-xs"
                        placeholder="سبب الاعتراض (اختياري)"
                        value={objections?.[i.id]?.note ?? ""}
                        onChange={(e) => onNote?.(i.id, e.target.value)}
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
