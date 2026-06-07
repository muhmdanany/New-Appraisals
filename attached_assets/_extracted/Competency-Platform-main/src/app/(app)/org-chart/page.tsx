"use client";

import { Network } from "lucide-react";
import { api } from "@/trpc/react";
import { Card } from "@/components/ui/card";

type Flat = {
  id: string;
  name: string;
  managerId: string | null;
  job: { name: string } | null;
  department: { name: string } | null;
};
type OrgNode = Flat & { children: OrgNode[] };

function buildForest(rows: Flat[]): OrgNode[] {
  const byId = new Map<string, OrgNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: OrgNode[] = [];
  for (const node of byId.values()) {
    const parent = node.managerId ? byId.get(node.managerId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function Node({ node }: { node: OrgNode }) {
  return (
    <li className="relative">
      <div className="inline-block rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
        <div className="text-sm font-semibold text-foreground">{node.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {node.job?.name ?? "—"}
          {node.department?.name ? ` · ${node.department.name}` : ""}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2 border-r-2 border-border pr-5">
          {node.children.map((c) => (
            <Node key={c.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartPage() {
  const { data, isLoading } = api.report.orgTree.useQuery();
  const forest = data ? buildForest(data) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">الهيكل التنظيمي</h1>
        <p className="text-sm text-muted-foreground">شجرة التسلسل الإداري للموظفين</p>
      </div>

      <Card className="p-5">
        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground">جارٍ التحميل…</p>
        ) : !forest.length ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Network className="size-10 opacity-30" />
            <p className="text-sm">لا يوجد موظفون لعرض الهيكل.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {forest.map((root) => (
              <Node key={root.id} node={root} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
