"use client";

import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Eye, Sparkles, Route } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { CareerPathForm } from "./career-path-form";
import { CareerPathView } from "./career-path-view";
import { CareerPathGenerateDialog } from "./career-path-generate-dialog";

export default function CareerPathsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const utils = api.useUtils();

  const { data, isLoading } = api.careerPath.list.useQuery();

  const del = api.careerPath.delete.useMutation({
    onSuccess: async () => {
      await utils.careerPath.list.invalidate();
      toast.success("تم حذف المسار.");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">المسارات الوظيفية</h1>
          <p className="text-sm text-muted-foreground">مسارات التدرج المهني ومراحلها ومعايير الترقية</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <CareerPathGenerateDialog
              trigger={
                <Button variant="accent" size="sm">
                  <Sparkles className="size-4" />
                  توليد بالذكاء الاصطناعي
                </Button>
              }
            />
            <CareerPathForm
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  مسار جديد
                </Button>
              }
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">جارٍ التحميل…</p>
      ) : !data?.length ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Route className="size-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">لا توجد مسارات وظيفية بعد.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Card key={p.id} className="flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Route className="size-5" />
                </div>
                {p.isAiGenerated && (
                  <Badge variant="purple" className="gap-1">
                    <Sparkles className="size-3" /> AI
                  </Badge>
                )}
              </div>
              <div className="font-bold text-foreground">{p.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {[p.field, p.duration].filter(Boolean).join(" · ") || "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{p._count.stages} مراحل</div>

              <div className="mt-3 flex items-center gap-1 border-t border-border/60 pt-3">
                <CareerPathView
                  pathId={p.id}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Eye className="size-4" /> عرض
                    </Button>
                  }
                />
                {isAdmin && (
                  <>
                    <CareerPathForm
                      pathId={p.id}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="تعديل" className="size-8">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <ConfirmDialog
                      title="حذف المسار"
                      description={`سيتم حذف «${p.name}» وكل مراحله.`}
                      onConfirm={async () => {
                        await del.mutateAsync({ id: p.id });
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
