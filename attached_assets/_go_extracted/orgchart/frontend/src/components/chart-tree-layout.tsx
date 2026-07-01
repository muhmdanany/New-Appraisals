import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { motion } from "framer-motion";

export type ConnectorStyle = "straight" | "angled" | "curved";

export const CONNECTOR_HEIGHT = 48;

export function isConnectorStyle(v: unknown): v is ConnectorStyle {
  return v === "straight" || v === "angled" || v === "curved";
}

export function buildConnectorPath(
  style: ConnectorStyle,
  parentX: number,
  childX: number,
  height: number,
): string {
  if (style === "straight") {
    return `M ${parentX} 0 L ${childX} ${height}`;
  }
  if (style === "curved") {
    const mid = height / 2;
    return `M ${parentX} 0 C ${parentX} ${mid}, ${childX} ${mid}, ${childX} ${height}`;
  }
  const mid = height / 2;
  return `M ${parentX} 0 V ${mid} H ${childX} V ${height}`;
}

export interface ChartChildLayout {
  width: number;
  positions: number[];
}

/**
 * Shared layout hook used by every chart-tree renderer (the main
 * interactive chart and read-only thumbnails). Measures the horizontal
 * center of each child relative to its row so connector paths can be
 * drawn from the parent down to each child. Re-measures via
 * ResizeObserver so layout stays correct under RTL, font changes,
 * window resizes, and dynamic subtree expansion.
 */
export function useChildConnectorLayout(
  rowRef: RefObject<HTMLElement | null>,
  childRefs: RefObject<(HTMLElement | null)[]>,
  enabled: boolean,
  childCount: number,
): ChartChildLayout {
  const [layout, setLayout] = useState<ChartChildLayout>({
    width: 0,
    positions: [],
  });

  useLayoutEffect(() => {
    if (!enabled) {
      setLayout((prev) =>
        prev.width === 0 && prev.positions.length === 0
          ? prev
          : { width: 0, positions: [] },
      );
      return;
    }
    const compute = () => {
      const row = rowRef.current;
      if (!row) return;
      const rowRect = row.getBoundingClientRect();
      const positions = (childRefs.current ?? [])
        .slice(0, childCount)
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
    const row = rowRef.current;
    if (row) ro.observe(row);
    (childRefs.current ?? []).forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [enabled, childCount, rowRef, childRefs]);

  return layout;
}

/**
 * Shared SVG that renders connector lines from a parent center to each
 * child center, given a measured ChartChildLayout. Used by both the
 * full interactive chart and read-only thumbnails so connector visuals
 * stay in sync across the app.
 */
export function ChartConnectors({
  layout,
  connectorStyle,
  animationsEnabled,
  height = CONNECTOR_HEIGHT,
  strokeWidth = 1,
}: {
  layout: ChartChildLayout;
  connectorStyle: ConnectorStyle;
  animationsEnabled: boolean;
  height?: number;
  strokeWidth?: number;
}) {
  return (
    <div
      className="relative pointer-events-none"
      style={{ width: layout.width || 1, height }}
      aria-hidden="true"
    >
      {layout.width > 0 && (
        <svg
          width={layout.width}
          height={height}
          className="overflow-visible block"
          style={{ color: "hsl(var(--border))" }}
        >
          {layout.positions.map((x, i) => (
            <motion.path
              key={`${connectorStyle}-${i}-${x}`}
              d={buildConnectorPath(
                connectorStyle,
                layout.width / 2,
                x,
                height,
              )}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
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
  );
}

/**
 * High-level recursive chart-tree renderer used in read-only contexts
 * (e.g. template thumbnails). The interactive chart on the main page
 * has its own per-node concerns (drag/drop, collapse, popovers, etc.)
 * and composes useChildConnectorLayout + ChartConnectors directly, but
 * the layout primitives are the same.
 */
export function ChartTreeNode<T>({
  node,
  getChildren,
  getKey,
  renderCard,
  connectorStyle = "angled",
  animationsEnabled = false,
  connectorHeight = CONNECTOR_HEIGHT,
  childGap = 12,
  strokeWidth = 1,
}: {
  node: T;
  getChildren: (n: T) => T[];
  getKey: (n: T) => string | number;
  renderCard: (n: T) => ReactNode;
  connectorStyle?: ConnectorStyle;
  animationsEnabled?: boolean;
  connectorHeight?: number;
  childGap?: number;
  strokeWidth?: number;
}) {
  const children = getChildren(node);
  const hasChildren = children.length > 0;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const childRefs = useRef<(HTMLDivElement | null)[]>([]);
  const layout = useChildConnectorLayout(
    rowRef,
    childRefs,
    hasChildren,
    children.length,
  );

  return (
    <div className="flex flex-col items-center">
      {renderCard(node)}
      {hasChildren && (
        <>
          <ChartConnectors
            layout={layout}
            connectorStyle={connectorStyle}
            animationsEnabled={animationsEnabled}
            height={connectorHeight}
            strokeWidth={strokeWidth}
          />
          <div
            ref={rowRef}
            className="flex items-stretch"
            style={{ gap: childGap }}
          >
            {children.map((child, i) => (
              <Fragment key={getKey(child)}>
                <div
                  ref={(el) => {
                    childRefs.current[i] = el;
                  }}
                  className="flex flex-col items-center"
                >
                  <ChartTreeNode
                    node={child}
                    getChildren={getChildren}
                    getKey={getKey}
                    renderCard={renderCard}
                    connectorStyle={connectorStyle}
                    animationsEnabled={animationsEnabled}
                    connectorHeight={connectorHeight}
                    childGap={childGap}
                    strokeWidth={strokeWidth}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
