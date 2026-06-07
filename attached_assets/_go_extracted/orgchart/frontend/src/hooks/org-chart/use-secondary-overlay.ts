import { useEffect, useState, type RefObject } from "react";
import type { OrgChartNode } from "@/lib/org-chart/types";

interface OverlaySegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface UseSecondaryOverlayArgs {
  chartContentRef: RefObject<HTMLDivElement | null>;
  nodeRefs: RefObject<Map<number, HTMLDivElement>>;
  secondaryPairs: Array<{ employeeId: number; managerId: number }> | undefined;
  activeTreeData: OrgChartNode[] | undefined;
  collapsed: Set<number>;
  zoom: number;
  pan: { x: number; y: number };
}

export function useSecondaryOverlay({
  chartContentRef,
  nodeRefs,
  secondaryPairs,
  activeTreeData,
  collapsed,
  zoom,
  pan,
}: UseSecondaryOverlayArgs) {
  const [overlaySegments, setOverlaySegments] = useState<OverlaySegment[]>([]);
  const [overlaySize, setOverlaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const compute = () => {
      const root = chartContentRef.current;
      if (!root || !secondaryPairs || secondaryPairs.length === 0) {
        setOverlaySegments([]);
        return;
      }
      const rect = root.getBoundingClientRect();
      setOverlaySize({ w: rect.width, h: rect.height });
      const segs: OverlaySegment[] = [];
      for (const pair of secondaryPairs) {
        const empEl = nodeRefs.current?.get(pair.employeeId);
        const mgrEl = nodeRefs.current?.get(pair.managerId);
        if (!empEl || !mgrEl) continue;
        const e = empEl.getBoundingClientRect();
        const m = mgrEl.getBoundingClientRect();
        const z = zoom || 1;
        const ex = (e.left + e.width / 2 - rect.left) / z;
        const ey = (e.top - rect.top) / z;
        const mx = (m.left + m.width / 2 - rect.left) / z;
        const my = (m.bottom - rect.top) / z;
        segs.push({ id: `${pair.managerId}-${pair.employeeId}`, x1: mx, y1: my, x2: ex, y2: ey });
      }
      setOverlaySegments(segs);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (chartContentRef.current) ro.observe(chartContentRef.current);
    const id = window.setInterval(compute, 500);
    return () => { ro.disconnect(); window.clearInterval(id); };
  }, [chartContentRef, nodeRefs, secondaryPairs, activeTreeData, collapsed, zoom, pan]);

  return { overlaySegments, overlaySize };
}
