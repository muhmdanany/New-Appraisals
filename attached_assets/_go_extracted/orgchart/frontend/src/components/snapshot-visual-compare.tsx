import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Link2, Link2Off, Download, Loader2, Filter, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChartTreeNode } from "@/components/chart-tree-layout";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface VisualEmployee {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  avatarUrl: string | null;
  managerId: number | null;
  departmentId: number | null;
  departmentName: string;
  departmentColor: string;
  isActive: boolean;
}

interface ChangedEntry {
  id: number;
  fields: string[];
}

export interface VisualCompareData {
  baseLabel: string;
  compareLabel: string;
  base: { employees: VisualEmployee[] };
  compare: { employees: VisualEmployee[] };
  diff: {
    addedIds: number[];
    removedIds: number[];
    changed: ChangedEntry[];
  };
}

type Status = "added" | "removed" | "changed" | "same";

interface DiffNode extends VisualEmployee {
  children: DiffNode[];
  status: Status;
  changedFields: string[];
}

interface SnapshotLite {
  id: number;
  name: string;
}

function buildTree(
  employees: VisualEmployee[],
  statusOf: (id: number) => Status,
  changedFieldsOf: (id: number) => string[],
): DiffNode[] {
  const byId = new Map<number, DiffNode>();
  employees.forEach((e) =>
    byId.set(e.id, {
      ...e,
      children: [],
      status: statusOf(e.id),
      changedFields: changedFieldsOf(e.id),
    }),
  );
  const roots: DiffNode[] = [];
  byId.forEach((node) => {
    if (node.managerId != null && byId.has(node.managerId)) {
      byId.get(node.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  // Stable sort by name within each level for predictable layout.
  const sortRec = (arr: DiffNode[]) => {
    arr.sort((a, b) => {
      const na = `${a.firstName} ${a.lastName}`.trim();
      const nb = `${b.firstName} ${b.lastName}`.trim();
      return na.localeCompare(nb);
    });
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function filterChangedChains(roots: DiffNode[]): DiffNode[] {
  const filter = (node: DiffNode): DiffNode | null => {
    const filteredChildren = node.children
      .map(filter)
      .filter((c): c is DiffNode => c !== null);
    if (node.status !== "same" || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };
  return roots.map(filter).filter((n): n is DiffNode => n !== null);
}

function statusBorderClass(status: Status): string {
  switch (status) {
    case "added":
      return "border-green-500 ring-1 ring-green-200";
    case "removed":
      return "border-red-500 ring-1 ring-red-200";
    case "changed":
      return "border-amber-500 ring-1 ring-amber-200";
    default:
      return "border-border";
  }
}

function DiffCard({
  node,
  side,
  registerRef,
  fieldLabel,
}: {
  node: DiffNode;
  side: "base" | "compare";
  registerRef: (id: number, el: HTMLDivElement | null) => void;
  fieldLabel: (f: string) => string;
}) {
  const { t } = useTranslation();
  const strike = side === "base" && node.status === "removed";
  const tooltipText =
    node.status === "changed"
      ? t("snapshots.visual.changedTooltip", {
          fields: node.changedFields.map(fieldLabel).join(", "),
        })
      : node.status === "added"
        ? t("snapshots.visual.addedTooltip")
        : node.status === "removed"
          ? t("snapshots.visual.removedTooltip")
          : "";

  const card = (
    <div
      ref={(el) => registerRef(node.id, el)}
      data-testid={`visual-card-${side}-${node.id}`}
      data-status={node.status}
      className={`relative rounded-md border-2 bg-card px-2.5 py-1.5 text-[11px] leading-tight shadow-sm w-[160px] flex-shrink-0 overflow-hidden ${statusBorderClass(node.status)}`}
      style={
        node.departmentColor
          ? {
              borderInlineStartWidth: 4,
              borderInlineStartColor: node.departmentColor,
            }
          : undefined
      }
    >
      <div
        className={`font-medium truncate text-foreground ${strike ? "line-through" : ""}`}
      >
        {node.firstName} {node.lastName}
      </div>
      <div
        className={`text-[10px] text-muted-foreground truncate ${strike ? "line-through" : ""}`}
      >
        {node.title || "—"}
      </div>
      {node.departmentName && (
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: node.departmentColor || "#888" }}
          />
          <span className="text-[10px] text-muted-foreground truncate">
            {node.departmentName}
          </span>
        </div>
      )}
    </div>
  );

  if (!tooltipText) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

function ChartPane({
  roots,
  side,
  zoom,
  scrollRef,
  onScroll,
  registerRef,
  fieldLabel,
  emptyText,
}: {
  roots: DiffNode[];
  side: "base" | "compare";
  zoom: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (side: "base" | "compare") => void;
  registerRef: (id: number, el: HTMLDivElement | null) => void;
  fieldLabel: (f: string) => string;
  emptyText: string;
}) {
  return (
    <div
      ref={scrollRef}
      onScroll={() => onScroll(side)}
      className="flex-1 overflow-auto bg-muted/20"
      data-testid={`visual-pane-${side}`}
    >
      <div
        className="inline-block min-w-full p-6"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        {roots.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            {emptyText}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            {roots.map((root) => (
              <ChartTreeNode
                key={root.id}
                node={root}
                getChildren={(n: DiffNode) => n.children}
                getKey={(n: DiffNode) => n.id}
                connectorStyle="angled"
                animationsEnabled={false}
                connectorHeight={36}
                childGap={16}
                renderCard={(n: DiffNode) => (
                  <DiffCard
                    node={n}
                    side={side}
                    registerRef={registerRef}
                    fieldLabel={fieldLabel}
                  />
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SnapshotVisualCompare({
  orgId,
  baseSnapshot,
  initialCompareWith,
  otherSnapshots,
  onBack,
}: {
  orgId: number;
  baseSnapshot: SnapshotLite;
  initialCompareWith: string;
  otherSnapshots: SnapshotLite[];
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [compareWith, setCompareWith] = useState(initialCompareWith);
  const [data, setData] = useState<VisualCompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [changesOnly, setChangesOnly] = useState(false);
  const [jumpIndex, setJumpIndex] = useState(-1);

  const baseScrollRef = useRef<HTMLDivElement | null>(null);
  const compareScrollRef = useRef<HTMLDivElement | null>(null);
  const isMirroringRef = useRef(false);
  const baseCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const compareCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tick, forceTick] = useState(0);
  const [isExporting, setIsExporting] = useState<null | "png" | "pdf">(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fieldLabel = useCallback(
    (f: string) => t(`snapshots.field.${f}`, { defaultValue: f }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setJumpIndex(-1);
    baseCardRefs.current.clear();
    compareCardRefs.current.clear();
    (async () => {
      try {
        const url = new URL(
          `${API_BASE}/organizations/${orgId}/snapshots/${baseSnapshot.id}/compare/visual`,
          window.location.origin,
        );
        if (compareWith !== "current") url.searchParams.set("compareId", compareWith);
        const r = await fetch(url.toString(), { credentials: "include" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as VisualCompareData;
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, baseSnapshot.id, compareWith]);

  const { baseRoots, compareRoots, addedCount, removedCount, changedCount, jumpIds } = useMemo(() => {
    if (!data)
      return {
        baseRoots: [] as DiffNode[],
        compareRoots: [] as DiffNode[],
        addedCount: 0,
        removedCount: 0,
        changedCount: 0,
        jumpIds: [] as number[],
      };
    const addedSet = new Set(data.diff.addedIds);
    const removedSet = new Set(data.diff.removedIds);
    const changedMap = new Map(data.diff.changed.map((c) => [c.id, c.fields]));
    const statusOf = (id: number): Status => {
      if (addedSet.has(id)) return "added";
      if (removedSet.has(id)) return "removed";
      if (changedMap.has(id)) return "changed";
      return "same";
    };
    const fieldsOf = (id: number) => changedMap.get(id) ?? [];
    const baseRootsFull = buildTree(data.base.employees, statusOf, fieldsOf);
    const compareRootsFull = buildTree(data.compare.employees, statusOf, fieldsOf);
    const baseRoots = changesOnly ? filterChangedChains(baseRootsFull) : baseRootsFull;
    const compareRoots = changesOnly ? filterChangedChains(compareRootsFull) : compareRootsFull;
    const ordered: number[] = [];
    const seen = new Set<number>();
    const collect = (nodes: DiffNode[]) => {
      for (const n of nodes) {
        if (n.status !== "same" && !seen.has(n.id)) {
          ordered.push(n.id);
          seen.add(n.id);
        }
        collect(n.children);
      }
    };
    collect(baseRoots);
    collect(compareRoots);
    return {
      baseRoots,
      compareRoots,
      addedCount: data.diff.addedIds.length,
      removedCount: data.diff.removedIds.length,
      changedCount: data.diff.changed.length,
      jumpIds: ordered,
    };
  }, [data, changesOnly]);

  const registerBaseRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) baseCardRefs.current.set(id, el);
    else baseCardRefs.current.delete(id);
  }, []);

  const registerCompareRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) compareCardRefs.current.set(id, el);
    else compareCardRefs.current.delete(id);
  }, []);

  const handleScroll = useCallback(
    (side: "base" | "compare") => {
      if (!syncEnabled) {
        forceTick((n) => n + 1);
        return;
      }
      if (isMirroringRef.current) return;
      const src = side === "base" ? baseScrollRef.current : compareScrollRef.current;
      const dst = side === "base" ? compareScrollRef.current : baseScrollRef.current;
      if (!src || !dst) return;
      isMirroringRef.current = true;
      const srcMaxY = Math.max(1, src.scrollHeight - src.clientHeight);
      const srcMaxX = Math.max(1, src.scrollWidth - src.clientWidth);
      const dstMaxY = Math.max(0, dst.scrollHeight - dst.clientHeight);
      const dstMaxX = Math.max(0, dst.scrollWidth - dst.clientWidth);
      // Ratio-based mirror so panes with different content sizes stay in step.
      dst.scrollTop = (src.scrollTop / srcMaxY) * dstMaxY;
      dst.scrollLeft = (src.scrollLeft / srcMaxX) * dstMaxX;
      requestAnimationFrame(() => {
        isMirroringRef.current = false;
        forceTick((n) => n + 1);
      });
    },
    [syncEnabled],
  );

  // Recompute connector overlay on scroll/zoom/data changes.
  useLayoutEffect(() => {
    forceTick((n) => n + 1);
  }, [zoom, data, syncEnabled, changesOnly]);

  useEffect(() => {
    const ro = new ResizeObserver(() => forceTick((n) => n + 1));
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const jumpTo = useCallback(
    (delta: number) => {
      if (jumpIds.length === 0) return;
      // First click on Next from the unfocused state (-1) lands on index 0;
      // first click on Previous lands on the last diff. Subsequent clicks wrap.
      const start = jumpIndex < 0 ? (delta > 0 ? -1 : 0) : jumpIndex;
      const next = (start + delta + jumpIds.length) % jumpIds.length;
      setJumpIndex(next);
      const id = jumpIds[next];
      const baseEl = baseCardRefs.current.get(id);
      const compareEl = compareCardRefs.current.get(id);
      const opts: ScrollIntoViewOptions = {
        behavior: "smooth",
        block: "center",
        inline: "center",
      };
      // Temporarily disable mirroring so both scroll independently to the target.
      const prevMirror = isMirroringRef.current;
      isMirroringRef.current = true;
      if (baseEl) baseEl.scrollIntoView(opts);
      if (compareEl) compareEl.scrollIntoView(opts);
      window.setTimeout(() => {
        isMirroringRef.current = prevMirror;
        forceTick((n) => n + 1);
      }, 400);
    },
    [jumpIds, jumpIndex],
  );

  const handleExport = useCallback(
    async (format: "png" | "pdf") => {
      if (!data || isExporting) return;
      setIsExporting(format);
      setExportError(null);
      const docDir =
        document.documentElement.getAttribute("dir") === "rtl" ? "rtl" : "ltr";
      let host: HTMLDivElement | null = null;
      try {
        const baseInner = baseScrollRef.current?.firstElementChild as
          | HTMLElement
          | null;
        const compareInner = compareScrollRef.current?.firstElementChild as
          | HTMLElement
          | null;
        if (!baseInner || !compareInner) {
          throw new Error("missing-panes");
        }

        host = document.createElement("div");
        host.setAttribute("dir", docDir);
        host.style.cssText = [
          "position:fixed",
          "left:-100000px",
          "top:0",
          "background:#ffffff",
          "padding:24px",
          "color:#0f172a",
          "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif",
          "box-sizing:border-box",
        ].join(";");

        const escapeHtml = (s: string) =>
          s.replace(/[&<>"']/g, (c) =>
            c === "&"
              ? "&amp;"
              : c === "<"
                ? "&lt;"
                : c === ">"
                  ? "&gt;"
                  : c === '"'
                    ? "&quot;"
                    : "&#39;",
          );

        const header = document.createElement("div");
        header.style.cssText = "margin-bottom:14px";
        header.innerHTML =
          `<div style="font-size:18px;font-weight:600;line-height:1.2">${escapeHtml(t("snapshots.visual.title"))}</div>` +
          `<div style="font-size:13px;color:#475569;margin-top:4px;direction:ltr;text-align:${docDir === "rtl" ? "right" : "left"}">${escapeHtml(data.baseLabel)} ↔ ${escapeHtml(data.compareLabel)}</div>` +
          `<div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(new Date().toLocaleString())}</div>`;
        host.appendChild(header);

        const summary = document.createElement("div");
        summary.style.cssText =
          "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:12px;font-weight:500";
        const chip = (bg: string, fg: string, border: string, text: string) =>
          `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${bg};color:${fg};border:1px solid ${border}">${escapeHtml(text)}</span>`;
        summary.innerHTML =
          chip(
            "#f0fdf4",
            "#15803d",
            "#86efac",
            `+${addedCount} ${t("snapshots.added")}`,
          ) +
          chip(
            "#fef2f2",
            "#b91c1c",
            "#fca5a5",
            `−${removedCount} ${t("snapshots.removed")}`,
          ) +
          chip(
            "#fffbeb",
            "#92400e",
            "#fcd34d",
            `~${changedCount} ${t("snapshots.changed")}`,
          );
        host.appendChild(summary);

        const panes = document.createElement("div");
        panes.setAttribute("dir", "ltr");
        panes.style.cssText =
          "display:flex;align-items:flex-start;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff";

        const wrapInner = (src: HTMLElement) => {
          const cell = document.createElement("div");
          cell.style.cssText =
            "flex:1 1 0;min-width:0;background:#fafafa;padding:8px;overflow:hidden";
          const clone = src.cloneNode(true) as HTMLElement;
          // Reset zoom transform so the clone renders at natural size.
          clone.style.transform = "none";
          clone.style.transformOrigin = "top left";
          clone.style.display = "inline-block";
          cell.appendChild(clone);
          return cell;
        };

        panes.appendChild(wrapInner(baseInner));
        const divider = document.createElement("div");
        divider.style.cssText = "width:1px;background:#e2e8f0;align-self:stretch";
        panes.appendChild(divider);
        panes.appendChild(wrapInner(compareInner));
        host.appendChild(panes);

        const legend = document.createElement("div");
        legend.style.cssText =
          "display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:11px;color:#475569";
        const swatch = (color: string, text: string) =>
          `<span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;border:2px solid ${color}"></span>${escapeHtml(text)}</span>`;
        legend.innerHTML =
          swatch("#22c55e", t("snapshots.visual.legendAdded")) +
          swatch("#ef4444", t("snapshots.visual.legendRemoved")) +
          swatch("#f59e0b", t("snapshots.visual.legendChanged"));
        host.appendChild(legend);

        document.body.appendChild(host);
        // Let layout settle so the cloned subtree resolves its measured width.
        await new Promise((r) => requestAnimationFrame(() => r(null)));

        const { toPng } = await import("html-to-image");
        const renderWidth = Math.max(host.scrollWidth, host.offsetWidth);
        const renderHeight = Math.max(host.scrollHeight, host.offsetHeight);
        const dataUrl = await toPng(host, {
          pixelRatio: 2,
          cacheBust: false,
          backgroundColor: "#ffffff",
          width: renderWidth,
          height: renderHeight,
          skipFonts: false,
        });

        const safe = (s: string) =>
          s
            .replace(/[\\/:*?"<>|]+/g, "_")
            .replace(/\s+/g, "_")
            .slice(0, 80) || "snapshot";
        const baseFile = `visual-diff_${safe(data.baseLabel)}_vs_${safe(data.compareLabel)}`;

        if (format === "png") {
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `${baseFile}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          const { jsPDF } = await import("jspdf");
          // Use pixel units sized to the rendered pixel dimensions so the
          // image embeds at native resolution without re-scaling artefacts.
          const pxW = renderWidth * 2;
          const pxH = renderHeight * 2;
          const orientation = pxW >= pxH ? "landscape" : "portrait";
          const pdf = new jsPDF({
            orientation,
            unit: "px",
            format: [pxW, pxH],
            hotfixes: ["px_scaling"],
          });
          pdf.addImage(dataUrl, "PNG", 0, 0, pxW, pxH, undefined, "FAST");
          pdf.save(`${baseFile}.pdf`);
        }
      } catch (e) {
        setExportError(
          (e as Error).message || t("snapshots.visual.exportFailed"),
        );
      } finally {
        if (host && host.parentNode) host.parentNode.removeChild(host);
        setIsExporting(null);
      }
    },
    [data, isExporting, addedCount, removedCount, changedCount, t],
  );

  // Compute connector lines between same-id changed cards across the two panes.
  // Intentionally not memoized: must recompute every render so scroll/resize
  // (which bumps `tick`) reflows the dotted overlay accurately.
  void tick;
  const connectorLines: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = (() => {
    if (!overlayRef.current || jumpIds.length === 0) return [];
    const overlayRect = overlayRef.current.getBoundingClientRect();
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = [];
    for (const id of jumpIds) {
      const a = baseCardRefs.current.get(id);
      const b = compareCardRefs.current.get(id);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      // Only draw if both cards are at least partially visible within overlay.
      const aVisible =
        ra.bottom > overlayRect.top &&
        ra.top < overlayRect.bottom &&
        ra.right > overlayRect.left &&
        ra.left < overlayRect.right;
      const bVisible =
        rb.bottom > overlayRect.top &&
        rb.top < overlayRect.bottom &&
        rb.right > overlayRect.left &&
        rb.left < overlayRect.right;
      if (!aVisible || !bVisible) continue;
      // Connect the inside edges (right edge of left card, left edge of right card).
      const aRight = ra.right - overlayRect.left;
      const aMidY = ra.top + ra.height / 2 - overlayRect.top;
      const bLeft = rb.left - overlayRect.left;
      const bMidY = rb.top + rb.height / 2 - overlayRect.top;
      lines.push({
        x1: Math.min(aRight, bLeft),
        y1: aMidY,
        x2: Math.max(aRight, bLeft),
        y2: bMidY,
        key: `c-${id}`,
      });
    }
    return lines;
  })();

  return (
    <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
      <div className="px-6 pt-6 pb-3 border-b flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="button-visual-back"
          >
            <ArrowLeft className="h-4 w-4 me-1" />
            {t("common.cancel")}
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {t("snapshots.visual.title")}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data ? `${data.baseLabel} ↔ ${data.compareLabel}` : baseSnapshot.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-xs text-muted-foreground">
            {t("snapshots.compareWith")}
          </Label>
          <Select
            value={compareWith}
            onValueChange={(v) => setCompareWith(v)}
          >
            <SelectTrigger
              className="h-9 w-[200px]"
              data-testid="select-visual-compare-with"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">{t("snapshots.currentChart")}</SelectItem>
              {otherSnapshots.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 ms-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              data-testid="button-visual-zoom-out"
              title={t("snapshots.visual.zoomOut")}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              data-testid="button-visual-zoom-in"
              title={t("snapshots.visual.zoomIn")}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoom(1)}
              data-testid="button-visual-zoom-reset"
              title={t("snapshots.visual.resetZoom")}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant={changesOnly ? "default" : "outline"}
            onClick={() => setChangesOnly((v) => !v)}
            data-testid="button-visual-changes-only-toggle"
            title={
              changesOnly
                ? t("snapshots.visual.changesOnlyOn")
                : t("snapshots.visual.changesOnlyOff")
            }
          >
            {changesOnly ? (
              <>
                <FilterX className="h-4 w-4 me-1" />
                {t("snapshots.visual.changesOnlyOn")}
              </>
            ) : (
              <>
                <Filter className="h-4 w-4 me-1" />
                {t("snapshots.visual.changesOnlyOff")}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant={syncEnabled ? "default" : "outline"}
            onClick={() => setSyncEnabled((v) => !v)}
            data-testid="button-visual-sync-toggle"
          >
            {syncEnabled ? (
              <>
                <Link2 className="h-4 w-4 me-1" />
                {t("snapshots.visual.syncOn")}
              </>
            ) : (
              <>
                <Link2Off className="h-4 w-4 me-1" />
                {t("snapshots.visual.syncOff")}
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={!data || isExporting !== null}
                data-testid="button-visual-export"
              >
                {isExporting !== null ? (
                  <Loader2 className="h-4 w-4 me-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 me-1" />
                )}
                {isExporting !== null
                  ? t("snapshots.visual.exporting")
                  : t("snapshots.visual.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleExport("png")}
                disabled={isExporting !== null}
                data-testid="button-visual-export-png"
              >
                {t("snapshots.visual.exportPng")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("pdf")}
                disabled={isExporting !== null}
                data-testid="button-visual-export-pdf"
              >
                {t("snapshots.visual.exportPdf")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {exportError && (
        <div
          className="px-6 py-2 text-xs text-destructive border-b bg-destructive/5"
          data-testid="visual-export-error"
        >
          {t("snapshots.visual.exportFailed")}: {exportError}
        </div>
      )}

      {loading ? (
        <div className="p-6 grid grid-cols-2 gap-4 flex-1">
          <Skeleton className="h-full w-full" />
          <Skeleton className="h-full w-full" />
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-destructive">{error}</div>
      ) : data ? (
        <>
          <div className="px-6 py-2 border-b bg-muted/40 flex items-center justify-between flex-wrap gap-3">
            <div
              className="flex items-center gap-2 text-xs"
              data-testid="visual-summary-chip"
            >
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-300"
                data-testid="visual-summary-added"
              >
                +{addedCount} {t("snapshots.added")}
              </Badge>
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-300"
                data-testid="visual-summary-removed"
              >
                −{removedCount} {t("snapshots.removed")}
              </Badge>
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300"
                data-testid="visual-summary-changed"
              >
                ~{changedCount} {t("snapshots.changed")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => jumpTo(-1)}
                disabled={jumpIds.length === 0}
                data-testid="button-visual-prev-change"
              >
                <ChevronLeft className="h-4 w-4 me-1" />
                {t("snapshots.visual.prevChange")}
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {jumpIds.length === 0
                  ? t("snapshots.visual.noChanges")
                  : jumpIndex < 0
                    ? t("snapshots.visual.jumpCounter", {
                        current: 0,
                        total: jumpIds.length,
                      })
                    : t("snapshots.visual.jumpCounter", {
                        current: jumpIndex + 1,
                        total: jumpIds.length,
                      })}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => jumpTo(1)}
                disabled={jumpIds.length === 0}
                data-testid="button-visual-next-change"
              >
                {t("snapshots.visual.nextChange")}
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </div>

          <div
            className="relative flex-1 flex min-h-0"
            ref={overlayRef}
            dir="ltr"
          >
            <ChartPane
              roots={baseRoots}
              side="base"
              zoom={zoom}
              scrollRef={baseScrollRef}
              onScroll={handleScroll}
              registerRef={registerBaseRef}
              fieldLabel={fieldLabel}
              emptyText={t("snapshots.visual.emptyPane")}
            />
            <div className="w-px bg-border" aria-hidden="true" />
            <ChartPane
              roots={compareRoots}
              side="compare"
              zoom={zoom}
              scrollRef={compareScrollRef}
              onScroll={handleScroll}
              registerRef={registerCompareRef}
              fieldLabel={fieldLabel}
              emptyText={t("snapshots.visual.emptyPane")}
            />
            <svg
              className="absolute inset-0 pointer-events-none"
              width="100%"
              height="100%"
              aria-hidden="true"
              data-testid="visual-connector-overlay"
            >
              {connectorLines.map((l) => (
                <line
                  key={l.key}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="currentColor"
                  className="text-amber-400/70"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ))}
            </svg>
          </div>

          <div className="px-6 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-green-500" />
              {t("snapshots.visual.legendAdded")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-red-500" />
              {t("snapshots.visual.legendRemoved")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-amber-500" />
              {t("snapshots.visual.legendChanged")}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
