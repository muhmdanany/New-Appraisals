import { memo, useCallback } from "react";
import { ChevronDown, ChevronRight, Briefcase, Users, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface MobileOrgNode {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  avatarUrl: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentColor: string | null;
  administrationId: number | null;
  administrationName: string | null;
  administrationColor: string | null;
  managerId: number | null;
  nationality: string | null;
  directReports: number;
  isActive: boolean;
  children: MobileOrgNode[];
}

interface MobileNodeProps {
  node: MobileOrgNode;
  depth: number;
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  onNodeClick: (node: MobileOrgNode) => void;
}

const MobileNode = memo(function MobileNode({
  node,
  depth,
  collapsed,
  onToggle,
  onNodeClick,
}: MobileNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isCollapsed = collapsed.has(node.id);
  const initials = `${node.firstName[0] ?? ""}${node.lastName[0] ?? ""}`;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id);
    },
    [onToggle, node.id]
  );

  const handleClick = useCallback(() => {
    onNodeClick(node);
  }, [onNodeClick, node]);

  return (
    <div className="w-full" style={{ paddingInlineStart: depth * 14 }}>
      <div
        className="relative flex items-stretch w-full bg-card border border-border rounded-xl overflow-hidden active:bg-muted/40 transition-colors"
        data-testid={`mobile-node-${node.id}`}
      >
        {node.departmentColor && (
          <div
            className="w-1 flex-shrink-0"
            style={{ backgroundColor: node.departmentColor }}
          />
        )}
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3 text-start min-h-[56px]"
          aria-label={`${node.firstName} ${node.lastName}`}
        >
          <Avatar className="h-11 w-11 flex-shrink-0">
            <AvatarImage src={node.avatarUrl || undefined} alt={`${node.firstName} ${node.lastName}`} />
            <AvatarFallback
              className="text-xs font-semibold"
              style={{
                backgroundColor: node.departmentColor ? `${node.departmentColor}20` : undefined,
                color: node.departmentColor || undefined,
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {node.firstName} {node.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Briefcase className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{node.title}</span>
            </p>
            {node.departmentName && (
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Building2
                  className="h-3 w-3 flex-shrink-0"
                  style={{ color: node.departmentColor || undefined }}
                />
                <span className="truncate">{node.departmentName}</span>
              </p>
            )}
          </div>
          {node.directReports > 0 && (
            <Badge variant="secondary" className="text-[10px] flex items-center gap-0.5 flex-shrink-0">
              <Users className="h-3 w-3" />
              {node.directReports}
            </Badge>
          )}
        </button>
        {hasChildren && (
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center justify-center w-12 min-h-[44px] border-s border-border text-muted-foreground active:bg-muted/60"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            data-testid={`mobile-toggle-${node.id}`}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <div className="mt-1.5 space-y-1.5">
          {node.children.map((child) => (
            <MobileNode
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface MobileOrgChartProps {
  roots: MobileOrgNode[];
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  onNodeClick: (node: MobileOrgNode) => void;
}

export function MobileOrgChart({
  roots,
  collapsed,
  onToggle,
  onNodeClick,
}: MobileOrgChartProps) {
  return (
    <div className="w-full p-3 space-y-2" data-testid="mobile-org-chart">
      {roots.map((root) => (
        <MobileNode
          key={root.id}
          node={root}
          depth={0}
          collapsed={collapsed}
          onToggle={onToggle}
          onNodeClick={onNodeClick}
        />
      ))}
    </div>
  );
}
