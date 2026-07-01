"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Download, Search, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportButton } from "@/components/data/import-button";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import {
  COMPETENCY_TYPES,
  COMPETENCY_TYPE_LABELS,
  COMPETENCY_LEVEL_LABELS,
  parseCompetencyType,
  parseCompetencyLevel,
  type CompetencyType,
} from "@/lib/enums";
import { exportToSpreadsheet, pick, type SheetRow } from "@/lib/xlsx";
import { CompetencyForm } from "./competency-form";
import { CompetencyGenerateDialog } from "./competency-generate-dialog";

const TYPE_VARIANT: Record<CompetencyType, BadgeProps["variant"]> = {
  LEADERSHIP: "purple",
  TECHNICAL: "default",
  BEHAVIORAL: "success",
  JOB: "warning",
  MANAGERIAL: "destructive",
};

export default function CompetenciesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const utils = api.useUtils();

  const [search, setSearch] = useState("");
  const [type, setType] = useState<CompetencyType | "">("");

  const { data, isLoading } = api.competency.list.useQuery({
    search: search || undefined,
    type: type || undefined,
    take: 500,
    skip: 0,
  });

  const del = api.competency.delete.useMutation({
    onSuccess: async () => {
      await utils.competency.list.invalidate();
      toast.success("تم حذف الجدارة.");
    },
    onError: (e) => toast.error(e.message),
  });

  const importMut = api.competency.import.useMutation();

  async function handleImport(rows: SheetRow[]) {
    const mapped = rows
      .map((r) => ({
        name: pick(r, "الاسم", "name", "Name"),
        type: parseCompetencyType(pick(r, "النوع", "type")) ?? "JOB",
        level: parseCompetencyLevel(pick(r, "المستوى", "level")) ?? "BASIC",
        description: pick(r, "الوصف", "description") || undefined,
        indicators: pick(r, "المؤشرات", "indicators") || undefined,
      }))
      .filter((r) => r.name.length >= 2);
    if (!mapped.length) {
      toast.error("لا توجد صفوف صالحة في الملف.");
      return;
    }
    const res = await importMut.mutateAsync({ rows: mapped });
    await utils.competency.list.invalidate();
    toast.success(`تم الاستيراد: ${res.created} جديدة، ${res.updated} محدّثة.`);
  }

  async function handleExport() {
    const all = await utils.competency.list.fetch({ take: 500, skip: 0 });
    await exportToSpreadsheet(
      "الجدارات",
      "الجدارات",
      all.map((c) => ({
        الاسم: c.name,
        النوع: COMPETENCY_TYPE_LABELS[c.type],
        المستوى: COMPETENCY_LEVEL_LABELS[c.level],
        الوصف: c.description ?? "",
        المؤشرات: c.indicators ?? "",
      })),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">الجدارات</h1>
          <p className="text-sm text-muted-foreground">إدارة الجدارات السلوكية والقيادية والفنية والوظيفية</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <CompetencyGenerateDialog
              trigger={
                <Button variant="accent" size="sm">
                  <Sparkles className="size-4" />
                  توليد بالذكاء الاصطناعي
                </Button>
              }
            />
          )}
          {isAdmin && <ImportButton onRows={handleImport} />}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            تصدير
          </Button>
          {isAdmin && (
            <CompetencyForm
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  إضافة جدارة
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="ابحث بالاسم…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select className="w-48" value={type} onChange={(e) => setType(e.target.value as CompetencyType | "")}>
            <option value="">كل الأنواع</option>
            {COMPETENCY_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMPETENCY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead className="w-28">النوع</TableHead>
              <TableHead className="w-24">المستوى</TableHead>
              <TableHead>المؤشرات</TableHead>
              {isAdmin && <TableHead className="w-24 text-center">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  جارٍ التحميل…
                </TableCell>
              </TableRow>
            ) : !data?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  لا توجد جدارات.
                </TableCell>
              </TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {c.isShared && <Lock className="size-3.5 text-muted-foreground" aria-label="مشتركة" />}
                      {c.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[c.type]}>{COMPETENCY_TYPE_LABELS[c.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{COMPETENCY_LEVEL_LABELS[c.level]}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{c.indicators ?? "—"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <CompetencyForm
                          competency={{
                            id: c.id,
                            name: c.name,
                            type: c.type,
                            level: c.level,
                            description: c.description ?? undefined,
                            indicators: c.indicators ?? undefined,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="تعديل" className="size-8">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        {!c.isShared && (
                          <ConfirmDialog
                            title="حذف الجدارة"
                            description={`سيتم حذف «${c.name}» نهائياً.`}
                            onConfirm={async () => {
                              await del.mutateAsync({ id: c.id });
                            }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="حذف" className="size-8 text-destructive hover:text-destructive">
                                <Trash2 className="size-4" />
                              </Button>
                            }
                          />
                        )}
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
