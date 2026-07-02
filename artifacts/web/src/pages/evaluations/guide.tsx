import { Link } from "wouter";
import { Printer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

const RATING_COLORS: Record<number, string> = {
  5: "#1a7f4b",
  4: "#27ae60",
  3: "#2a6db5",
  2: "#b87d12",
  1: "#c0392b",
};

export default function EvaluationGuidePage() {
  const { t } = useTranslation();

  const RATING_GUIDE = [
    { score: 5, label: t("evaluations.guide.ratingGuide.5.label"), color: RATING_COLORS[5], desc: t("evaluations.guide.ratingGuide.5.desc") },
    { score: 4, label: t("evaluations.guide.ratingGuide.4.label"), color: RATING_COLORS[4], desc: t("evaluations.guide.ratingGuide.4.desc") },
    { score: 3, label: t("evaluations.guide.ratingGuide.3.label"), color: RATING_COLORS[3], desc: t("evaluations.guide.ratingGuide.3.desc") },
    { score: 2, label: t("evaluations.guide.ratingGuide.2.label"), color: RATING_COLORS[2], desc: t("evaluations.guide.ratingGuide.2.desc") },
    { score: 1, label: t("evaluations.guide.ratingGuide.1.label"), color: RATING_COLORS[1], desc: t("evaluations.guide.ratingGuide.1.desc") },
  ];

  const WORKFLOW_STEPS = [
    { step: "1", title: t("evaluations.guide.workflow.step1.title"), desc: t("evaluations.guide.workflow.step1.desc") },
    { step: "2", title: t("evaluations.guide.workflow.step2.title"), desc: t("evaluations.guide.workflow.step2.desc") },
    { step: "3", title: t("evaluations.guide.workflow.step3.title"), desc: t("evaluations.guide.workflow.step3.desc") },
    { step: "4", title: t("evaluations.guide.workflow.step4.title"), desc: t("evaluations.guide.workflow.step4.desc") },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("evaluations.guide.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("evaluations.guide.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t("common.printPDF")}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluations">
              <ArrowRight className="size-4" />
              {t("evaluations.guide.backToEvals")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Rating guide */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">{t("evaluations.guide.scaleTitle")}</h2>
        <div className="space-y-2">
          {RATING_GUIDE.map((r) => (
            <div key={r.score} className="flex items-start gap-3">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ background: r.color }}
              >
                {r.score}
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: r.color }}>
                  {r.label}
                </div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* KPI guide */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">{t("evaluations.guide.kpiTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("evaluations.guide.kpiDesc")}
        </p>
      </Card>

      {/* Scoring formula */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">{t("evaluations.guide.formulaTitle")}</h2>
        <div className="rounded-md bg-muted p-3 text-sm font-mono text-center">
          {t("evaluations.guide.formula")}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("evaluations.guide.formulaNote")}
        </p>
      </Card>

      {/* Workflow */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">{t("evaluations.guide.workflowTitle")}</h2>
        <ol className="relative space-y-3 border-r-2 border-border pr-5">
          {WORKFLOW_STEPS.map((w) => (
            <li key={w.step} className="relative">
              <span className="absolute -right-[27px] top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {w.step}
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">{w.title}</div>
                <div className="text-xs text-muted-foreground">{w.desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
