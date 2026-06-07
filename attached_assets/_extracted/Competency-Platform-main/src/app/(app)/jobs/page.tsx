"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Download, Search } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportButton } from "@/components/data/import-button";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { CONTRACT_TYPE_LABELS, parseContractType } from "@/lib/enums";
import { exportToSpreadsheet, pick, splitList, type SheetRow } from "@/lib/xlsx";
import { JobForm } from "./job-form";
import { JobPdfButton } from "./job-pdf-button";

export default function JobsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const utils = api.useUtils();

  const [search, setSearch] = useState("");
  const { data, isLoading } = api.job.list.useQuery({ search: search || undefined, take: 500, skip: 0 });

  const del = api.job.delete.useMutation({
    onSuccess: async () => {
      await utils.job.list.invalidate();
      toast.success("تم حذف الوظيفة.");
    },
    onError: (e) => toast.error(e.message),
  });

  const importMut = api.job.import.useMutation();

  async function handleImport(rows: SheetRow[]) {
    const mapped = rows
      .map((r) => ({
        name: pick(r, "المسمى", "الوظيفة", "name"),
        departmentName: pick(r, "الإدارة", "القسم", "department") || undefined,
        gradeNum: pick(r, "الدرجة", "grade") || undefined,
        contractType: parseContractType(pick(r, "نوع العقد", "العقد", "contractType")) ?? "FULL_TIME",
        experienceLevel: pick(r, "مستوى الخبرة", "الخبرة", "experience") || undefined,
        description: pick(r, "الوصف", "description") || undefined,
        competencyNames: splitList(pick(r, "الجدارات", "competencies")),
      }))
      .filter((r) => r.name.length >= 2);
    if (!mapped.length) {
      toast.error("لا توجد صفوف صالحة في الملف.");
      return;
    }
    const res = await importMut.mutateAsync({ rows: mapped });
    await utils.job.list.invalidate();
    toast.success(`تم الاستيراد: ${res.created} جديدة، ${res.updated} محدّثة.`);
  }

  async function handleExport() {
    const all = await utils.job.list.fetch({ take: 500, skip: 0 });
    await exportToSpreadsheet(
      "الوظائف",
      "الوظائف",
      all.map((j) => ({
        المسمى: j.name,
        الإدارة: j.department?.name ?? "",
        الدرجة: j.grade?.num ?? "",
        "نوع العقد": CONTRACT_TYPE_LABELS[j.contractType],
        "مستوى الخبرة": j.experienceLevel ?? "",
        الجدارات: j.competencies.map((c) => c.competency.name).join("، "),
      })),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الوظائف</h1>
          <p className="text-sm text-muted-foreground">إدارة المسميات الوظيفية وربطها بالجدارات والدرجات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && <ImportButton onRows={handleImport} />}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            تصدير
          </Button>
          {isAdmin && (
            <JobForm
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  إضافة وظيفة
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="ابحث بالمسمى…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المسمى</TableHead>
              <TableHead>الإدارة</TableHead>
              <TableHead className="w-32">الدرجة</TableHead>
              <TableHead className="w-28">نوع العقد</TableHead>
              <TableHead className="w-24 text-center">الجدارات</TableHead>
              <TableHead className="w-28 text-center">إجراءات</TableHead>
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
                  لا توجد وظائف.
                </TableCell>
              </TableRow>
            ) : (
              data.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.name}</TableCell>
                  <TableCell className="text-muted-foreground">{j.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {j.grade ? `درجة ${j.grade.num}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{CONTRACT_TYPE_LABELS[j.contractType]}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="muted">{j._count.competencies}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <JobPdfButton jobId={j.id} />
                      {isAdmin && (
                        <>
                          <JobForm
                            jobId={j.id}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="تعديل" className="size-8">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <ConfirmDialog
                          title="حذف الوظيفة"
                          description={`سيتم حذف «${j.name}» نهائياً.`}
                          onConfirm={async () => {
                            await del.mutateAsync({ id: j.id });
                          }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="حذف" className="size-8 text-destructive hover:text-destructive">
                                <Trash2 className="size-4" />
                              </Button>
                            }
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
