import { Badge, type BadgeProps } from "@/components/ui/badge";
import { CAREER_STAGE_LEVEL_LABELS, type CareerStageLevel } from "@/lib/enums";

export interface StageView {
  title: string;
  level: CareerStageLevel;
  gradeNum?: string | null;
  durationInRole?: string | null;
  description?: string | null;
  requiredCompetencies: string[];
  promotionCriteria: string[];
}

const LEVEL_VARIANT: Record<CareerStageLevel, BadgeProps["variant"]> = {
  ENTRY: "muted",
  MID: "default",
  SENIOR: "success",
  LEAD: "warning",
  EXEC: "purple",
};

export function StageTimeline({ stages }: { stages: StageView[] }) {
  return (
    <ol className="relative space-y-4 border-r-2 border-border pr-5">
      {stages.map((s, i) => (
        <li key={i} className="relative">
          <span className="absolute -right-[27px] top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {i + 1}
          </span>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-foreground">{s.title}</span>
              <Badge variant={LEVEL_VARIANT[s.level]}>{CAREER_STAGE_LEVEL_LABELS[s.level]}</Badge>
              {s.gradeNum && <span className="text-[11px] text-muted-foreground">درجة {s.gradeNum}</span>}
              {s.durationInRole && <span className="text-[11px] text-muted-foreground">· {s.durationInRole}</span>}
            </div>
            {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
            {s.requiredCompetencies.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] font-bold text-muted-foreground">الجدارات المطلوبة</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.requiredCompetencies.map((c, j) => (
                    <span key={j} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {s.promotionCriteria.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] font-bold text-muted-foreground">معايير الترقية</div>
                <ul className="mt-1 list-disc space-y-0.5 pr-4 text-[11px] text-muted-foreground">
                  {s.promotionCriteria.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
