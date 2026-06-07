import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  CalendarOff,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Edit2,
  Eye,
  Globe,
  GripVertical,
  Landmark,
  Plus,
  Star,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { countryCodeToFlag, getCountryByCode } from "@/lib/countries";
import { resolvePhotoUrl } from "@/lib/photo-url";
import {
  buildConnectorPath,
  CONNECTOR_HEIGHT,
  countDescendants,
  daysSinceOpened,
  openPositionUrgency,
} from "@/lib/org-chart/utils";
import type {
  BranchHeadcount,
  ConnectorStyle,
  DragState,
  OrgChartNode,
  TFn,
} from "@/lib/org-chart/types";
import { SiblingGap } from "./sibling-gap";

const LARGE_TREE_CHILD_INITIAL_LIMIT = 120;
const LARGE_TREE_CHILD_STEP = 120;

export interface OrgNodeProps {
  node: OrgChartNode;
  parentId: number | null;
  siblingIndex: number;
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  dragState: DragState;
  onDragStart: (id: number, name: string, parentId: number | null, siblingIndex: number) => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, targetId: number) => void;
  onNodeClick: (node: OrgChartNode) => void;
  onFillPosition: (node: OrgChartNode) => void;
  onEdit: (node: OrgChartNode) => void;
  onAddOpenPosition: (node: OrgChartNode) => void;
  onMakeRoot: (id: number) => void;
  onRequestRemoveFromChart: (node: OrgChartNode) => void;
  onReorderOver: (parentId: number | null, index: number) => void;
  onReorderLeave: () => void;
  onReorderDrop: (parentId: number | null, index: number) => void;
  onSiblingKeyDown: (e: React.KeyboardEvent, id: number, parentId: number | null, siblingIndex: number) => void;
  t: TFn;
  animationsEnabled: boolean;
  connectorStyle: ConnectorStyle;
  nodeRefs?: { current: Map<number, HTMLDivElement> };
  headcountMap: Map<number, BranchHeadcount>;
  onShowBranchSummary: (id: number) => void;
  highlightedId?: number | null;
  missingSuccessorIds?: Set<number> | null;
  presentationMode?: boolean;
  largeTreeMode?: boolean;
}

export const OrgNode = memo(
  function OrgNode({
    node,
    parentId,
    siblingIndex,
    collapsed,
    onToggle,
    dragState,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDragEnd,
    onDrop,
    onNodeClick,
    onFillPosition,
    onEdit,
    onAddOpenPosition,
    onMakeRoot,
    onRequestRemoveFromChart,
    onReorderOver,
    onReorderLeave,
    onReorderDrop,
    onSiblingKeyDown,
    t,
    animationsEnabled,
    connectorStyle,
    nodeRefs,
    headcountMap,
    onShowBranchSummary,
    highlightedId,
    missingSuccessorIds,
    presentationMode,
    largeTreeMode,
  }: OrgNodeProps) {
    const isCollapsed = collapsed.has(node.id);
    const isHighlighted = highlightedId === node.id;
    const isMissingSuccessor = !!missingSuccessorIds?.has(node.id);
    const isCriticalRole = !!node.isCriticalRole;
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isOpenPos = !!node.isOpenPosition;
    const initials = isOpenPos ? "?" : `${node.firstName[0] || "?"}${node.lastName[0] || ""}`;
    const openDays = isOpenPos ? daysSinceOpened(node.openSinceDate) : 0;
    const urgency = isOpenPos ? openPositionUrgency(openDays) : "fresh";
    const isDragging = dragState.draggedId === node.id;
    const isDropTarget = dragState.dropTargetId === node.id && dragState.draggedId !== node.id;
    const [isPulsing, setIsPulsing] = useState(false);
    const childrenRowRef = useRef<HTMLDivElement | null>(null);
    const childRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [layout, setLayout] = useState<{ width: number; positions: number[] }>({ width: 0, positions: [] });
    const [childrenVisibleLimit, setChildrenVisibleLimit] = useState(LARGE_TREE_CHILD_INITIAL_LIMIT);

    const childCount = node.children?.length ?? 0;
    const visibleChildren =
      largeTreeMode && !presentationMode
        ? (node.children ?? []).slice(0, childrenVisibleLimit)
        : (node.children ?? []);
    const renderedChildCount = visibleChildren.length;
    const remainingChildrenCount = Math.max(0, childCount - renderedChildCount);
    const nextChildrenBatchCount = Math.min(LARGE_TREE_CHILD_STEP, remainingChildrenCount);
    const canAcceptReorderForChildren =
      dragState.draggedId !== null && dragState.draggedParentId === node.id;

    useEffect(() => {
      setChildrenVisibleLimit(LARGE_TREE_CHILD_INITIAL_LIMIT);
    }, [node.id, largeTreeMode, isCollapsed]);

    useLayoutEffect(() => {
      if (!hasChildren || isCollapsed) return;
      const compute = () => {
        const row = childrenRowRef.current;
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const positions = childRefs.current
          .slice(0, renderedChildCount)
          .map((el) => {
            if (!el) return 0;
            const r = el.getBoundingClientRect();
            return r.left - rowRect.left + r.width / 2;
          });
        setLayout((prev) => {
          if (
            prev.width === rowRect.width &&
            prev.positions.length === positions.length &&
            prev.positions.every((p, i) => p === positions[i])
          ) {
            return prev;
          }
          return { width: rowRect.width, positions };
        });
      };
      compute();
      const ro = new ResizeObserver(compute);
      if (childrenRowRef.current) ro.observe(childrenRowRef.current);
      childRefs.current.slice(0, renderedChildCount).forEach((el) => el && ro.observe(el));
      return () => ro.disconnect();
    }, [hasChildren, isCollapsed, renderedChildCount]);

    const handleToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPulsing(true);
        onToggle(node.id);
      },
      [onToggle, node.id]
    );

    return (
      <div className="flex flex-col items-center">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={`relative bg-card border-2 rounded-xl shadow-sm p-4 w-60 transition-all select-none ${
                presentationMode ? "shadow-lg" : ""
              } ${
                isHighlighted ? "ring-4 ring-primary ring-offset-2 ring-offset-background border-primary" : ""
              } ${
                isMissingSuccessor && !isHighlighted ? "ring-2 ring-amber-500 ring-offset-1 ring-offset-background" : ""
              } ${
                isOpenPos ? "border-dashed bg-muted/30" : ""
              } ${
                isDragging ? "opacity-40 scale-95 border-primary/50" : ""
              } ${
                isDropTarget
                  ? "border-primary shadow-lg shadow-primary/20 scale-105 ring-2 ring-primary/30"
                  : isOpenPos
                    ? urgency === "critical"
                      ? "border-destructive/60 hover:shadow-md"
                      : urgency === "warning"
                        ? "border-amber-500/60 hover:shadow-md"
                        : "border-muted-foreground/40 hover:shadow-md"
                    : "border-border hover:shadow-md"
              }`}
              data-open-position={isOpenPos ? "true" : undefined}
              draggable
              tabIndex={0}
              onKeyDown={(e) => onSiblingKeyDown(e, node.id, parentId, siblingIndex)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(node.id));
                e.dataTransfer.setData("application/x-org-chart", "1");
                onDragStart(node.id, `${node.firstName} ${node.lastName}`, parentId, siblingIndex);
              }}
              onDragOver={(e) => onDragOver(e, node.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  onDragLeave();
                }
              }}
              onDrop={(e) => onDrop(e, node.id)}
              onDragEnd={onDragEnd}
              data-testid={`card-employee-${node.id}`}
              ref={(el) => {
                if (!nodeRefs) return;
                if (el) nodeRefs.current.set(node.id, el);
                else nodeRefs.current.delete(node.id);
              }}
            >
          {node.departmentColor && (
            <div
              className="absolute top-0 start-0 bottom-0 w-1 rounded-s-xl"
              style={{ backgroundColor: node.departmentColor }}
            />
          )}
          {node.isOnLeave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="absolute top-2 end-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 z-10"
                  data-testid={`badge-on-leave-${node.id}`}
                  aria-label={t("leave.onLeaveAria", {
                    name: `${node.firstName} ${node.lastName}`,
                  })}
                >
                  <CalendarOff className="h-3 w-3" />
                  {t("leave.onLeave")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-center">
                <p className="font-medium">{t("leave.onLeave")}</p>
                {node.leaveType && (
                  <p className="text-xs opacity-90">{t(`leave.types.${node.leaveType}`)}</p>
                )}
                {node.leaveFrom && node.leaveTo && (
                  <p className="text-xs opacity-90">
                    {t("leave.dateRange", { from: node.leaveFrom, to: node.leaveTo })}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          <div className={`flex items-center gap-3 ${node.departmentColor ? "ms-2" : ""}`}>
            <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <GripVertical className="h-4 w-4" />
            </div>
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={resolvePhotoUrl(node.avatarUrl)} alt={`${node.firstName} ${node.lastName}`} />
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
            <button
              type="button"
              className="flex-1 min-w-0 cursor-pointer text-start"
              aria-label={isOpenPos ? `${t("orgChart.openPositions.openPosition")}: ${node.title}` : `${node.firstName} ${node.lastName}`}
              onClick={(e) => {
                e.stopPropagation();
                onNodeClick(node);
              }}
            >
              <p className={`text-sm font-semibold truncate transition-colors ${isOpenPos ? "text-muted-foreground italic hover:text-primary" : "text-foreground hover:text-primary"}`}>
                {isOpenPos ? t("orgChart.openPositions.openPosition") : `${node.firstName} ${node.lastName}`}
              </p>
            </button>
            {(() => {
              const hc = headcountMap.get(node.id);
              if (!hc || hc.total === 0) {
                if (node.directReports > 0) {
                  return (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {node.directReports}
                    </span>
                  );
                }
                return null;
              }
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowBranchSummary(node.id);
                      }}
                      className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t("orgChart.headcountBadgeAria", { total: hc.total, open: hc.open })}
                      data-testid={`badge-headcount-${node.id}`}
                    >
                      <Users className="h-3 w-3" />
                      <span>{hc.total}</span>
                      {hc.open > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {t("orgChart.openBadgeShort", { count: hc.open })}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-center">
                    <p className="font-medium">{t("orgChart.headcountTooltipTotal", { count: hc.total })}</p>
                    {hc.open > 0 && (
                      <p className="text-xs opacity-90">{t("orgChart.headcountTooltipOpen", { count: hc.open })}</p>
                    )}
                    <p className="text-[10px] opacity-75 mt-1">{t("orgChart.headcountTooltipClickHint")}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })()}
          </div>

          <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <Briefcase className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{node.title}</span>
            </div>
            {node.nationality && (() => {
              const country = getCountryByCode(node.nationality);
              return (
                <div className="flex items-center gap-1.5 truncate">
                  <Globe className="h-3 w-3 flex-shrink-0" />
                  <span>{countryCodeToFlag(node.nationality)}</span>
                  <span className="truncate">{country?.name || node.nationality}</span>
                </div>
              );
            })()}
            {node.administrationName && (
              <div className="flex items-center gap-1.5 truncate">
                <Landmark className="h-3 w-3 flex-shrink-0" style={{ color: node.administrationColor || undefined }} />
                <span className="truncate">{node.administrationName}</span>
              </div>
            )}
            {node.departmentName && (
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="h-3 w-3 flex-shrink-0" style={{ color: node.departmentColor || undefined }} />
                <span className="truncate">{node.departmentName}</span>
              </div>
            )}
            {isOpenPos && (
              <div className="pt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    urgency === "critical"
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : urgency === "warning"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        : "bg-muted text-muted-foreground border-border"
                  }`}
                  data-testid={`badge-open-for-days-${node.id}`}
                >
                  {t("orgChart.openPositions.openForDays", { count: openDays })}
                </span>
              </div>
            )}
            {(isCriticalRole || isMissingSuccessor) && !isOpenPos && (
              <div className="pt-1 flex flex-wrap gap-1">
                {isCriticalRole && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    data-testid={`badge-critical-role-${node.id}`}
                    title={t("succession.criticalRole")}
                  >
                    <Star className="h-2.5 w-2.5" />
                    {t("succession.criticalRole")}
                  </span>
                )}
                {isMissingSuccessor && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    data-testid={`badge-missing-successor-${node.id}`}
                  >
                    <UserX className="h-2.5 w-2.5" />
                    {t("succession.noSuccessor")}
                  </span>
                )}
              </div>
            )}
            {node.tags && node.tags.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-1" data-testid={`tags-row-${node.id}`}>
                {node.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border max-w-[80px] truncate"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      borderColor: `${tag.color}40`,
                    }}
                    title={tag.name}
                    data-testid={`tag-badge-${node.id}-${tag.id}`}
                  >
                    {tag.name}
                  </span>
                ))}
                {node.tags.length > 3 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-muted text-muted-foreground border border-border"
                        data-testid={`tags-overflow-${node.id}`}
                      >
                        +{node.tags.length - 3}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {node.tags.slice(3).map((t) => t.name).join(", ")}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {isDropTarget && (
            <div className="absolute inset-0 rounded-xl bg-primary/5 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                {t("orgChart.assignAsManager")}
              </span>
            </div>
          )}

          {hasChildren && (
            <button
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-card border border-border rounded-full px-1 py-0.5 shadow-sm z-10 hover:bg-muted transition-colors"
              aria-label={isCollapsed ? t("orgChart.expandReports") : t("orgChart.collapseReports")}
              onClick={handleToggle}
            >
              {isCollapsed ? (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  {(() => {
                    const childNames = node.children
                      .map((c) => `${c.firstName} ${c.lastName}`.trim())
                      .join(", ");
                    const reportsLabel = `${t("orgChart.directReports", { count: node.children.length })}: ${childNames}`;
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={reportsLabel}
                            className="text-[10px] font-semibold text-primary leading-none pr-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsPulsing(true);
                                onToggle(node.id);
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle(e);
                            }}
                          >
                            +{countDescendants(node)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px] text-center">
                          <p className="font-medium mb-0.5">{t("orgChart.directReports", { count: node.children.length })}</p>
                          <p className="text-xs opacity-90">{childNames}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                </>
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}

          <AnimatePresence>
            {isPulsing && (
              <motion.div
                key="pulse"
                className="absolute inset-0 rounded-xl pointer-events-none"
                initial={{ opacity: 0.5, scale: 1 }}
                animate={{ opacity: 0, scale: 1.06 }}
                exit={{ opacity: 0 }}
                transition={{ duration: animationsEnabled ? 0.35 : 0, ease: "easeOut" }}
                style={{ background: "hsl(var(--primary) / 0.12)", border: "1.5px solid hsl(var(--primary) / 0.35)" }}
                onAnimationComplete={() => setIsPulsing(false)}
              />
            )}
          </AnimatePresence>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            <ContextMenuItem onSelect={() => onNodeClick(node)} data-testid={`context-view-employee-${node.id}`}>
              <Eye className="h-4 w-4 me-2" />
              {t("orgChart.detailsTab", { defaultValue: "Details" })}
            </ContextMenuItem>
            {isOpenPos ? (
              <ContextMenuItem onSelect={() => onFillPosition(node)} data-testid={`context-fill-position-${node.id}`}>
                <Users className="h-4 w-4 me-2" />
                {t("orgChart.openPositions.fillPosition")}
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onSelect={() => onEdit(node)} data-testid={`context-edit-employee-${node.id}`}>
                <Edit2 className="h-4 w-4 me-2" />
                {t("orgChart.editBtn")}
              </ContextMenuItem>
            )}
            {!isOpenPos && (
              <ContextMenuItem onSelect={() => onAddOpenPosition(node)} data-testid={`context-add-open-position-${node.id}`}>
                <Plus className="h-4 w-4 me-2" />
                {t("orgChart.openPositions.addOpenPosition")}
              </ContextMenuItem>
            )}
            {node.managerId && (
              <ContextMenuItem onSelect={() => onMakeRoot(node.id)} data-testid={`context-remove-manager-${node.id}`}>
                <ArrowRightLeft className="h-4 w-4 me-2" />
                {t("orgChart.removeManager")}
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onRequestRemoveFromChart(node)}
              data-testid={`context-remove-from-chart-${node.id}`}
            >
              <Trash2 className="h-4 w-4 me-2" />
              {t("orgChart.deleteBtn")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <AnimatePresence>
          {hasChildren && !isCollapsed && (
            <motion.div
              key="children"
              className="flex flex-col items-center"
              initial={{ opacity: 0, scaleY: 0.85, transformOrigin: "top" }}
              animate={{ opacity: 1, scaleY: 1, transformOrigin: "top" }}
              exit={{ opacity: 0, scaleY: 0.85, transformOrigin: "top" }}
              transition={{ duration: animationsEnabled ? 0.25 : 0, ease: "easeOut" }}
            >
              <div
                className="relative pointer-events-none"
                style={{ width: layout.width || 1, height: CONNECTOR_HEIGHT }}
                aria-hidden="true"
              >
                {layout.width > 0 && (
                  <svg
                    width={layout.width}
                    height={CONNECTOR_HEIGHT}
                    className="overflow-visible block"
                    style={{ color: "hsl(var(--border))" }}
                  >
                    {layout.positions.map((x, i) => (
                      <motion.path
                        key={`${connectorStyle}-${i}-${x}`}
                        d={buildConnectorPath(connectorStyle, layout.width / 2, x, CONNECTOR_HEIGHT)}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: animationsEnabled ? 0.2 : 0,
                          ease: "easeOut",
                          delay: animationsEnabled ? Math.min(i * 0.04, 0.12) : 0,
                        }}
                      />
                    ))}
                  </svg>
                )}
              </div>
              <div ref={childrenRowRef} className="flex items-stretch">
                {visibleChildren.map((child, i) => (
                  <Fragment key={child.id}>
                    <SiblingGap
                      parentId={node.id}
                      index={i}
                      active={
                        canAcceptReorderForChildren &&
                        dragState.reorderTarget?.parentId === node.id &&
                        dragState.reorderTarget?.index === i
                      }
                      canAccept={canAcceptReorderForChildren}
                      onDragOver={onReorderOver}
                      onDragLeave={onReorderLeave}
                      onDrop={onReorderDrop}
                    />
                    <motion.div
                      ref={(el) => {
                        childRefs.current[i] = el;
                      }}
                      className="flex flex-col items-center"
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: animationsEnabled ? 0.22 : 0, ease: "easeOut", delay: animationsEnabled ? Math.min(i * 0.04, 0.12) : 0 }}
                    >
                      <OrgNode
                        node={child}
                        parentId={node.id}
                        siblingIndex={i}
                        collapsed={collapsed}
                        onToggle={onToggle}
                        dragState={dragState}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDragEnd={onDragEnd}
                        onDrop={onDrop}
                        onNodeClick={onNodeClick}
                        onFillPosition={onFillPosition}
                        onEdit={onEdit}
                        onAddOpenPosition={onAddOpenPosition}
                        onMakeRoot={onMakeRoot}
                        onRequestRemoveFromChart={onRequestRemoveFromChart}
                        onReorderOver={onReorderOver}
                        onReorderLeave={onReorderLeave}
                        onReorderDrop={onReorderDrop}
                        onSiblingKeyDown={onSiblingKeyDown}
                        t={t}
                        animationsEnabled={animationsEnabled}
                        connectorStyle={connectorStyle}
                        nodeRefs={nodeRefs}
                        headcountMap={headcountMap}
                        onShowBranchSummary={onShowBranchSummary}
                        highlightedId={highlightedId}
                        missingSuccessorIds={missingSuccessorIds}
                        presentationMode={presentationMode}
                        largeTreeMode={largeTreeMode}
                      />
                    </motion.div>
                  </Fragment>
                ))}
                {remainingChildrenCount > 0 && (
                  <div className="flex min-w-44 items-center justify-center px-2">
                    <button
                      type="button"
                      className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChildrenVisibleLimit((limit) => limit + LARGE_TREE_CHILD_STEP);
                      }}
                      data-testid={`button-load-more-children-${node.id}`}
                    >
                      {t("orgChart.loadMoreChildren", { count: nextChildrenBatchCount })}
                    </button>
                  </div>
                )}
                <SiblingGap
                  parentId={node.id}
                  index={visibleChildren.length}
                  active={
                    canAcceptReorderForChildren &&
                    dragState.reorderTarget?.parentId === node.id &&
                    dragState.reorderTarget?.index === visibleChildren.length
                  }
                  canAccept={canAcceptReorderForChildren}
                  onDragOver={onReorderOver}
                  onDragLeave={onReorderLeave}
                  onDrop={onReorderDrop}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
  (prev, next) => {
    if (prev.node !== next.node) return false;
    if (prev.animationsEnabled !== next.animationsEnabled) return false;
    if (prev.connectorStyle !== next.connectorStyle) return false;
    if (prev.collapsed !== next.collapsed) return false;
    if (prev.dragState.dropTargetId !== next.dragState.dropTargetId) return false;
    if (prev.dragState.draggedId !== next.dragState.draggedId) return false;
    if (prev.headcountMap !== next.headcountMap) return false;
    if (prev.onShowBranchSummary !== next.onShowBranchSummary) return false;
    if (prev.dragState.draggedParentId !== next.dragState.draggedParentId) return false;
    if (prev.dragState.reorderTarget?.parentId !== next.dragState.reorderTarget?.parentId) return false;
    if (prev.dragState.reorderTarget?.index !== next.dragState.reorderTarget?.index) return false;
    if (prev.parentId !== next.parentId) return false;
    if (prev.siblingIndex !== next.siblingIndex) return false;
    if (prev.highlightedId !== next.highlightedId) return false;
    if (prev.missingSuccessorIds !== next.missingSuccessorIds) return false;
    if (prev.presentationMode !== next.presentationMode) return false;
    if (prev.largeTreeMode !== next.largeTreeMode) return false;
    return true;
  }
);
