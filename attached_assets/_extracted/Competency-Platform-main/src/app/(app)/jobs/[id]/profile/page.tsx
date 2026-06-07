"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, ArrowRight, Building2 } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { COMPETENCY_TYPE_LABELS, type CompetencyType } from "@/lib/enums";

export default function JobProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = api.job.profile.useQuery({ id: params.id });

  // Print this page in landscape; scoped to this route via a temporary style tag.
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@media print { @page { size: A4 landscape; margin: 10mm } }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (isLoading || !data) {
    return <div className="py-10 text-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  const meta = [
    ["الإدارة", data.department?.name],
    ["الدرجة", data.grade ? `درجة ${data.grade.num} — ${data.grade.name}` : null],
    ["مستوى الخبرة", data.experienceLevel],
    ["الرئيس المباشر", data.reportsTo?.name],
  ] as const;

  const kpiGroups = data.kpiSet?.groups ?? [];

  return (
    <div className="mx-auto max-w-[1120px] space-y-4">
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link href="/jobs">
            <ArrowRight className="size-4" /> رجوع
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Download className="size-4" /> تحميل PDF
        </Button>
      </div>

      {/* Landscape profile card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md print:border-0 print:shadow-none">
        {/* Header band */}
        <div className="flex items-center gap-4 bg-gradient-to-l from-[hsl(219_62%_15%)] to-[hsl(212_67%_24%)] px-8 py-6 text-white">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 text-accent ring-1 ring-accent/40">
            <Building2 className="size-6" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] tracking-widest text-accent">بطاقة الوصف الوظيفي</div>
            <h1 className="text-2xl font-extrabold">{data.name}</h1>
          </div>
        </div>

        {/* Meta chips */}
        <div className="grid grid-cols-2 gap-3 border-b border-border bg-muted/40 px-8 py-4 sm:grid-cols-4">
          {meta.map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
              <div className="text-sm font-semibold text-foreground">{value || "—"}</div>
            </div>
          ))}
        </div>

        {/* Two-column body (landscape) */}
        <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-2">
          {/* Left: description + competencies */}
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 border-r-4 border-primary pr-2 text-sm font-bold text-primary">الوصف الوظيفي</h2>
              {data.description ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{data.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">لا يوجد وصف.</p>
              )}
            </section>

            <section>
              <h2 className="mb-2 border-r-4 border-primary pr-2 text-sm font-bold text-primary">الجدارات المطلوبة</h2>
              {data.competencies.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.competencies.map((c) => (
                    <span key={c.competency.name} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      {c.competency.name}
                      <span className="opacity-60"> · {COMPETENCY_TYPE_LABELS[c.competency.type as CompetencyType]}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد جدارات مرتبطة.</p>
              )}
            </section>
          </div>

          {/* Right: KPIs */}
          <section>
            <h2 className="mb-2 border-r-4 border-accent pr-2 text-sm font-bold text-[hsl(38_70%_38%)]">
              مؤشرات الأداء الرئيسية (KPIs)
            </h2>
            {kpiGroups.length ? (
              <div className="space-y-4">
                {kpiGroups.map((g, gi) => (
                  <div key={gi}>
                    <div className="mb-1 text-xs font-bold text-foreground">{g.competencyName}</div>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/60 text-muted-foreground">
                          <th className="border border-border px-2 py-1 text-right">المؤشر</th>
                          <th className="border border-border px-2 py-1 text-right">القياس</th>
                          <th className="border border-border px-2 py-1 text-center">المستهدف</th>
                          <th className="border border-border px-2 py-1 text-center">الوزن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.kpis.map((k, ki) => (
                          <tr key={ki}>
                            <td className="border border-border px-2 py-1">{k.name}</td>
                            <td className="border border-border px-2 py-1 text-muted-foreground">{k.measure ?? "—"}</td>
                            <td className="border border-border px-2 py-1 text-center">{k.target ?? "—"}</td>
                            <td className="border border-border px-2 py-1 text-center">{k.weight ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد مؤشرات أداء محفوظة لهذه الوظيفة.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
