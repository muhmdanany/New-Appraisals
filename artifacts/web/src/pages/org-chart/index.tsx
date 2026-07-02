import { useState } from "react";
import { useReportOrgTree } from "@workspace/api-client-react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronLeft, User, Users } from "lucide-react";

type OrgNode = {
  id: string;
  name: string;
  managerId?: string | null;
  jobName?: string | null;
  department?: string | null;
};

type TreeNode = OrgNode & { children: TreeNode[] };

function buildTree(nodes: OrgNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const n of map.values()) {
    if (n.managerId && map.has(n.managerId)) {
      map.get(n.managerId)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

function TreeNodeCard({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className={level > 0 ? "mr-6 border-r-2 border-border pr-4" : ""}>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-secondary/50 ${
          level === 0 ? "bg-primary/5 border border-primary/20" : ""
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-4" />
        )}

        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          hasChildren ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {hasChildren ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{node.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[node.jobName, node.department].filter(Boolean).join(" — ") || "—"}
          </div>
        </div>

        {hasChildren && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {node.children.length}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeNodeCard key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChart() {
  const { t } = useTranslation();
  const { data: tree, isLoading } = useReportOrgTree();

  const roots = tree ? buildTree(tree as OrgNode[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("orgChart.title")}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("orgChart.treeTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : roots.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("orgChart.noEmployees")}
            </div>
          ) : (
            <div className="space-y-2">
              {roots.map((node) => (
                <TreeNodeCard key={node.id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
