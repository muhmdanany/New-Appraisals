import { Link } from "wouter";
import { Printer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const RATING_GUIDE = [
  { score: 5, label: "متميز", color: "#1a7f4b", desc: "أداء استثنائي يتجاوز كافة التوقعات بشكل مستمر ومتكرر." },
  { score: 4, label: "يتجاوز", color: "#27ae60", desc: "أداء مرتفع يتجاوز معظم المتطلبات والتوقعات." },
  { score: 3, label: "يحقق", color: "#2a6db5", desc: "أداء جيد يلبّي المتطلبات والتوقعات المحددة." },
  { score: 2, label: "يحتاج تحسين", color: "#b87d12", desc: "أداء أقل من المطلوب ويحتاج إلى خطة تطوير." },
  { score: 1, label: "دون المستوى", color: "#c0392b", desc: "أداء ضعيف لا يلبّي الحد الأدنى من المتطلبات." },
];

const WORKFLOW_STEPS = [
  { step: "1", title: "المسودة (Draft)", desc: "ينشئ المقيّم التقييم ويحفظه كمسودة، يمكن التعديل عليه." },
  { step: "2", title: "إرسال للاعتماد (Submitted)", desc: "يُرسل التقييم للمدير الأعلى للمراجعة والاعتماد." },
  { step: "3", title: "الاعتماد / الرفض", desc: "المعتمد يراجع التقييم ويقرر اعتماده أو رفضه مع إبداء الأسباب." },
  { step: "4", title: "اطلاع الموظف", desc: "بعد الاعتماد يطّلع الموظف على النتيجة ويقر أو يعترض على بنود محددة." },
];

export default function EvaluationGuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">دليل معايير التقييم</h1>
          <p className="text-sm text-muted-foreground">
            المرجع المعتمد لاختيار درجات الجدارات ومؤشرات الأداء
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            طباعة / حفظ PDF
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluations">
              <ArrowRight className="size-4" />
              التقييمات
            </Link>
          </Button>
        </div>
      </div>

      {/* Rating guide */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">مقياس تقييم الجدارات (1–5)</h2>
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
        <h2 className="mb-3 text-sm font-bold">مؤشرات الأداء (KPIs)</h2>
        <p className="text-sm text-muted-foreground">
          نسبة تحقق المؤشر من 0% إلى 100%. يُحسب المعدل العام لجميع المؤشرات
          ويُرجّح بحسب الوزن المحدد (افتراضياً 60% للمؤشرات و40% للجدارات).
        </p>
      </Card>

      {/* Scoring formula */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">معادلة الاحتساب</h2>
        <div className="rounded-md bg-muted p-3 text-sm font-mono text-center">
          الدرجة الإجمالية = (معدل الجدارات × وزن الجدارات) + (معدل المؤشرات × وزن المؤشرات)
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          معدل الجدارات يُحسب من متوسط الدرجات (1-5) مقسوماً على 5 ومضروباً في 100.
        </p>
      </Card>

      {/* Workflow */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">مراحل سير العمل</h2>
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
