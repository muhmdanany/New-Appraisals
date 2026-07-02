import { useState, useMemo } from "react";
import { useReportBellCurve } from "@workspace/api-client-react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Target } from "lucide-react";

// Bell-curve SVG path — a smooth asymmetric curve
function BellCurveSVG({ labels, pcts }: { labels: string[]; pcts: number[] }) {
  // We draw a smooth bell curve shape from left to right
  const w = 600, h = 260, pad = 40;
  const n = labels.length;
  const slotW = (w - pad * 2) / n;

  // Build a smooth bell-curve path using cubic beziers
  // The curve peaks at index 1-2 (فوق المتوقع / حسب المتوقع)
  const points = pcts.map((p, i) => ({
    x: pad + slotW * i + slotW / 2,
    y: h - pad - (p / 50) * (h - pad * 2),
  }));

  // Build SVG path with smooth curves
  let d = `M ${pad},${h - pad}`;
  // Line up to first point
  d += ` L ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpx = (curr.x + next.x) / 2;
    d += ` C ${cpx},${curr.y} ${cpx},${next.y} ${next.x},${next.y}`;
  }
  d += ` L ${w - pad},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full" style={{ direction: "ltr" }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={pad}
          y1={h - pad - f * (h - pad * 2)}
          x2={w - pad}
          y2={h - pad - f * (h - pad * 2)}
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeDasharray="4"
        />
      ))}

      {/* Filled area */}
      <path
        d={d + ` Z`}
        fill="url(#bellGrad)"
        stroke="none"
      />

      {/* Line on top */}
      <path
        d={`M ${points[0].x},${points[0].y} ${points
          .slice(1)
          .map((p, i) => {
            const prev = points[i];
            const cpx = (prev.x + p.x) / 2;
            return `C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
          })
          .join(" ")}`}
        fill="none"
        stroke="#1e3a5f"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Percentage labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={p.y - 12}
          textAnchor="middle"
          className="fill-foreground text-sm font-bold"
          fontSize="14"
        >
          {pcts[i]}%
        </text>
      ))}

      {/* X-axis labels */}
      {labels.map((label, i) => (
        <text
          key={i}
          x={pad + slotW * i + slotW / 2}
          y={h + 10}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="12"
        >
          {label}
        </text>
      ))}

      <defs>
        <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.05" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function BellCurve() {
  const { t } = useTranslation();
  const { data: report, isLoading } = useReportBellCurve();
  const [selectedDept, setSelectedDept] = useState<string>("all");

  // Parse policy
  const policy = report?.policy as any;
  const labels: string[] = policy?.labels ?? [t("bellCurve.defaultLabels.1"), t("bellCurve.defaultLabels.2"), t("bellCurve.defaultLabels.3"), t("bellCurve.defaultLabels.4"), t("bellCurve.defaultLabels.5")];
  const reversedLabels = [...labels].reverse();
  const policyAbove: number[] = policy?.above ?? [0, 0, 35, 50, 15];
  const policyAchieved: number[] = policy?.achieved ?? [5, 5, 40, 40, 10];
  const policyBelow: number[] = policy?.below ?? [10, 10, 35, 40, 5];
  const policyName = report?.policyName ?? t("bellCurve.defaultPolicy");

  // Departments
  const departments = report?.departments ?? [];

  // Achievement summary: above/achieved/below 95%
  const aboveTarget = departments.filter((d: any) => d.achievement > 100).length;
  const achievedTarget = departments.filter((d: any) => d.achievement >= 95 && d.achievement <= 100).length;
  const belowTarget = departments.filter((d: any) => d.achievement < 95).length;

  // Selected department data
  const selectedDeptData = useMemo(() => {
    if (selectedDept === "all") return null;
    return departments.find((d: any) => d.id === selectedDept);
  }, [selectedDept, departments]);

  // Compute dept compliance/exceeded
  const deptCompliant = selectedDeptData ? (selectedDeptData.achievement >= 95 ? 1 : 0) : 0;
  const deptExceeded = selectedDeptData ? (selectedDeptData.achievement > 100 ? 1 : 0) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("bellCurve.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("bellCurve.subtitle")}
        </p>
      </div>

      {/* Top summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-r-4 border-r-emerald-500">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <div className="text-emerald-600 font-bold text-lg">{t("bellCurve.aboveTarget")}</div>
              <div className="text-xs text-muted-foreground">{t("bellCurve.achievementAbove")}</div>
            </div>
            <div className="text-4xl font-bold">{aboveTarget}</div>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-blue-500">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <div className="text-blue-600 font-bold text-lg">{t("bellCurve.metTarget")}</div>
              <div className="text-xs text-muted-foreground">{t("bellCurve.achievementMet")}</div>
            </div>
            <div className="text-4xl font-bold">{achievedTarget}</div>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-red-500">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <div className="text-red-600 font-bold text-lg">{t("bellCurve.belowTarget")}</div>
              <div className="text-xs text-muted-foreground">{t("bellCurve.achievementBelow")}</div>
            </div>
            <div className="text-4xl font-bold">{belowTarget}</div>
          </CardContent>
        </Card>
      </div>

      {/* Middle row: Bell curve chart + Policy table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bell Curve Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-base">{t("bellCurve.policyChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BellCurveSVG
              labels={reversedLabels}
              pcts={[...policyAchieved].reverse()}
            />
          </CardContent>
        </Card>

        {/* Policy Table */}
        <Card>
          <CardHeader className="pb-2 bg-[#1e3a5f] text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm">{policyName}</span>
              <CardTitle className="text-base">{t("bellCurve.policyTable")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-center">{t("bellCurve.belowTarget")}</TableHead>
                  <TableHead className="text-center">{t("bellCurve.metTarget")}</TableHead>
                  <TableHead className="text-center">{t("bellCurve.aboveTarget")}</TableHead>
                  <TableHead className="text-right font-bold">{t("bellCurve.ratingCategory")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reversedLabels.map((label, i) => {
                  const ri = labels.length - 1 - i; // reverse index back to original
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-center">{policyBelow[ri]}%</TableCell>
                      <TableCell className="text-center">{policyAchieved[ri]}%</TableCell>
                      <TableCell className="text-center">{policyAbove[ri]}%</TableCell>
                      <TableCell className="text-right font-bold">{label}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Department chart + Department selector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department comparison chart */}
        <Card className="min-h-[280px] flex flex-col items-center justify-center">
          {selectedDeptData ? (
            <CardContent className="w-full pt-6">
              <h3 className="text-lg font-bold text-center mb-4">
                {t("bellCurve.deptDistribution")} {selectedDeptData.name}
              </h3>
              <div className="space-y-3">
                {reversedLabels.map((label, i) => {
                  const ri = labels.length - 1 - i;
                  const count = selectedDeptData.categories?.[ri] ?? 0;
                  const total = selectedDeptData.evaluatedCount || 1;
                  const pct = (count / total) * 100;
                  const targetPct = policyAchieved[ri];
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{label}</span>
                        <span>
                          {count} ({Math.round(pct)}%)
                          <span className="text-muted-foreground text-xs mr-2">{t("bellCurve.target")} {targetPct}%</span>
                        </span>
                      </div>
                      <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1e3a5f] rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                        <div
                          className="absolute top-0 h-full w-0.5 bg-red-500"
                          style={{ left: `${targetPct}%` }}
                          title={`${t("bellCurve.target")} ${targetPct}%`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t("bellCurve.selectDeptHint")}</p>
            </div>
          )}
        </Card>

        {/* Department selector + summary */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div>
              <label className="text-sm font-bold text-primary mb-2 block">{t("bellCurve.selectDept")}</label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger>
                  <SelectValue placeholder={t("bellCurve.selectFromList")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("bellCurve.selectFromList")}</SelectItem>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDeptData && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="text-center py-4">
                  <div className="text-emerald-600 font-bold text-sm mb-1">{t("bellCurve.compliant")}</div>
                  <div className="text-4xl font-bold text-emerald-600">{deptCompliant}</div>
                </Card>
                <Card className="text-center py-4">
                  <div className="text-red-600 font-bold text-sm mb-1">{t("bellCurve.exceeded")}</div>
                  <div className="text-4xl font-bold text-red-600">{deptExceeded}</div>
                </Card>
              </div>
            )}

            {selectedDeptData && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-sm text-muted-foreground mb-1">{t("bellCurve.achievementRate")}</div>
                <div className="text-3xl font-bold">
                  {selectedDeptData.achievement?.toFixed(0) ?? 0}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
