import { Link } from "wouter";
import { useListEvaluations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen } from "lucide-react";
import { useCanManage } from "@/components/form-fields";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  ACKNOWLEDGED: "تم الاطلاع",
  OBJECTED: "معترض عليه",
};

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">التقييمات</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/evaluations/guide">
              <BookOpen className="w-4 h-4 ml-2" />
              دليل التقييم
            </Link>
          </Button>
          {canManage && (
            <Button asChild>
              <Link href="/evaluations/new">
                <Plus className="w-4 h-4 ml-2" />
                تقييم جديد
              </Link>
            </Button>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة التقييمات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : evaluations && evaluations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الفترة</TableHead>
                  <TableHead className="text-right">النتيجة</TableHead>
                  <TableHead className="text-right">التقدير</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
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
                      <Link href={`/evaluations/${ev.id}`}>
                        <a className="text-primary hover:underline text-sm">التفاصيل</a>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              لا توجد تقييمات بعد.{" "}
              {canManage && (
                <Link href="/evaluations/new">
                  <a className="text-primary hover:underline">ابدأ تقييماً جديداً</a>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
