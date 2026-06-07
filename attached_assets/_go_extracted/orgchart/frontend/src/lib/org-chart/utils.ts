import type { ConnectorStyle, OrgChartNode } from "./types";

export const CONNECTOR_HEIGHT = 48;

export const isMacLike = typeof navigator !== "undefined"
  ? /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  : false;

export function daysSinceOpened(openSinceDate: string | null | undefined): number {
  if (!openSinceDate) return 0;
  const opened = new Date(openSinceDate).getTime();
  if (Number.isNaN(opened)) return 0;
  const diffMs = Date.now() - opened;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function openPositionUrgency(days: number): "fresh" | "warning" | "critical" {
  if (days > 60) return "critical";
  if (days > 30) return "warning";
  return "fresh";
}

export function isConnectorStyle(v: unknown): v is ConnectorStyle {
  return v === "straight" || v === "angled" || v === "curved";
}

export function buildConnectorPath(
  style: ConnectorStyle,
  parentX: number,
  childX: number,
  height: number
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

export function countDescendants(node: OrgChartNode): number {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0
  );
}

export function collectParentIds(nodes: OrgChartNode[]): number[] {
  const ids: number[] = [];
  const walk = (list: OrgChartNode[]) => {
    for (const node of list) {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

export function findNodeById(nodes: OrgChartNode[] | undefined | null, id: number): OrgChartNode | null {
  if (!nodes) return null;
  const stack: OrgChartNode[] = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return n;
    if (n.children) stack.push(...n.children);
  }
  return null;
}

export function collectAllDescendantIds(node: OrgChartNode): number[] {
  const ids: number[] = [];
  const walk = (children: OrgChartNode[]) => {
    for (const c of children) {
      ids.push(c.id);
      if (c.children?.length) walk(c.children);
    }
  };
  if (node.children?.length) walk(node.children);
  return ids;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function truncateText(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, Math.max(0, max - 1))}…` : s;
}

export function sanitizeSvgColor(color: string | null | undefined, fallback: string): string {
  if (!color) return fallback;
  const t = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
  if (/^(?:rgb|rgba|hsl|hsla)\(\s*[\d,.\s%]+\)$/.test(t)) return t;
  if (/^[a-zA-Z]{1,30}$/.test(t)) return t;
  return fallback;
}
