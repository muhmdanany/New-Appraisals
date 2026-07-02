import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { useListEvaluations, getListEvaluationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, BookOpen, Trash2, ClipboardList, AlertTriangle, Info, Bell, Loader2 } from "lucide-react";
import { useCanManage } from "@/components/form-fields";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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

function getStatusLabels(t: (key: string) => string): Record<string, string> {
  return {
    DRAFT: t("evaluations.status.DRAFT"),
    SUBMITTED: t("evaluations.status.SUBMITTED"),
    APPROVED: t("evaluations.status.APPROVED"),
    REJECTED: t("evaluations.status.REJECTED"),
    ACKNOWLEDGED: t("evaluations.status.ACKNOWLEDGED"),
    OBJECTED: t("evaluations.status.OBJECTED"),
  };
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  ACKNOWLEDGED: "default",
  OBJECTED: "destructive",
};

export default function Evaluations() {
  const { data: evaluations, isLoading } = useListEvaluations();
  const canManage = useCanManage(["ADMIN", "FIRST_LEVEL_MANAGER"]);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const STATUS_LABELS = getStatusLabels(t);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const uid = localStorage.getItem("selectedUserId");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) headers["X-User-Id"] = uid;
      const res = await fetch(`/api/evaluations/${id}`, { method: "DELETE", headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t("evaluations.deleteFailed"));
      }
      qc.invalidateQueries({ queryKey: getListEvaluationsQueryKey() });
      toast({ title: t("evaluations.deleteSuccess") });
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    }
  };

  const [sendingNotif, setSendingNotif] = useState<string | null>(null);
  const sendNotification = async (evalId: string) => {
    setSendingNotif(evalId);
    try {
      const uid = localStorage.getItem("selectedUserId");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) headers["X-User-Id"] = uid;
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers,
        body: JSON.stringify({ evalIds: [evalId], type: "RESULT_SUMMARY", channels: ["EMAIL", "WHATSAPP"] }),
      });
      if (!res.ok) throw new Error("فشل الإرسال");
      toast({ title: "تم إرسال الإشعار بنجاح" });
    } catch (e: any) {
      toast({ title: e.message || "فشل الإرسال", variant: "destructive" });
    } finally {
      setSendingNotif(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("evaluations.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGuideOpen(true)}>
            <ClipboardList className="w-4 h-4 ml-2" />
            {t("evaluations.criteriaRef")}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/evaluations/guide">
              <BookOpen className="w-4 h-4 ml-2" />
              {t("evaluations.evalGuide")}
            </Link>
          </Button>
          {canManage && (
            <Button asChild>
              <Link href="/evaluations/new">
                <Plus className="w-4 h-4 ml-2" />
                {t("evaluations.newEvaluation")}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("evaluations.list")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : evaluations && evaluations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t("evaluations.employee")}</TableHead>
                  <TableHead className="text-right">{t("evaluations.period")}</TableHead>
                  <TableHead className="text-right">{t("evaluations.score")}</TableHead>
                  <TableHead className="text-right">{t("evaluations.rating")}</TableHead>
                  <TableHead className="text-right">{t("common.status")}</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium">{ev.employeeName}</TableCell>
                    <TableCell>{ev.period}</TableCell>
                    <TableCell className="font-bold">
                      {ev.totalScore != null ? `${ev.totalScore}%` : "—"}
                    </TableCell>
                    <TableCell>{ev.ratingLabel ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[ev.status] ?? "secondary"}>
                        {STATUS_LABELS[ev.status] ?? ev.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/evaluations/${ev.id}`}>
                          <a className="text-primary hover:underline text-sm">{t("common.details")}</a>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="إرسال إشعار" onClick={() => sendNotification(ev.id)} disabled={sendingNotif === ev.id}>
                          {sendingNotif === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5 text-muted-foreground" />}
                        </Button>
                        {ev.status === "DRAFT" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setToDeleteId(ev.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              {t("evaluations.noEvals")}{" "}
              {canManage && (
                <Link href="/evaluations/new">
                  <a className="text-primary hover:underline">{t("evaluations.startNew")}</a>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* مرجع المعايير Dialog */}
      <CriteriaGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

      <AlertDialog open={!!toDeleteId} onOpenChange={(o) => !o && setToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("evaluations.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("evaluations.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDeleteId) handleDelete(toDeleteId);
                setToDeleteId(null);
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

// ============== مرجع المعايير ==============

type ScaleRow = { level: number; label: string; range: string; color: string; desc: string };
type CompRow = { level: number; label: string; range: string; commitment: string; examples: string; evidence: string; adjust: string };
type FinalRow = { range: string; label: string; color: string; desc: string };
type AlertRow = { title: string; desc: string; color: string; key: string };

function getScaleRows(t: (k: string) => string): ScaleRow[] {
  return [
    { level: 5, label: t("evaluations.criteria.scale.5.label"), range: "91 – 100%", color: "bg-green-600", desc: t("evaluations.criteria.scale.5.desc") },
    { level: 4, label: t("evaluations.criteria.scale.4.label"), range: "76 – 90%", color: "bg-blue-600", desc: t("evaluations.criteria.scale.4.desc") },
    { level: 3, label: t("evaluations.criteria.scale.3.label"), range: "61 – 75%", color: "bg-yellow-500", desc: t("evaluations.criteria.scale.3.desc") },
    { level: 2, label: t("evaluations.criteria.scale.2.label"), range: "41 – 60%", color: "bg-orange-500", desc: t("evaluations.criteria.scale.2.desc") },
    { level: 1, label: t("evaluations.criteria.scale.1.label"), range: "≤ 40%", color: "bg-red-600", desc: t("evaluations.criteria.scale.1.desc") },
  ];
}

function getCompRows(t: (k: string) => string, section: "behavioral" | "leadership" | "technical"): CompRow[] {
  const labels = [
    { level: 5, label: t("evaluations.criteria.scale.5.label"), range: "91–100%" },
    { level: 4, label: t("evaluations.criteria.scale.4.label"), range: "76–90%" },
    { level: 3, label: t("evaluations.criteria.scale.3.label"), range: "61–75%" },
    { level: 2, label: t("evaluations.criteria.scale.2.label"), range: "41–60%" },
    { level: 1, label: t("evaluations.criteria.scale.1.label"), range: "≤ 40%" },
  ];
  return labels.map((l) => ({
    ...l,
    commitment: t(`evaluations.criteria.${section}.${l.level}.commitment`),
    examples: t(`evaluations.criteria.${section}.${l.level}.examples`),
    evidence: t(`evaluations.criteria.${section}.${l.level}.evidence`),
    adjust: t(`evaluations.criteria.${section}.${l.level}.adjust`),
  }));
}

function getFinalTable(t: (k: string) => string): FinalRow[] {
  return [
    { range: "91 – 100", label: t("evaluations.criteria.finalTable.91-100.label"), color: "bg-green-600", desc: t("evaluations.criteria.finalTable.91-100.desc") },
    { range: "76 – 90", label: t("evaluations.criteria.finalTable.76-90.label"), color: "bg-blue-600", desc: t("evaluations.criteria.finalTable.76-90.desc") },
    { range: "61 – 75", label: t("evaluations.criteria.finalTable.61-75.label"), color: "bg-yellow-500", desc: t("evaluations.criteria.finalTable.61-75.desc") },
    { range: "41 – 60", label: t("evaluations.criteria.finalTable.41-60.label"), color: "bg-orange-500", desc: t("evaluations.criteria.finalTable.41-60.desc") },
    { range: "≤ 40", label: t("evaluations.criteria.finalTable.0-40.label"), color: "bg-red-600", desc: t("evaluations.criteria.finalTable.0-40.desc") },
  ];
}

function getAlerts(t: (k: string) => string): AlertRow[] {
  return [
    { key: "halo", title: t("evaluations.criteria.alerts.halo.title"), desc: t("evaluations.criteria.alerts.halo.desc"), color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950" },
    { key: "central", title: t("evaluations.criteria.alerts.central.title"), desc: t("evaluations.criteria.alerts.central.desc"), color: "border-blue-500 bg-blue-50 dark:bg-blue-950" },
    { key: "documentation", title: t("evaluations.criteria.alerts.documentation.title"), desc: t("evaluations.criteria.alerts.documentation.desc"), color: "border-green-500 bg-green-50 dark:bg-green-950" },
    { key: "lenient", title: t("evaluations.criteria.alerts.lenient.title"), desc: t("evaluations.criteria.alerts.lenient.desc"), color: "border-purple-500 bg-purple-50 dark:bg-purple-950" },
    { key: "bias", title: t("evaluations.criteria.alerts.bias.title"), desc: t("evaluations.criteria.alerts.bias.desc"), color: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" },
    { key: "strict", title: t("evaluations.criteria.alerts.strict.title"), desc: t("evaluations.criteria.alerts.strict.desc"), color: "border-red-500 bg-red-50 dark:bg-red-950" },
  ];
}

function CompetencyTable({ rows, t }: { rows: CompRow[]; t: (k: string) => string }) {
  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right w-28">{t("evaluations.criteria.compLevel")}</TableHead>
            <TableHead className="text-right">{t("evaluations.criteria.compCommitment")}</TableHead>
            <TableHead className="text-right">{t("evaluations.criteria.compExamples")}</TableHead>
            <TableHead className="text-right">{t("evaluations.criteria.compEvidence")}</TableHead>
            <TableHead className="text-right">{t("evaluations.criteria.compAdjust")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.level}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ${
                    r.level === 5 ? "bg-green-600" : r.level === 4 ? "bg-blue-600" : r.level === 3 ? "bg-yellow-500" : r.level === 2 ? "bg-orange-500" : "bg-red-600"
                  }`}>{r.level}</span>
                  <span className="text-xs font-medium">{r.label}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs">{r.commitment}</TableCell>
              <TableCell className="text-xs">{r.examples}</TableCell>
              <TableCell className="text-xs">{r.evidence}</TableCell>
              <TableCell className="text-xs">{r.adjust}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CriteriaGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const SCALE_ROWS = getScaleRows(t);
  const BEHAVIORAL_ROWS = getCompRows(t, "behavioral");
  const LEADERSHIP_ROWS = getCompRows(t, "leadership");
  const TECHNICAL_ROWS = getCompRows(t, "technical");
  const FINAL_TABLE_ROWS = getFinalTable(t);
  const ALERT_ROWS = getAlerts(t);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-right text-2xl">{t("evaluations.criteria.dialogTitle")}</DialogTitle>
          <p className="text-sm text-muted-foreground text-right">
            {t("evaluations.criteria.dialogSubtitle")}
          </p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 pl-4 space-y-8 mt-4">

          {/* كيفية الاستخدام */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>{t("evaluations.criteria.howToUse")}</strong> {t("evaluations.criteria.howToUseDesc")}
              </div>
            </div>
          </div>

          {/* مقياس التقييم — ملخص سريع */}
          <div>
            <h3 className="text-lg font-bold mb-3">{t("evaluations.criteria.scaleSummary")}</h3>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-20">{t("evaluations.criteria.scaleGrade")}</TableHead>
                    <TableHead className="text-right w-36">{t("evaluations.criteria.scaleMeaning")}</TableHead>
                    <TableHead className="text-right w-28">{t("evaluations.criteria.scalePercent")}</TableHead>
                    <TableHead className="text-right">{t("evaluations.criteria.scaleSemantic")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SCALE_ROWS.map((r) => (
                    <TableRow key={r.level}>
                      <TableCell>
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${r.color}`}>
                          {r.level}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{r.label}</TableCell>
                      <TableCell className="text-sm font-mono">{r.range}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* القسم الأول: الجدارات السلوكية */}
          <div>
            <h3 className="text-lg font-bold mb-3">{t("evaluations.criteria.behavioralSection")}</h3>
            <CompetencyTable rows={BEHAVIORAL_ROWS} t={t} />
          </div>

          {/* القسم الثاني: الجدارات القيادية */}
          <div>
            <h3 className="text-lg font-bold mb-3">{t("evaluations.criteria.leadershipSection")}</h3>
            <CompetencyTable rows={LEADERSHIP_ROWS} t={t} />
          </div>

          {/* القسم الثالث: الجدارات الفنية المشتركة */}
          <div>
            <h3 className="text-lg font-bold mb-3">{t("evaluations.criteria.technicalSection")}</h3>
            <CompetencyTable rows={TECHNICAL_ROWS} t={t} />
          </div>

          {/* تنبيهات جوهرية للمقيّم */}
          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              {t("evaluations.criteria.alertsTitle")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALERT_ROWS.map((a) => (
                <div key={a.key} className={`rounded-lg border-r-4 p-3 ${a.color}`}>
                  <div className="font-semibold text-sm mb-1">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* جدول التقدير النهائي */}
          <div>
            <h3 className="text-lg font-bold mb-3">{t("evaluations.criteria.finalTableTitle")}</h3>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-28">{t("evaluations.criteria.finalPercent")}</TableHead>
                    <TableHead className="text-right w-36">{t("evaluations.criteria.finalRating")}</TableHead>
                    <TableHead className="text-right">{t("evaluations.criteria.finalDesc")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FINAL_TABLE_ROWS.map((r) => (
                    <TableRow key={r.range}>
                      <TableCell className="font-mono text-sm font-semibold">{r.range}</TableCell>
                      <TableCell>
                        <Badge className={`${r.color} text-white border-0`}>{r.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* معادلة الدرجة الإجمالية */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <h4 className="font-bold text-sm mb-2">{t("evaluations.criteria.formulaTitle")}</h4>
            <p className="text-sm font-mono">
              {t("evaluations.criteria.formula")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("evaluations.criteria.formulaNote")}
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
