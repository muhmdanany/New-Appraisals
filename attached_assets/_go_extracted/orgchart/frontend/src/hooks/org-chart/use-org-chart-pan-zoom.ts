import { useCallback, useEffect, useRef, useState } from "react";

interface UsePanZoomArgs {
  selectedOrgId: number | null | undefined;
  selectedChartId: number | "full" | null;
  getViewportKey: (orgId: number, chartId: number | "full") => string;
  pausePersist?: boolean;
}

export function useOrgChartPanZoom({
  selectedOrgId,
  selectedChartId,
  getViewportKey,
  pausePersist,
}: UsePanZoomArgs) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    initialMid: { x: number; y: number };
  } | null>(null);
  const touchPanStartRef = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("[draggable='true']") && !(e.target as HTMLElement).closest("button")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.min(Math.max(prev + delta, 0.2), 2));
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      pinchStateRef.current = {
        initialDistance: Math.hypot(dx, dy),
        initialZoom: zoom,
        initialPan: { ...pan },
        initialMid: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 },
      };
      touchPanStartRef.current = null;
    } else if (e.touches.length === 1) {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("a") || target.closest("[draggable='true']")) return;
      touchPanStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        pan: { ...pan },
      };
      pinchStateRef.current = null;
    }
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStateRef.current) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStateRef.current.initialDistance;
      const newZoom = Math.min(Math.max(pinchStateRef.current.initialZoom * ratio, 0.2), 2);
      setZoom(newZoom);
    } else if (e.touches.length === 1 && touchPanStartRef.current) {
      const t1 = e.touches[0];
      const dx = t1.clientX - touchPanStartRef.current.x;
      const dy = t1.clientY - touchPanStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        e.preventDefault();
        setPan({
          x: touchPanStartRef.current.pan.x + dx,
          y: touchPanStartRef.current.pan.y + dy,
        });
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      pinchStateRef.current = null;
      touchPanStartRef.current = null;
    }
  }, []);

  // Persist viewport
  useEffect(() => {
    if (!selectedOrgId || selectedChartId === null) return;
    if (pausePersist) return;
    const timer = setTimeout(() => {
      try {
        const key = getViewportKey(selectedOrgId, selectedChartId);
        localStorage.setItem(key, JSON.stringify({ zoom, pan }));
      } catch {
        // storage unavailable
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [zoom, pan, selectedOrgId, selectedChartId, getViewportKey, pausePersist]);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    resetView,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
