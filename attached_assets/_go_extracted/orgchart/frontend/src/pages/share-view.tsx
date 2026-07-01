import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Lock, Eye, Building2, MapPin, Mail, Briefcase } from "lucide-react";
import {
  useGetPublicShareInfo,
  getGetPublicShareInfoQueryKey,
  getSharedChart,
} from "@workspace/api-client-react";
import type { Employee, SharedChart } from "@workspace/api-client-react";

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

function ChartWatermark({ orgName, label }: { orgName: string; label: string }) {
  const text = `${orgName} • ${label}`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      data-testid="share-watermark"
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="share-watermark-pattern"
            patternUnits="userSpaceOnUse"
            width="360"
            height="180"
            patternTransform="rotate(-30)"
          >
            <text
              x="0"
              y="90"
              fill="currentColor"
              fontSize="14"
              fontWeight="500"
              className="text-foreground/10"
            >
              {text}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#share-watermark-pattern)" />
      </svg>
    </div>
  );
}

function buildTree(employees: Employee[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  employees.forEach((e) => byId.set(e.id, { employee: e, children: [] }));
  const roots: TreeNode[] = [];
  employees.forEach((e) => {
    const node = byId.get(e.id)!;
    if (e.managerId != null && byId.has(e.managerId)) {
      byId.get(e.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function EmployeeCard({ employee }: { employee: Employee }) {
  const initials =
    `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <div
      className="bg-card border border-border rounded-lg p-3 shadow-sm w-64 flex items-center gap-3"
      data-testid={`share-employee-${employee.id}`}
    >
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold flex-shrink-0 overflow-hidden">
        {employee.avatarUrl ? (
          <img src={employee.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">
          {employee.firstName} {employee.lastName}
        </p>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <Briefcase className="h-3 w-3 shrink-0" />
          {employee.title}
        </p>
        {employee.location && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {employee.location}
          </p>
        )}
        {employee.email && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <Mail className="h-3 w-3 shrink-0" />
            {employee.email}
          </p>
        )}
      </div>
    </div>
  );
}

function TreeBranch({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <li className="my-1">
      <div className="flex items-start gap-2">
        <EmployeeCard employee={node.employee} />
      </div>
      {node.children.length > 0 && (
        <ul className="ms-6 mt-2 border-s border-border ps-4 space-y-2">
          {node.children
            .slice()
            .sort((a, b) =>
              `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(
                `${b.employee.firstName} ${b.employee.lastName}`,
              ),
            )
            .map((child) => (
              <TreeBranch key={child.employee.id} node={child} depth={depth + 1} />
            ))}
        </ul>
      )}
    </li>
  );
}

export default function ShareView() {
  const { t } = useTranslation();
  const segments = window.location.pathname.split("/").filter(Boolean);
  const shareIdx = segments.lastIndexOf("share");
  const token = shareIdx >= 0 ? segments[shareIdx + 1] || "" : "";

  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
  } = useGetPublicShareInfo(token, {
    query: { enabled: !!token, queryKey: getGetPublicShareInfoQueryKey(token), retry: false },
  });

  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | null>(null);
  const [chart, setChart] = useState<SharedChart | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string>("");
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  const [postFetchStatus, setPostFetchStatus] = useState<string>("");

  const requiresPassword = info?.requiresPassword ?? false;
  const status = postFetchStatus || info?.status || "active";

  useEffect(() => {
    if (!info || status !== "active") return;
    if (requiresPassword && submittedPassword === null) {
      setNeedsPassword(true);
      return;
    }
    setChartLoading(true);
    setChartError("");
    getSharedChart(token, submittedPassword ? { password: submittedPassword } : undefined)
      .then((data) => {
        setChart(data);
        setNeedsPassword(false);
      })
      .catch((err: { status?: number; message?: string; data?: { status?: string } }) => {
        if (err?.status === 401) {
          setNeedsPassword(true);
          setChartError(submittedPassword ? t("share.incorrectPassword") : "");
        } else if (err?.status === 410 && err?.data?.status) {
          setPostFetchStatus(err.data.status);
        } else {
          setChartError(err?.message || t("share.loadError"));
        }
      })
      .finally(() => setChartLoading(false));
  }, [info, requiresPassword, submittedPassword, token, status, t]);

  const tree = useMemo(() => (chart ? buildTree(chart.employees) : []), [chart]);

  const formatDate = (s: string | null | undefined) => {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t("share.invalidLink")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (infoLoading) {
    return (
      <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (infoError || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full" data-testid="card-share-not-found">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t("share.notFound")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("share.notFoundDesc")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status !== "active") {
    const key =
      status === "expired"
        ? "share.expired"
        : status === "exhausted"
          ? "share.exhausted"
          : "share.revoked";
    const descKey =
      status === "expired"
        ? "share.expiredDesc"
        : status === "exhausted"
          ? "share.exhaustedDesc"
          : "share.revokedDesc";
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full" data-testid={`card-share-${status}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t(key)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{t(descKey)}</CardContent>
        </Card>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full" data-testid="card-share-password">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t("share.passwordRequired")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("share.passwordRequiredDesc", { org: info.organizationName })}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmittedPassword(password);
              }}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="share-password">{t("share.password")}</Label>
                <Input
                  id="share-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-share-password"
                  autoFocus
                />
              </div>
              {chartError && (
                <p className="text-xs text-destructive" data-testid="text-share-password-error">
                  {chartError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={!password || chartLoading}
                data-testid="button-share-password-submit"
              >
                {chartLoading ? t("share.loading") : t("share.unlock")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-muted/20">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-share-org-name">
                {info.organizationName}
              </h1>
              <p className="text-xs text-muted-foreground">
                {info.chartName ? info.chartName : t("share.orgChart")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" />
              {t("share.readOnly")}
            </Badge>
            {info.expiresAt && (
              <Badge variant="secondary" className="text-xs">
                {t("share.expiresOn", { date: formatDate(info.expiresAt) })}
              </Badge>
            )}
          </div>
        </div>

        {chartLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {chartError && !chartLoading && (
          <Card className="border-destructive/30">
            <CardContent className="py-4 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {chartError}
            </CardContent>
          </Card>
        )}

        {!chartLoading && chart && tree.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("share.empty")}
            </CardContent>
          </Card>
        )}

        {!chartLoading && tree.length > 0 && (
          <Card className="relative overflow-hidden">
            <CardContent className="py-4 overflow-x-auto relative">
              <ul className="space-y-2 relative z-10" data-testid="share-chart-tree">
                {tree.map((root) => (
                  <TreeBranch key={root.employee.id} node={root} />
                ))}
              </ul>
              <ChartWatermark
                orgName={info.organizationName}
                label={t("share.watermarkLabel")}
              />
            </CardContent>
            <div
              className="pointer-events-none absolute bottom-2 end-3 z-10 flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm border border-border/50"
              data-testid="share-watermark-badge"
            >
              <Eye className="h-3 w-3" />
              <span>
                {info.organizationName} · {t("share.watermarkLabel")}
              </span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
