"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Eye } from "lucide-react";

import { api } from "@/trpc/react";
import { GuideSheet } from "@/components/evaluation/guide-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EVALUATION_STATUS_LABELS, EVALUATION_STATUS_VARIANT } from "@/lib/evaluation-status";

export default function EvaluationsPage() {
  const { data: session } = useSession();
  const role = session?.user.role;
  const canCreate = role === "ADMIN" || role === "FIRST_LEVEL_MANAGER";

  const { data, isLoading } = api.evaluation.list.useQuery(undefined);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">تقييم الأداء</h1>
          <p className="text-sm text-muted-foreground">التقييمات ضمن نطاقك وحالتها في دورة الاعتماد</p>
        </div>
        <div className="flex items-center gap-2">
          <GuideSheet />
          {canCreate && (
            <Button size="sm" asChild>
              <Link href="/evaluations/new">
                <Plus className="size-4" />
                تقييم جديد
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الموظف</TableHead>
              <TableHead>الفترة</TableHead>
              <TableHead className="w-24 text-center">الدرجة</TableHead>
              <TableHead className="w-28">الحالة</TableHead>
              <TableHead>المُقيِّم</TableHead>
              <TableHead className="w-20 text-center">عرض</TableHead>
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
                  لا توجد تقييمات.
                </TableCell>
              </TableRow>
            ) : (
              data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.employee.name}
                    <span className="block text-[11px] text-muted-foreground">{e.employee.employeeNumber}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.period}</TableCell>
                  <TableCell className="text-center font-bold text-primary">{e.totalScore ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={EVALUATION_STATUS_VARIANT[e.status]}>
                      {EVALUATION_STATUS_LABELS[e.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.evaluator.name}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <Link href={`/evaluations/${e.id}`} aria-label="عرض التقييم">
                        <Eye className="size-4" />
                      </Link>
                    </Button>
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
