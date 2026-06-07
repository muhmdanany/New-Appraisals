import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Briefcase, MapPin, Mail, Building2 } from "lucide-react";
import { getEmbedChart } from "@workspace/api-client-react";
import type { Employee, EmbedChart } from "@workspace/api-client-react";

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
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
    `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?";
  return (
    <div
      className="bg-card border border-border rounded-lg p-3 shadow-sm w-64 flex items-center gap-3"
      data-testid={`embed-employee-${employee.id}`}
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

function TreeBranch({ node }: { node: TreeNode }) {
  return (
    <li className="my-1">
      <EmployeeCard employee={node.employee} />
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
              <TreeBranch key={child.employee.id} node={child} />
            ))}
        </ul>
      )}
    </li>
  );
}

export default function EmbedView() {
  const { t } = useTranslation();
  const segments = window.location.pathname.split("/").filter(Boolean);
  const idx = segments.lastIndexOf("embed");
  const token = idx >= 0 ? segments[idx + 1] || "" : "";

  const [data, setData] = useState<EmbedChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("active");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(t("embed.invalidLink"));
      return;
    }
    setLoading(true);
    getEmbedChart(token)
      .then((d) => setData(d))
      .catch((err: { status?: number; data?: { status?: string }; message?: string }) => {
        if (err?.status === 404) {
          setError(t("embed.notFoundDesc"));
        } else if (err?.status === 410) {
          const s = err?.data?.status || "expired";
          setStatus(s);
          if (s === "revoked") setError(t("embed.revokedDesc"));
          else if (s === "exhausted") setError(t("embed.exhaustedDesc"));
          else setError(t("embed.expiredDesc"));
        } else {
          setError(err?.message || t("embed.loadError"));
        }
      })
      .finally(() => setLoading(false));
  }, [token, t]);

  const tree = useMemo(() => (data ? buildTree(data.employees) : []), [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div
          className="max-w-md w-full border border-border rounded-md p-4 text-sm text-muted-foreground flex items-start gap-2"
          data-testid={`embed-error-${status}`}
        >
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" data-testid="text-embed-org-name">
              {data.organization.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {data.label || data.chartViewName || data.chartName || t("embed.orgChart")}
            </p>
          </div>
        </div>

        {tree.length === 0 ? (
          <p
            className="text-sm text-muted-foreground text-center py-10"
            data-testid="text-embed-empty"
          >
            {t("embed.empty")}
          </p>
        ) : (
          <ul className="space-y-2" data-testid="embed-chart-tree">
            {tree.map((root) => (
              <TreeBranch key={root.employee.id} node={root} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
