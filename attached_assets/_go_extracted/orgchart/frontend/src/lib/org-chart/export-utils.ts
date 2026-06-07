import { resolvePhotoUrl } from "@/lib/photo-url";
import type { OrgChartNode } from "./types";

export const PAGE_SIZES_MM: Record<"A4" | "Letter" | "A3", [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
  A3: [297, 420],
};

export interface FlatEmployee {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  departmentName: string;
  managerName: string;
  directReports: number;
  level: number;
}

export async function fetchAsDataUrl(src: string): Promise<string | null> {
  try {
    const resp = await fetch(src, { cache: "no-cache" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function imageToDataUrl(
  src: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const img = await loadImage(src);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: c.toDataURL("image/png"), width: c.width, height: c.height };
  } catch {
    return null;
  }
}

export function collectAvatarUrls(nodes: OrgChartNode[]): Map<number, string> {
  const map = new Map<number, string>();
  const walk = (list: OrgChartNode[]) => {
    for (const n of list) {
      const resolved = resolvePhotoUrl(n.avatarUrl);
      if (resolved) map.set(n.id, resolved);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return map;
}

export async function prefetchAvatarDataUrls(
  nodes: OrgChartNode[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const sources = collectAvatarUrls(nodes);
  await Promise.all(
    Array.from(sources.entries()).map(async ([id, url]) => {
      const dataUrl = await fetchAsDataUrl(url);
      if (dataUrl) out.set(id, dataUrl);
    }),
  );
  return out;
}

export function flattenTreeWithManager(nodes: OrgChartNode[]): FlatEmployee[] {
  const result: FlatEmployee[] = [];
  const walk = (list: OrgChartNode[], parentName: string, level: number) => {
    for (const n of list) {
      result.push({
        firstName: n.firstName,
        lastName: n.lastName || "",
        email: n.email,
        title: n.title,
        departmentName: n.departmentName || "",
        managerName: parentName,
        directReports: n.directReports,
        level,
      });
      if (n.children && n.children.length > 0) {
        walk(n.children, `${n.firstName} ${n.lastName || ""}`.trim(), level + 1);
      }
    }
  };
  walk(nodes, "", 0);
  return result;
}
