"use client";

import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportButton } from "@/components/data/import-button";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { exportToSpreadsheet, pick, type SheetRow } from "@/lib/xlsx";
import type { GradeInput } from "@/lib/validators/grade";
import { GradeForm } from "./grade-form";

const numOr = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? n : fallback;
};

export default function GradesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const utils = api.useUtils();

  const { data, isLoading } = api.grade.list.useQuery();

  const del = api.grade.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.grade.list.invalidate(), utils.grade.options.invalidate()]);
      toast.success("تم حذف الدرجة.");
    },
    onError: (e) => toast.error(e.message),
  });

  const importMut = api.grade.import.useMutation();

  async function handleImport(rows: SheetRow[]) {
    const byNum = new Map<string, GradeInput>();
    for (const r of rows) {
      const num = pick(r, "رقم الدرجة", "الدرجة", "num");
      if (!num) continue;
      const name = pick(r, "اسم الدرجة", "الاسم", "name");
      let grade = byNum.get(num);
      if (!grade) {
        grade = {
          num,
          name: name || `درجة ${num}`,
          classification: pick(r, "التصنيف", "classification") || undefined,
          leaveDays: numOr(pick(r, "أيام الإجازة", "leaveDays"), 21),
          levels: [],
        };
        byNum.set(num, grade);
      }
      grade.levels.push({
        level: numOr(pick(r, "المستوى", "level"), grade.levels.length + 1),
        label: pick(r, "مسمى المستوى", "المسمى", "label") || name || `مستوى ${grade.levels.length + 1}`,
        minScore: numOr(pick(r, "الحد الأدنى للدرجة", "minScore"), 85),
        stayYears: numOr(pick(r, "سنوات البقاء", "stayYears"), 0),
        minYrsSecondary: numOr(pick(r, "ثانوي"), 0),
        minYrsDiploma: numOr(pick(r, "دبلوم"), 0),
        minYrsBachelor: numOr(pick(r, "بكالوريوس"), 0),
        minYrsMaster: numOr(pick(r, "ماجستير"), 0),
        minYrsPhd: numOr(pick(r, "دكتوراه"), 0),
        competencies: pick(r, "الجدارات", "competencies") || undefined,
      });
    }
    const grades = [...byNum.values()].filter((g) => g.levels.length > 0);
    if (!grades.length) {
      toast.error("لا توجد صفوف صالحة في الملف.");
      return;
    }
    const res = await importMut.mutateAsync({ rows: grades });
    await Promise.all([utils.grade.list.invalidate(), utils.grade.options.invalidate()]);
    toast.success(`تم الاستيراد: ${res.created} جديدة، ${res.updated} محدّثة.`);
  }

  async function handleExport() {
    const all = await utils.grade.list.fetch();
    const rows: Record<string, string | number>[] = [];
    for (const g of all) {
      for (const l of g.levels) {
        rows.push({
          "رقم الدرجة": g.num,
          "اسم الدرجة": g.name,
          التصنيف: g.classification ?? "",
          "أيام الإجازة": g.leaveDays,
          المستوى: l.level,
          "مسمى المستوى": l.label,
          "الحد الأدنى للدرجة": l.minScore,
          "سنوات البقاء": l.stayYears,
          دبلوم: l.minYrsDiploma,
          بكالوريوس: l.minYrsBachelor,
          ماجستير: l.minYrsMaster,
          دكتوراه: l.minYrsPhd,
          الجدارات: l.competencies ?? "",
        });
      }
    }
    await exportToSpreadsheet("الدرجات_الوظيفية", "الدرجات", rows);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الدرجات الوظيفية</h1>
          <p className="text-sm text-muted-foreground">سلّم الدرجات ومستوياتها ومتطلبات الترقية</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && <ImportButton onRows={handleImport} />}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            تصدير
          </Button>
          {isAdmin && (
            <GradeForm
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  إضافة درجة
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">الرقم</TableHead>
              <TableHead>اسم الدرجة</TableHead>
              <TableHead className="w-24 text-center">المستويات</TableHead>
              <TableHead className="w-24 text-center">الوظائف</TableHead>
              <TableHead className="w-24">الإجازة</TableHead>
              {isAdmin && <TableHead className="w-24 text-center">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  جارٍ التحميل…
                </TableCell>
              </TableRow>
            ) : !data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  لا توجد درجات.
                </TableCell>
              </TableRow>
            ) : (
              data.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Badge>{g.num}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{g.levels.length}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{g._count.jobs}</TableCell>
                  <TableCell className="text-muted-foreground">{g.leaveDays} يوم</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <GradeForm
                          gradeId={g.id}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="تعديل" className="size-8">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <ConfirmDialog
                          title="حذف الدرجة"
                          description={`سيتم حذف الدرجة «${g.name}» وكل مستوياتها.`}
                          onConfirm={async () => {
                            await del.mutateAsync({ id: g.id });
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="حذف" className="size-8 text-destructive hover:text-destructive">
                              <Trash2 className="size-4" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
