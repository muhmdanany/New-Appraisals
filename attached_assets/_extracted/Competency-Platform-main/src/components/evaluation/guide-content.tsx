import { Info, AlertTriangle, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GUIDE_USAGE,
  GUIDE_FORMULA,
  RATING_SCALE,
  COMPETENCY_GUIDE,
  EVALUATOR_ALERTS,
  FINAL_RATING,
  SCORE_COLORS,
} from "@/content/evaluation-guide";

function ScoreChip({ score, label }: { score: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="flex size-6 items-center justify-center rounded-md text-xs font-bold text-white"
        style={{ background: SCORE_COLORS[score] }}
      >
        {score}
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </span>
  );
}

export function GuideContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      {/* Usage */}
      <Card className="flex gap-3 border-primary/30 bg-primary/5 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <div className="mb-1 font-bold text-primary">كيفية الاستخدام</div>
          <p className="text-foreground">{GUIDE_USAGE}</p>
        </div>
      </Card>

      {/* Rating scale */}
      <section>
        <h2 className="mb-2 text-base font-bold">مقياس التقييم — ملخص سريع</h2>
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">الدرجة</TableHead>
                <TableHead className="w-24">النطاق</TableHead>
                <TableHead>دلالة للمقيّم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RATING_SCALE.map((s) => (
                <TableRow key={s.score}>
                  <TableCell>
                    <ScoreChip score={s.score} label={s.label} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.range}</TableCell>
                  <TableCell className="text-muted-foreground">{s.meaning}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Competency matrices */}
      {COMPETENCY_GUIDE.map((section) => (
        <section key={section.title}>
          <h2 className="mb-2 text-base font-bold">{section.title}</h2>
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">المستوى</TableHead>
                  {section.dimensions.map((d) => (
                    <TableHead key={d}>{d}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.levels.map((lvl) => (
                  <TableRow key={lvl.score}>
                    <TableCell className="align-top">
                      <ScoreChip score={lvl.score} label={lvl.label} />
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{lvl.range}</div>
                    </TableCell>
                    {section.dimensions.map((d) => (
                      <TableCell key={d} className="align-top text-xs text-muted-foreground">
                        {lvl.items[d]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      ))}

      {/* Evaluator pitfalls */}
      <section>
        <h2 className="mb-2 text-base font-bold">تنبيهات جوهرية للمقيّم</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {EVALUATOR_ALERTS.map((a) => (
            <Card key={a.title} className="flex gap-2.5 border-warning/30 bg-warning/5 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <div className="text-sm font-bold text-foreground">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.text}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Final rating actions */}
      <section>
        <h2 className="mb-2 text-base font-bold">جدول التقدير النهائي — الدرجة الإجمالية من 100</h2>
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">النطاق</TableHead>
                <TableHead className="w-32">التقدير</TableHead>
                <TableHead>الإجراء المترتب</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FINAL_RATING.map((r) => (
                <TableRow key={r.range}>
                  <TableCell className="font-mono text-xs">{r.range}</TableCell>
                  <TableCell className="font-semibold">{r.label}</TableCell>
                  <TableCell className="text-muted-foreground">{r.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Formula */}
      <Card className="flex gap-3 border-accent/40 bg-accent/10 p-4">
        <Calculator className="mt-0.5 size-5 shrink-0 text-[hsl(38_70%_38%)]" />
        <div>
          <div className="mb-1 font-bold">معادلة الدرجة الإجمالية من 100</div>
          <p className="font-semibold text-foreground">{GUIDE_FORMULA.equation}</p>
          <p className="text-xs text-muted-foreground">{GUIDE_FORMULA.note}</p>
        </div>
      </Card>
    </div>
  );
}
