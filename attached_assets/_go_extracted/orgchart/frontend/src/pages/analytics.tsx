import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetAnalytics,
  getGetAnalyticsQueryKey,
  getExportAnalyticsCsvUrl,
} from "@workspace/api-client-react";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ShieldAlert } from "lucide-react";
import { AnalyticsReportSubscriptionsButton } from "@/components/analytics-report-subscriptions";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Preset = "30" | "90" | "365" | "custom";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  const from = new Date(today);
  if (p === "30") from.setDate(from.getDate() - 30);
  else if (p === "90") from.setDate(from.getDate() - 90);
  else from.setDate(from.getDate() - 365);
  return { from: isoDay(from), to };
}

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const isRtl = i18n.language === "ar";

  const [preset, setPreset] = useState<Preset>("365");
  const [from, setFrom] = useState<string>(() => presetRange("365").from);
  const [to, setTo] = useState<string>(() => presetRange("365").to);

  const params = useMemo(() => ({ from, to }), [from, to]);

  const canView = hasPermission("analytics", "view");

  const { data, isLoading } = useGetAnalytics(
    selectedOrgId!,
    params,
    {
      query: {
        enabled: !!selectedOrgId && canView,
        queryKey: getGetAnalyticsQueryKey(selectedOrgId!, params),
      },
    },
  );

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  function exportCsv(widget: string) {
    if (!selectedOrgId) return;
    const url = getExportAnalyticsCsvUrl(selectedOrgId, { widget, from, to });
    window.open(url, "_blank");
  }

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("dashboard.selectOrgToDash")}</div>;
  }

  if (!canView) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-2">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t("analytics.noPermission")}</h2>
            <p className="text-sm text-muted-foreground">{t("analytics.permissionHelp")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatMonth = (s: string) => {
    if (!s) return s;
    const d = new Date(s);
    return d.toLocaleDateString(isRtl ? "ar-SA" : "en-US", { month: "short", year: "2-digit" });
  };

  return (
    <div className="flex-1 overflow-y-auto" data-testid="analytics-page">
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              {t("analytics.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="self-end">
              <AnalyticsReportSubscriptionsButton orgId={selectedOrgId} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("analytics.range")}</div>
              <Select value={preset} onValueChange={(v) => applyPreset(v as Preset)}>
                <SelectTrigger className="w-[180px]" data-testid="select-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">{t("analytics.range30")}</SelectItem>
                  <SelectItem value="90">{t("analytics.range90")}</SelectItem>
                  <SelectItem value="365">{t("analytics.range365")}</SelectItem>
                  <SelectItem value="custom">{t("analytics.rangeCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t("analytics.from")}</div>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    data-testid="input-from"
                    className="w-[160px]"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t("analytics.to")}</div>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    data-testid="input-to"
                    className="w-[160px]"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Headcount over time */}
            <Card data-testid="widget-headcount">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{t("analytics.headcountTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.headcountSubtitle")}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportCsv("headcount")}
                  data-testid="export-headcount"
                >
                  <Download className="h-4 w-4 me-1" /> {t("analytics.export")}
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.headcountOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatMonth}
                      reversed={isRtl}
                    />
                    <YAxis orientation={isRtl ? "right" : "left"} />
                    <Tooltip labelFormatter={formatMonth} />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" name={t("analytics.headcountTotal")} />
                    <Line type="monotone" dataKey="active" stroke="#10b981" name={t("analytics.headcountActive")} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Span of control */}
            <Card data-testid="widget-span">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{t("analytics.spanTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.spanSubtitle")}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>
                      {t("analytics.spanAverage")}: <strong data-testid="span-average">{data.spanAverage.toFixed(1)}</strong>
                    </span>
                    <span>
                      {t("analytics.spanMedian")}: <strong data-testid="span-median">{data.spanMedian.toFixed(1)}</strong>
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportCsv("span")} data-testid="export-span">
                  <Download className="h-4 w-4 me-1" /> {t("analytics.export")}
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.spanOfControl}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="directReports" reversed={isRtl} />
                    <YAxis orientation={isRtl ? "right" : "left"} />
                    <Tooltip />
                    <Bar dataKey="managerCount" fill="#6366f1" name={t("analytics.spanManagers")} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Org depth */}
            <Card data-testid="widget-depth">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{t("analytics.depthTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.depthSubtitle")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportCsv("depth")} data-testid="export-depth">
                  <Download className="h-4 w-4 me-1" /> {t("analytics.export")}
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.orgDepth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="depth" reversed={isRtl} />
                    <YAxis orientation={isRtl ? "right" : "left"} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" name={t("analytics.depthCount")} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Department headcount */}
            <Card data-testid="widget-departments">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{t("analytics.departmentTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.departmentSubtitle")}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportCsv("departments")}
                  data-testid="export-departments"
                >
                  <Download className="h-4 w-4 me-1" /> {t("analytics.export")}
                </Button>
              </CardHeader>
              <CardContent>
                {data.departmentHeadcount.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-12">{t("analytics.noData")}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={data.departmentHeadcount}
                          dataKey="employeeCount"
                          nameKey="departmentName"
                          innerRadius={50}
                          outerRadius={90}
                        >
                          {data.departmentHeadcount.map((d, i) => (
                            <Cell key={i} fill={d.color || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-sm max-h-60 overflow-auto">
                      <table className="w-full">
                        <thead className="text-xs text-muted-foreground">
                          <tr>
                            <th className="text-start py-1">{t("analytics.departmentName")}</th>
                            <th className="text-end py-1">{t("analytics.departmentCount")}</th>
                            <th className="text-end py-1">{t("analytics.departmentShare")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.departmentHeadcount.map((d) => (
                            <tr key={d.departmentId} className="border-t border-border">
                              <td className="py-1 flex items-center gap-2">
                                <span
                                  className="inline-block h-3 w-3 rounded-sm"
                                  style={{ backgroundColor: d.color || "#94a3b8" }}
                                />
                                {d.departmentName}
                              </td>
                              <td className="text-end py-1">{d.employeeCount}</td>
                              <td className="text-end py-1">{(d.share * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open vs filled */}
            <Card data-testid="widget-open-filled">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{t("analytics.openVsFilledTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.openVsFilledSubtitle")}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportCsv("open-vs-filled")}
                  data-testid="export-open-vs-filled"
                >
                  <Download className="h-4 w-4 me-1" /> {t("analytics.export")}
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.openVsFilled}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatMonth} reversed={isRtl} />
                    <YAxis orientation={isRtl ? "right" : "left"} />
                    <Tooltip labelFormatter={formatMonth} />
                    <Legend />
                    <Line type="monotone" dataKey="open" stroke="#ef4444" name={t("analytics.open")} />
                    <Line type="monotone" dataKey="filled" stroke="#22c55e" name={t("analytics.filled")} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top growth */}
            <Card data-testid="widget-growth">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{t("analytics.growthTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.growthSubtitle")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportCsv("growth")} data-testid="export-growth">
                  <Download className="h-4 w-4 me-1" /> {t("analytics.export")}
                </Button>
              </CardHeader>
              <CardContent>
                {data.topDepartmentsByGrowth.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-12">{t("analytics.noData")}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-start py-1">{t("analytics.departmentName")}</th>
                        <th className="text-end py-1">{t("analytics.changeStart")}</th>
                        <th className="text-end py-1">{t("analytics.changeEnd")}</th>
                        <th className="text-end py-1">{t("analytics.change")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topDepartmentsByGrowth.map((d) => (
                        <tr key={d.departmentId} className="border-t border-border">
                          <td className="py-1.5 flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-sm"
                              style={{ backgroundColor: d.color || "#94a3b8" }}
                            />
                            {d.departmentName}
                          </td>
                          <td className="text-end py-1.5">{d.start}</td>
                          <td className="text-end py-1.5">{d.end}</td>
                          <td className="text-end py-1.5 text-green-600 font-medium">+{d.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Top attrition */}
            <Card data-testid="widget-attrition">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{t("analytics.attritionTitle")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.attritionSubtitle")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportCsv("attrition")} data-testid="export-attrition">
                  <Download className="h-4 w-4 me-1" /> {t("analytics.export")}
                </Button>
              </CardHeader>
              <CardContent>
                {data.topDepartmentsByAttrition.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-12">{t("analytics.noData")}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-start py-1">{t("analytics.departmentName")}</th>
                        <th className="text-end py-1">{t("analytics.changeStart")}</th>
                        <th className="text-end py-1">{t("analytics.changeEnd")}</th>
                        <th className="text-end py-1">{t("analytics.change")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topDepartmentsByAttrition.map((d) => (
                        <tr key={d.departmentId} className="border-t border-border">
                          <td className="py-1.5 flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-sm"
                              style={{ backgroundColor: d.color || "#94a3b8" }}
                            />
                            {d.departmentName}
                          </td>
                          <td className="text-end py-1.5">{d.start}</td>
                          <td className="text-end py-1.5">{d.end}</td>
                          <td className="text-end py-1.5 text-red-600 font-medium">{d.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
