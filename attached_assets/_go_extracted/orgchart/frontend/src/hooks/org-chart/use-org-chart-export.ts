import { useCallback, useState, type RefObject } from "react";
import { resolvePhotoUrl } from "@/lib/photo-url";
import type {
  BranchHeadcount,
  ConnectorStyle,
  ExportOptions,
  OrgChartNode,
  TFn,
} from "@/lib/org-chart/types";
import {
  daysSinceOpened,
  escapeXml,
  sanitizeSvgColor,
  truncateText,
} from "@/lib/org-chart/utils";
import {
  fetchAsDataUrl,
  flattenTreeWithManager,
  imageToDataUrl,
  loadImage,
  PAGE_SIZES_MM,
  prefetchAvatarDataUrls,
} from "@/lib/org-chart/export-utils";

interface UseOrgChartExportArgs {
  t: TFn;
  chartContentRef: RefObject<HTMLDivElement | null>;
  nodeRefs: RefObject<Map<number, HTMLDivElement>>;
  activeTreeData: OrgChartNode[] | undefined;
  collapsed: Set<number>;
  setCollapsed: (next: Set<number>) => void;
  zoom: number;
  connectorStyle: ConnectorStyle;
  organization: { name?: string | null; logoUrl?: string | null } | undefined;
  selectedChartName: string | null;
  branchSummaryNode: OrgChartNode | null;
  branchSummaryStats: BranchHeadcount | null;
  isFilterActive: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  format: "png",
  pixelRatio: 2,
  transparent: false,
  pageSize: "A4",
  orientation: "landscape",
  margin: 15,
  fitMode: "fit",
  includeHeader: true,
};

export function useOrgChartExport(args: UseOrgChartExportArgs) {
  const {
    t,
    chartContentRef,
    nodeRefs,
    activeTreeData,
    collapsed,
    setCollapsed,
    zoom,
    connectorStyle,
    organization,
    selectedChartName,
    branchSummaryNode,
    branchSummaryStats,
    isFilterActive,
  } = args;

  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);

  const getExportFileName = useCallback(() => {
    const chartName = selectedChartName ?? t("orgChart.fullCompany");
    const orgName = organization?.name ?? "";
    const parts: string[] = [];
    if (orgName) parts.push(orgName);
    parts.push(chartName);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    parts.push(ts);
    return parts
      .join("_")
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, "")
      .replace(/\s+/g, "_");
  }, [selectedChartName, t, organization?.name]);

  const captureChartImage = useCallback(
    async (
      pixelRatio: number,
      transparent: boolean,
      onProgress?: (label: string, percent: number) => void,
      format: "png" | "jpeg" = "png",
    ): Promise<{ dataUrl: string; width: number; height: number } | null> => {
      const el = chartContentRef.current;
      if (!el) return null;
      const savedCollapsed = new Set(collapsed);
      if (savedCollapsed.size > 0) setCollapsed(new Set());
      await new Promise((r) => setTimeout(r, 350));
      onProgress?.("rendering", 30);

      const swappedImgs: Array<{ img: HTMLImageElement; original: string | null }> = [];
      try {
        const imgs = Array.from(el.querySelectorAll("img"));
        await Promise.all(
          imgs.map(async (img) => {
            const src = img.getAttribute("src");
            if (!src || src.startsWith("data:")) return;
            const dataUrl = await fetchAsDataUrl(src);
            if (!dataUrl) return;
            swappedImgs.push({ img, original: src });
            img.setAttribute("src", dataUrl);
            if (!img.complete || img.naturalWidth === 0) {
              await new Promise<void>((resolve) => {
                const done = () => resolve();
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
              });
            }
          }),
        );

        const htmlToImage = await import("html-to-image");
        const width = el.scrollWidth;
        const height = el.scrollHeight;
        const renderer = format === "jpeg" ? htmlToImage.toJpeg : htmlToImage.toPng;
        const dataUrl = await renderer(el, {
          pixelRatio,
          cacheBust: false,
          backgroundColor: format === "jpeg" ? "#ffffff" : transparent ? undefined : "#ffffff",
          width,
          height,
          style: { transform: "none" },
          skipFonts: false,
          ...(format === "jpeg" ? { quality: 0.95 } : {}),
        });
        onProgress?.("rendered", 65);
        return { dataUrl, width: width * pixelRatio, height: height * pixelRatio };
      } finally {
        for (const { img, original } of swappedImgs) {
          if (original !== null) img.setAttribute("src", original);
        }
        if (savedCollapsed.size > 0) setCollapsed(savedCollapsed);
      }
    },
    [chartContentRef, collapsed, setCollapsed],
  );

  const composeWithHeader = useCallback(
    async (
      imgDataUrl: string,
      imgW: number,
      imgH: number,
      transparent: boolean,
      format: "png" | "jpeg" = "png",
    ): Promise<{ dataUrl: string; width: number; height: number }> => {
      const headerH = Math.max(80, Math.round(imgH * 0.05));
      const padding = 24;
      const canvas = document.createElement("canvas");
      canvas.width = imgW;
      canvas.height = imgH + headerH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { dataUrl: imgDataUrl, width: imgW, height: imgH };

      if (!transparent) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, headerH);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, headerH - 1, canvas.width, 1);

      let textX = padding;
      if (organization?.logoUrl) {
        try {
          const logo = await loadImage(resolvePhotoUrl(organization.logoUrl) || organization.logoUrl);
          const logoH = headerH - padding;
          const logoW = (logo.width / logo.height) * logoH;
          ctx.drawImage(logo, padding, padding / 2, logoW, logoH);
          textX = padding + logoW + padding / 2;
        } catch {
          // ignore failed logo load
        }
      }

      const orgName = organization?.name || "";
      const chartName = selectedChartName ?? t("orgChart.fullCompany");
      const dateStr = new Date().toLocaleDateString();

      ctx.fillStyle = "#0f172a";
      ctx.font = `600 ${Math.round(headerH * 0.32)}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(orgName || chartName, textX, headerH * 0.38);

      ctx.fillStyle = "#64748b";
      ctx.font = `400 ${Math.round(headerH * 0.22)}px system-ui, -apple-system, sans-serif`;
      const subline = orgName ? `${chartName} · ${dateStr}` : dateStr;
      ctx.fillText(subline, textX, headerH * 0.72);

      const img = await loadImage(imgDataUrl);
      ctx.drawImage(img, 0, headerH, imgW, imgH);

      const outDataUrl =
        format === "jpeg"
          ? canvas.toDataURL("image/jpeg", 0.95)
          : canvas.toDataURL("image/png", 1.0);
      return { dataUrl: outDataUrl, width: canvas.width, height: canvas.height };
    },
    [organization, selectedChartName, t],
  );

  const captureChartSvg = useCallback(
    async (
      onProgress?: (label: string, percent: number) => void,
    ): Promise<{ svg: string; width: number; height: number } | null> => {
      const root = chartContentRef.current;
      if (!root) return null;
      const savedCollapsed = new Set(collapsed);
      if (savedCollapsed.size > 0) setCollapsed(new Set());
      await new Promise((r) => setTimeout(r, 400));
      onProgress?.("rendering", 30);

      const avatarPhotos = await prefetchAvatarDataUrls(
        (activeTreeData ?? []) as OrgChartNode[],
      );

      try {
        const rootRect = root.getBoundingClientRect();
        const z = zoom || 1;
        const W = Math.max(1, rootRect.width / z);
        const H = Math.max(1, rootRect.height / z);

        type Pos = { cx: number; top: number; bottom: number; x: number; y: number; w: number; h: number };
        const positions = new Map<number, Pos>();
        const flat: OrgChartNode[] = [];
        const walk = (nodes: OrgChartNode[]) => {
          for (const n of nodes) {
            const el = nodeRefs.current?.get(n.id);
            if (el) {
              const r = el.getBoundingClientRect();
              const x = (r.left - rootRect.left) / z;
              const y = (r.top - rootRect.top) / z;
              const w = r.width / z;
              const h = r.height / z;
              positions.set(n.id, { cx: x + w / 2, top: y, bottom: y + h, x, y, w, h });
              flat.push(n);
            }
            if (n.children?.length) walk(n.children);
          }
        };
        walk((activeTreeData ?? []) as OrgChartNode[]);

        const connectorPaths: string[] = [];
        const drawConnectors = (parent: OrgChartNode) => {
          if (!parent.children?.length) return;
          const pp = positions.get(parent.id);
          if (pp) {
            for (const c of parent.children) {
              const cp = positions.get(c.id);
              if (!cp) continue;
              const px = pp.cx;
              const py = pp.bottom;
              const cx = cp.cx;
              const cy = cp.top;
              let d: string;
              if (connectorStyle === "straight") {
                d = `M ${px} ${py} L ${cx} ${cy}`;
              } else if (connectorStyle === "curved") {
                const mid = (py + cy) / 2;
                d = `M ${px} ${py} C ${px} ${mid}, ${cx} ${mid}, ${cx} ${cy}`;
              } else {
                const mid = (py + cy) / 2;
                d = `M ${px} ${py} V ${mid} H ${cx} V ${cy}`;
              }
              connectorPaths.push(
                `<path d="${d}" stroke="#cbd5e1" stroke-width="1.5" fill="none" />`,
              );
            }
          }
          for (const c of parent.children) drawConnectors(c);
        };
        for (const r of (activeTreeData ?? []) as OrgChartNode[]) drawConnectors(r);

        onProgress?.("rendered", 55);

        const cardSvgs: string[] = [];
        for (const n of flat) {
          const p = positions.get(n.id)!;
          const isOpen = !!n.isOpenPosition;
          const fullName = isOpen
            ? t("orgChart.openPositions.openPosition")
            : `${n.firstName} ${n.lastName}`.trim();
          const initials = isOpen
            ? "?"
            : `${n.firstName?.[0] || "?"}${n.lastName?.[0] || ""}`;
          const deptColor = sanitizeSvgColor(n.departmentColor, "#94a3b8");
          const cardW = p.w;
          const cardH = p.h;
          const stroke = isOpen ? "#cbd5e1" : "#e2e8f0";
          const strokeDash = isOpen ? ` stroke-dasharray="4 3"` : "";
          const bg = isOpen ? "#f8fafc" : "#ffffff";

          let card = `<g data-employee-id="${n.id}" transform="translate(${p.x},${p.y})">`;
          card += `<rect x="0" y="0" width="${cardW}" height="${cardH}" rx="12" ry="12" fill="${bg}" stroke="${stroke}" stroke-width="2"${strokeDash} />`;
          if (n.departmentColor) {
            card += `<rect x="0" y="0" width="4" height="${cardH}" fill="${deptColor}" />`;
          }

          const padX = 16;
          const avatarR = 20;
          const avatarCx = padX + 12 + avatarR;
          const avatarCy = 16 + avatarR;
          const avatarFill = `${deptColor}33`;
          const photoData = avatarPhotos.get(n.id);
          if (photoData) {
            const clipId = `avatar-clip-${n.id}`;
            card += `<defs><clipPath id="${clipId}"><circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" /></clipPath></defs>`;
            card += `<image href="${photoData}" x="${avatarCx - avatarR}" y="${avatarCy - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" />`;
          } else {
            card += `<circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" fill="${avatarFill}" />`;
            card += `<text x="${avatarCx}" y="${avatarCy}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="${deptColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(initials)}</text>`;
          }

          const textX = avatarCx + avatarR + 12;
          card += `<text x="${textX}" y="${avatarCy - 2}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#0f172a" dominant-baseline="middle">${escapeXml(truncateText(fullName, 22))}</text>`;

          let lineY = 16 + avatarR * 2 + 18;
          const lineH = 16;
          const detailFill = "#64748b";
          const drawLine = (text: string, color?: string) => {
            if (color) {
              card += `<rect x="${padX}" y="${lineY - 5}" width="6" height="6" rx="1.5" fill="${color}" />`;
              card += `<text x="${padX + 12}" y="${lineY}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${detailFill}" dominant-baseline="middle">${escapeXml(truncateText(text, 28))}</text>`;
            } else {
              card += `<text x="${padX}" y="${lineY}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${detailFill}" dominant-baseline="middle">${escapeXml(truncateText(text, 30))}</text>`;
            }
            lineY += lineH;
          };
          if (n.title) drawLine(n.title);
          if (n.administrationName)
            drawLine(n.administrationName, sanitizeSvgColor(n.administrationColor, "#94a3b8"));
          if (n.departmentName)
            drawLine(n.departmentName, sanitizeSvgColor(n.departmentColor, "#94a3b8"));
          if (isOpen) {
            const days = daysSinceOpened(n.openSinceDate);
            drawLine(t("orgChart.openPositions.openForDays", { count: days }));
          }

          card += `</g>`;
          cardSvgs.push(card);
        }

        onProgress?.("rendered", 65);

        const body = `
  <g data-layer="connectors">
    ${connectorPaths.join("\n    ")}
  </g>
  <g data-layer="cards">
    ${cardSvgs.join("\n    ")}
  </g>`;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" />${body}
</svg>`;

        return { svg, width: W, height: H };
      } finally {
        if (savedCollapsed.size > 0) setCollapsed(savedCollapsed);
      }
    },
    [
      chartContentRef,
      collapsed,
      setCollapsed,
      activeTreeData,
      zoom,
      nodeRefs,
      connectorStyle,
      t,
    ],
  );

  const composeSvgWithHeader = useCallback(
    async (
      innerSvg: string,
      imgW: number,
      imgH: number,
    ): Promise<{ svg: string; width: number; height: number }> => {
      const headerH = Math.max(80, Math.round(imgH * 0.05));
      const padding = 24;
      const totalH = imgH + headerH;

      let logoTag = "";
      let textX = padding;
      if (organization?.logoUrl) {
        const loaded = await imageToDataUrl(organization.logoUrl);
        if (loaded) {
          const logoH = headerH - padding;
          const logoW = (loaded.width / loaded.height) * logoH;
          logoTag = `<image href="${loaded.dataUrl}" x="${padding}" y="${padding / 2}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`;
          textX = padding + logoW + padding / 2;
        }
      }

      const orgName = organization?.name || "";
      const chartName = selectedChartName ?? t("orgChart.fullCompany");
      const dateStr = new Date().toLocaleDateString();
      const titleSize = Math.round(headerH * 0.32);
      const subSize = Math.round(headerH * 0.22);
      const subline = orgName ? `${chartName} · ${dateStr}` : dateStr;

      const headerSvg = `
      <rect x="0" y="0" width="${imgW}" height="${headerH}" fill="#f8fafc" />
      <rect x="0" y="${headerH - 1}" width="${imgW}" height="1" fill="#e2e8f0" />
      ${logoTag}
      <text x="${textX}" y="${headerH * 0.38}" font-family="system-ui, -apple-system, sans-serif" font-size="${titleSize}" font-weight="600" fill="#0f172a" dominant-baseline="middle">${escapeXml(orgName || chartName)}</text>
      <text x="${textX}" y="${headerH * 0.72}" font-family="system-ui, -apple-system, sans-serif" font-size="${subSize}" font-weight="400" fill="#64748b" dominant-baseline="middle">${escapeXml(subline)}</text>
    `;

      const cleaned = innerSvg.replace(/<\?xml[^?]*\?>\s*/i, "").trim();
      const nested = cleaned.replace(/<svg\b([^>]*)>/i, `<svg$1 x="0" y="${headerH}">`);

      const wrapped = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${imgW}" height="${totalH}" viewBox="0 0 ${imgW} ${totalH}">
  <rect x="0" y="0" width="${imgW}" height="${totalH}" fill="#ffffff" />
  ${headerSvg}
  ${nested}
</svg>`;
      return { svg: wrapped, width: imgW, height: totalH };
    },
    [organization, selectedChartName, t],
  );

  const runExport = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    setExportProgress(5);
    setExportStatus(t("orgChart.exportPreparing"));
    try {
      if (exportOptions.format === "svg") {
        const capturedSvg = await captureChartSvg((_, p) => {
          setExportProgress(p);
          setExportStatus(t("orgChart.exportRendering"));
        });
        if (!capturedSvg) return;
        let finalSvg = capturedSvg;
        if (exportOptions.includeHeader) {
          setExportStatus(t("orgChart.exportBuildingSvg"));
          setExportProgress(80);
          finalSvg = await composeSvgWithHeader(
            capturedSvg.svg,
            capturedSvg.width,
            capturedSvg.height,
          );
        }
        setExportProgress(95);
        const blob = new Blob([finalSvg.svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `${getExportFileName()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        setExportProgress(100);
        setIsExportDialogOpen(false);
        return;
      }

      const isImageFormat =
        exportOptions.format === "png" || exportOptions.format === "jpeg";
      const imageFormat: "png" | "jpeg" =
        exportOptions.format === "jpeg" ? "jpeg" : "png";
      const captured = await captureChartImage(
        exportOptions.pixelRatio,
        exportOptions.transparent && exportOptions.format === "png",
        (_, p) => {
          setExportProgress(p);
          setExportStatus(t("orgChart.exportRendering"));
        },
        isImageFormat ? imageFormat : "png",
      );
      if (!captured) return;

      let finalImg = captured;
      if (exportOptions.includeHeader) {
        setExportStatus(t("orgChart.exportRendering"));
        setExportProgress(75);
        finalImg = await composeWithHeader(
          captured.dataUrl,
          captured.width,
          captured.height,
          exportOptions.transparent && exportOptions.format === "png",
          isImageFormat ? imageFormat : "png",
        );
      }

      if (exportOptions.format === "png" || exportOptions.format === "jpeg") {
        setExportProgress(95);
        const ext = exportOptions.format === "jpeg" ? "jpg" : "png";
        const link = document.createElement("a");
        link.download = `${getExportFileName()}.${ext}`;
        link.href = finalImg.dataUrl;
        link.click();
      } else {
        setExportStatus(t("orgChart.exportBuildingPdf"));
        setExportProgress(85);
        const { jsPDF } = await import("jspdf");
        const [pw, ph] = PAGE_SIZES_MM[exportOptions.pageSize];
        const pageW = exportOptions.orientation === "landscape" ? Math.max(pw, ph) : Math.min(pw, ph);
        const pageH = exportOptions.orientation === "landscape" ? Math.min(pw, ph) : Math.max(pw, ph);
        const pdf = new jsPDF({
          orientation: exportOptions.orientation,
          unit: "mm",
          format: [pageW, pageH],
        });

        const margin = exportOptions.margin;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        const pxPerMm = finalImg.width / (usableW * 2);
        const imgWmm = finalImg.width / pxPerMm / 2;
        const imgHmm = finalImg.height / pxPerMm / 2;

        if (exportOptions.fitMode === "fit") {
          const scale = Math.min(usableW / imgWmm, usableH / imgHmm);
          const w = imgWmm * scale;
          const h = imgHmm * scale;
          pdf.addImage(
            finalImg.dataUrl,
            "PNG",
            margin + (usableW - w) / 2,
            margin + (usableH - h) / 2,
            w,
            h,
            undefined,
            "FAST",
          );
        } else {
          const scale = usableW / imgWmm;
          const scaledHmm = imgHmm * scale;
          const pages = Math.max(1, Math.ceil(scaledHmm / usableH));
          const sliceHmm = usableH;
          const slicePxH = Math.round((sliceHmm / scaledHmm) * finalImg.height);

          const sourceImg = await loadImage(finalImg.dataUrl);
          for (let i = 0; i < pages; i++) {
            if (i > 0) pdf.addPage([pageW, pageH], exportOptions.orientation);
            const sy = i * slicePxH;
            const sh = Math.min(slicePxH, finalImg.height - sy);
            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = finalImg.width;
            sliceCanvas.height = sh;
            const sctx = sliceCanvas.getContext("2d");
            if (!sctx) continue;
            sctx.drawImage(sourceImg, 0, sy, finalImg.width, sh, 0, 0, finalImg.width, sh);
            const sliceData = sliceCanvas.toDataURL("image/png", 1.0);
            const sliceMm = (sh / finalImg.height) * scaledHmm;
            pdf.addImage(sliceData, "PNG", margin, margin, usableW, sliceMm, undefined, "FAST");
            setExportProgress(85 + Math.round((10 * (i + 1)) / pages));
          }
        }
        setExportProgress(98);
        pdf.save(`${getExportFileName()}.pdf`);
      }
      setExportProgress(100);
      setIsExportDialogOpen(false);
    } catch (err) {
      console.error("Export failed", err);
      setExportError(t("orgChart.exportFailed"));
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        setExportProgress(0);
        setExportStatus("");
      }, 400);
    }
  }, [
    t,
    exportOptions,
    captureChartSvg,
    composeSvgWithHeader,
    captureChartImage,
    composeWithHeader,
    getExportFileName,
  ]);

  const exportAsExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const data = activeTreeData;
      if (!data || data.length === 0) return;
      const XLSX = await import("xlsx");
      const flat = flattenTreeWithManager(data as OrgChartNode[]);
      const rows = flat.map((emp) => ({
        [t("employees.firstName")]: emp.firstName,
        [t("employees.lastName")]: emp.lastName,
        [t("employees.email")]: emp.email,
        [t("employees.jobTitle")]: emp.title,
        [t("employees.department")]: emp.departmentName,
        [t("orgChart.manager")]: emp.managerName || "—",
        [t("orgChart.directReportsCol")]: emp.directReports,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 25 },
        { wch: 20 }, { wch: 25 }, { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Org Chart");
      XLSX.writeFile(wb, `${getExportFileName()}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  }, [activeTreeData, t, getExportFileName]);

  const exportBranchHeadcount = useCallback(async () => {
    if (!branchSummaryNode || !branchSummaryStats) return;
    const XLSX = await import("xlsx");
    const branchName = `${branchSummaryNode.firstName} ${branchSummaryNode.lastName || ""}`.trim();
    const directReports = branchSummaryNode.children?.length ?? 0;
    const filled = Math.max(branchSummaryStats.total - branchSummaryStats.open, 0);
    const openPct = branchSummaryStats.total > 0
      ? Math.round((branchSummaryStats.open / branchSummaryStats.total) * 100)
      : 0;

    const summaryRows: Array<Record<string, string | number>> = [
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldBranch"), [t("orgChart.branchExportValue")]: branchName },
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldTitle"), [t("orgChart.branchExportValue")]: branchSummaryNode.title || "—" },
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldTotal"), [t("orgChart.branchExportValue")]: branchSummaryStats.total },
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldDirect"), [t("orgChart.branchExportValue")]: directReports },
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldFilled"), [t("orgChart.branchExportValue")]: filled },
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldOpen"), [t("orgChart.branchExportValue")]: branchSummaryStats.open },
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldOpenPct"), [t("orgChart.branchExportValue")]: `${openPct}%` },
      { [t("orgChart.branchExportField")]: t("orgChart.branchExportFieldFilter"), [t("orgChart.branchExportValue")]: isFilterActive ? t("orgChart.branchExportFilterActive") : t("orgChart.branchExportFilterNone") },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs["!cols"] = [{ wch: 28 }, { wch: 40 }];

    const deptRows = branchSummaryStats.byDept.map((d) => {
      const pct = branchSummaryStats.total > 0
        ? Math.round((d.count / branchSummaryStats.total) * 100)
        : 0;
      return {
        [t("orgChart.branchExportDeptName")]: d.name,
        [t("orgChart.branchExportDeptCount")]: d.count,
        [t("orgChart.branchExportDeptPct")]: `${pct}%`,
      };
    });
    const deptWs = XLSX.utils.json_to_sheet(
      deptRows.length > 0
        ? deptRows
        : [{
            [t("orgChart.branchExportDeptName")]: t("orgChart.branchSummaryNoBreakdown"),
            [t("orgChart.branchExportDeptCount")]: "",
            [t("orgChart.branchExportDeptPct")]: "",
          }]
    );
    deptWs["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summaryWs, t("orgChart.branchExportSheetSummary"));
    XLSX.utils.book_append_sheet(wb, deptWs, t("orgChart.branchExportSheetByDept"));

    const safeBranch = branchName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, "").replace(/\s+/g, "_") || "branch";
    XLSX.writeFile(wb, `${getExportFileName()}_${safeBranch}_headcount.xlsx`);
  }, [branchSummaryNode, branchSummaryStats, isFilterActive, t, getExportFileName]);

  return {
    isExporting,
    isExportDialogOpen,
    setIsExportDialogOpen,
    exportProgress,
    exportStatus,
    exportError,
    setExportError,
    exportOptions,
    setExportOptions,
    runExport,
    exportAsExcel,
    exportBranchHeadcount,
  };
}
