"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Download, Search, Eye } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportButton } from "@/components/data/import-button";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { exportToSpreadsheet, pick, type SheetRow } from "@/lib/xlsx";
import { EmployeeForm } from "./employee-form";
import { EmployeeDetails } from "./employee-details";

// Header aliases that map to core fields; everything else becomes an extra field.
const KNOWN_HEADERS = new Set([
  "الاسم", "الاسم الكامل", "name", "Name",
  "الرقم الوظيفي", "الرقم", "رقم الموظف", "employeeNumber", "emp_id",
  "الوظيفة", "المسمى", "المسمى الوظيفي", "job",
  "الإدارة", "القسم", "department", "dept",
  "الدرجة", "grade",
  "المدير المباشر", "المدير", "الرئيس المباشر", "رقم المدير", "managerNumber", "manager",
]);

export default function EmployeesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const utils = api.useUtils();

  const [search, setSearch] = useState("");
  const { data, isLoading } = api.employee.list.useQuery({ search: search || undefined, take: 500, skip: 0 });

  const del = api.employee.delete.useMutation({
    onSuccess: async () => {
      await utils.employee.list.invalidate();
      toast.success("تم حذف الموظف.");
    },
    onError: (e) => toast.error(e.message),
  });

  const importMut = api.employee.import.useMutation();

  async function handleImport(rows: SheetRow[]) {
    const mapped = rows
      .map((r) => {
        const extraFields: Record<string, string> = {};
        for (const [key, value] of Object.entries(r)) {
          if (!KNOWN_HEADERS.has(key.trim()) && String(value).trim() !== "") {
            extraFields[key.trim()] = String(value).trim();
          }
        }
        return {
          name: pick(r, "الاسم", "الاسم الكامل", "name", "Name"),
          employeeNumber: pick(r, "الرقم الوظيفي", "الرقم", "رقم الموظف", "employeeNumber", "emp_id"),
          jobName: pick(r, "الوظيفة", "المسمى", "المسمى الوظيفي", "job") || undefined,
          departmentName: pick(r, "الإدارة", "القسم", "department", "dept") || undefined,
          gradeNum: pick(r, "الدرجة", "grade") || undefined,
          managerNumber: pick(r, "المدير المباشر", "المدير", "الرئيس المباشر", "رقم المدير", "managerNumber") || undefined,
          extraFields,
        };
      })
      .filter((r) => r.name.length >= 2 && r.employeeNumber.length >= 1);
    if (!mapped.length) {
      toast.error("لا توجد صفوف صالحة (يلزم الاسم والرقم الوظيفي).");
      return;
    }
    const res = await importMut.mutateAsync({ rows: mapped });
    await utils.employee.list.invalidate();
    toast.success(`تم الاستيراد: ${res.created} جديد، ${res.updated} محدّث، ${res.linked} ارتباط مدير.`);
  }

  async function handleExport() {
    const all = await utils.employee.list.fetch({ take: 500, skip: 0 });
    await exportToSpreadsheet(
      "الموظفون",
      "الموظفون",
      all.map((e) => ({
        "الرقم الوظيفي": e.employeeNumber,
        الاسم: e.name,
        الوظيفة: e.job?.name ?? "",
        الإدارة: e.department?.name ?? "",
        الدرجة: e.grade?.num ?? "",
        "المدير المباشر": e.manager?.employeeNumber ?? "",
        ...((e.extraFields ?? {}) as Record<string, string>),
      })),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الموظفون</h1>
          <p className="text-sm text-muted-foreground">سجل الموظفين والهيكل الإداري</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && <ImportButton onRows={handleImport} />}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            تصدير
          </Button>
          {isAdmin && (
            <EmployeeForm
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  إضافة موظف
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="ابحث بالاسم أو الرقم…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">الرقم</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>الوظيفة</TableHead>
              <TableHead>الإدارة</TableHead>
              <TableHead>المدير المباشر</TableHead>
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
                  لا يوجد موظفون ضمن نطاقك.
                </TableCell>
              </TableRow>
            ) : (
              data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell dir="ltr" className="text-right font-mono text-xs text-muted-foreground">
                    {e.employeeNumber}
                  </TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.job?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.manager?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <EmployeeDetails
                        employeeId={e.id}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="عرض بيانات الموظف" className="size-8">
                            <Eye className="size-4" />
                          </Button>
                        }
                      />
                      {isAdmin && (
                        <>
                          <EmployeeForm
                            employeeId={e.id}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="تعديل" className="size-8">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <ConfirmDialog
                            title="حذف الموظف"
                            description={`سيتم حذف «${e.name}» نهائياً.`}
                            onConfirm={async () => {
                              await del.mutateAsync({ id: e.id });
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
