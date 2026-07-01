import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import {
  useGetOrgChart,
  getGetOrgChartQueryKey,
  useListDepartments,
  useListAdministrations,
  useListTags,
  getListTagsQueryKey,
  useListEmployees,
  useMoveEmployee,
  useReorderEmployee,
  useUpdateEmployee,
  useCreateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
  getGetOrgDashboardQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  getListDepartmentsQueryKey,
  getListAdministrationsQueryKey,
  useListCharts,
  useCreateChart,
  useUpdateChart,
  useDeleteChart,
  useGetChartTree,
  useGetOrganization,
  useListAllSecondaryManagers,
  useListSecondaryManagers,
  getListChartsQueryKey,
  getGetChartTreeQueryKey,
  getListAllSecondaryManagersQueryKey,
  getListSecondaryManagersQueryKey,
  useCreateShareLink,
  useListChartViews,
  getListChartViewsQueryKey,
  type Employee,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Users,
  Edit2,
  Trash2,
  ArrowRightLeft,
  GripVertical,
  Plus,
  LayoutGrid,
  Building2,
  Briefcase,
  Network,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileCode2,
  Undo2,
  Redo2,
  Zap,
  Search,
  Spline,
  CornerDownRight,
  MoveDownRight,
  X,
  Share2,
  HelpCircle,
  Camera,
  History,
  Settings2,
  Presentation,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  LocateFixed,
} from "lucide-react";
import { getCountryByCode, countryCodeToFlag } from "@/lib/countries";
import { TalentPool } from "@/components/talent-pool";
import { OrgChartFilterBar } from "@/components/org-chart-filter-bar";
import { useOrgChartFilter, useFilteredTree } from "@/hooks/use-org-chart-filter";
import { MobileOrgChart } from "@/components/mobile-org-chart";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts";
import { usePresentationMode } from "@/lib/presentation-mode";

import type {
  BranchHeadcount,
  BranchVacancy,
  ChartFormData,
  ConnectorStyle,
  DragState,
  EditFormData,
  OpenPositionFormData,
  OrgChartNode,
  UndoAction,
} from "@/lib/org-chart/types";
import { isConnectorStyle, isMacLike, daysSinceOpened, openPositionUrgency } from "@/lib/org-chart/utils";
export { daysSinceOpened, openPositionUrgency };
import { SiblingGap } from "@/components/org-chart/sibling-gap";
import { OrgNode } from "@/components/org-chart/org-node";
import { EmployeeDetailDialog } from "@/components/org-chart/employee-detail-dialog";
import { EmployeeTableView } from "@/components/org-chart/employee-table-view";
import { BulkMoveDialog } from "@/components/org-chart/bulk-move-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table as TableIcon } from "lucide-react";
import { resolvePhotoUrl } from "@/lib/photo-url";
import { EditEmployeeDialog } from "@/components/org-chart/edit-employee-dialog";
import { OpenPositionDialog } from "@/components/org-chart/open-position-dialog";
import { ChartFormDialog } from "@/components/org-chart/chart-form-dialog";
import { ExportDialog } from "@/components/org-chart/export-dialog";
import { ShareDialog } from "@/components/org-chart/share-dialog";
import { SnapshotDialog } from "@/components/org-chart/snapshot-dialog";
import { BranchSummarySheet } from "@/components/org-chart/branch-summary-sheet";
import { ReturnToPoolDialog, type ReturnStrategy } from "@/components/org-chart/return-to-pool-dialog";
import { DeleteChartDialog } from "@/components/org-chart/delete-chart-dialog";
import { ChartViewsMenu, type ChartViewPayload } from "@/components/chart-views-menu";
import { useOrgChartPanZoom } from "@/hooks/org-chart/use-org-chart-pan-zoom";
import { useSecondaryOverlay } from "@/hooks/org-chart/use-secondary-overlay";
import { useUndoStack } from "@/hooks/org-chart/use-undo-stack";
import { useOrgChartExport } from "@/hooks/org-chart/use-org-chart-export";

const LARGE_TREE_NODE_THRESHOLD = 500;
const LARGE_TREE_ROOT_INITIAL_LIMIT = 120;
const LARGE_TREE_ROOT_STEP = 120;
const DIRECT_REPORTS_WARNING_THRESHOLD = 12;
const QUICK_SEARCH_MIN_LENGTH = 2;

type DataQualitySeverity = "critical" | "warning" | "info";

interface DataQualitySample {
  id: number;
  name: string;
  detail?: string;
}

interface DataQualityIssue {
  key: string;
  severity: DataQualitySeverity;
  title: string;
  description: string;
  count: number;
  samples: DataQualitySample[];
}

interface QuickSearchResult {
  id: number;
  name: string;
  title: string;
  email: string;
  inChart: boolean;
}

function employeeDisplayName(employee: Pick<Employee, "id" | "firstName" | "lastName" | "email">) {
  const name = `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim();
  return name || employee.email || `#${employee.id}`;
}

function normalizeSearchText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export default function OrgChartPage() {
  const { selectedOrgId } = useOrg();
  const { user, hasPermission } = useAuth();
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { open: openShortcuts } = useKeyboardShortcuts();
  const { active: presentationMode, setActive: setPresentationMode } = usePresentationMode();
  const uiText = useCallback((en: string, ar: string) => (
    i18n.language?.startsWith("ar") ? ar : en
  ), [i18n.language]);
  const [followMode, setFollowMode] = useState(true);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [showMissingSuccessors, setShowMissingSuccessors] = useState(false);
  const [missingSuccessorIds, setMissingSuccessorIds] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (!showMissingSuccessors || !selectedOrgId) {
      setMissingSuccessorIds(null);
      return;
    }
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    let cancelled = false;
    fetch(`${base}/api/organizations/${selectedOrgId}/reports/succession-coverage`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Array<{ employeeId: number; successorCount: number }>) => {
        if (cancelled) return;
        const set = new Set<number>();
        for (const row of data || []) {
          if ((row.successorCount ?? 0) === 0) set.add(row.employeeId);
        }
        setMissingSuccessorIds(set);
      })
      .catch(() => {
        if (!cancelled) setMissingSuccessorIds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showMissingSuccessors, selectedOrgId]);
  const [hintVisible, setHintVisible] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevViewportRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<"tree" | "graph">("tree");
  const [viewMode, setViewModeState] = useState<"tree" | "table" | "grid">(() => {
    try {
      const stored = localStorage.getItem("orgchart_view_mode");
      if (stored === "table" || stored === "grid" || stored === "tree") return stored;
    } catch {
      // storage unavailable
    }
    return "tree";
  });
  const setViewMode = useCallback((mode: "tree" | "table" | "grid") => {
    setViewModeState(mode);
    try {
      localStorage.setItem("orgchart_view_mode", mode);
    } catch {
      // storage unavailable
    }
  }, []);
  const [rootRenderLimit, setRootRenderLimit] = useState(LARGE_TREE_ROOT_INITIAL_LIMIT);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [bulkMoveIds, setBulkMoveIds] = useState<number[]>([]);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[]>([]);
  const [bulkActionToast, setBulkActionToast] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const chartContentRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotDesc, setSnapshotDesc] = useState("");

  const [isTalentPoolOpen, setIsTalentPoolOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareForm, setShareForm] = useState({ password: "", expiresAt: "" });
  const [createdShareUrl, setCreatedShareUrl] = useState<string>("");
  const [shareError, setShareError] = useState<string>("");
  const createShareMutation = useCreateShareLink({
    mutation: {
      onSuccess: (link) => {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        setCreatedShareUrl(`${window.location.origin}${base}/share/${link.token}`);
        setShareError("");
      },
      onError: (err: Error) => setShareError(err.message || "Failed to create share link"),
    },
  });
  const [badgePopoverOpen, setBadgePopoverOpen] = useState(false);
  const [collapsedSearchQuery, setCollapsedSearchQuery] = useState("");
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [isDataQualityOpen, setIsDataQualityOpen] = useState(false);
  const collapsedSearchInputRef = useRef<HTMLInputElement>(null);
  const orgSearchInputRef = useRef<HTMLInputElement>(null);

  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    draggedName: null,
    draggedParentId: null,
    draggedIndex: null,
    dropTargetId: null,
    reorderTarget: null,
  });

  const [selectedNode, setSelectedNode] = useState<OrgChartNode | null>(null);
  const [removeFromChartNode, setRemoveFromChartNode] = useState<OrgChartNode | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    firstName: "",
    lastName: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    nationality: "",
    administrationId: null,
    departmentId: null,
    managerId: null,
    jobDescription: "",
  });
  const [isOpenPosDialogOpen, setIsOpenPosDialogOpen] = useState(false);
  const [openPosForm, setOpenPosForm] = useState<OpenPositionFormData>({
    title: "",
    administrationId: null,
    departmentId: null,
    managerId: null,
    jobDescription: "",
  });
  const [moveToast, setMoveToast] = useState<string | null>(null);

  const getStorageKey = useCallback((orgId: number) => `orgchart_last_chart_${user?.id}_${orgId}`, [user?.id]);

  const getViewportKey = useCallback(
    (orgId: number, chartId: number | "full") => `orgchart_viewport_${user?.id}_${orgId}_${chartId}`,
    [user?.id]
  );

  const getCollapsedKey = useCallback(
    (orgId: number, chartId: number | "full") => `orgchart_collapsed_${user?.id}_${orgId}_${chartId}`,
    [user?.id]
  );

  const readStoredChartId = useCallback((orgId: number): number | "full" | null => {
    try {
      const raw = localStorage.getItem(getStorageKey(orgId));
      if (raw === "full") return "full";
      const parsed = raw !== null ? parseInt(raw, 10) : NaN;
      return !isNaN(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, [getStorageKey]);

  const [selectedChartId, setSelectedChartId] = useState<number | "full" | null>(null);

  const selectChart = useCallback((id: number | "full" | null) => {
    setSelectedChartId(id);
    if (selectedOrgId && user?.id) {
      try {
        if (id === null) {
          localStorage.removeItem(getStorageKey(selectedOrgId));
        } else {
          localStorage.setItem(getStorageKey(selectedOrgId), String(id));
        }
      } catch {
        // storage unavailable, proceed without persisting
      }
    }
  }, [selectedOrgId, user?.id, getStorageKey]);

  const {
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
  } = useOrgChartPanZoom({ selectedOrgId, selectedChartId, getViewportKey, pausePersist: presentationMode });

  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<{ id: number; name: string; description: string | null; type: string; rootEmployeeId: number | null; departmentId: number | null } | null>(null);
  const [chartForm, setChartForm] = useState<ChartFormData>({
    name: "",
    description: "",
    type: "company",
    rootEmployeeId: null,
    departmentId: null,
  });
  const [chartToDelete, setChartToDelete] = useState<{ id: number; name: string } | null>(null);
  const [chartToast, setChartToast] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const [connectorStyle, setConnectorStyleState] = useState<ConnectorStyle>(() => {
    try {
      const stored = localStorage.getItem("orgchart_connector_style");
      if (isConnectorStyle(stored)) return stored;
    } catch {
      // storage unavailable
    }
    return "angled";
  });

  const setConnectorStyle = useCallback((style: ConnectorStyle) => {
    setConnectorStyleState(style);
    try {
      localStorage.setItem("orgchart_connector_style", style);
    } catch {
      // storage unavailable
    }
  }, []);

  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    try {
      const stored = localStorage.getItem("orgchart_animations_enabled");
      if (stored !== null) return stored === "true";
    } catch {
      // storage unavailable
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setAnimationsEnabled(false);
        try { localStorage.setItem("orgchart_animations_enabled", "false"); } catch { /* storage unavailable */ }
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleAnimations = useCallback(() => {
    setAnimationsEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("orgchart_animations_enabled", String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (selectedOrgId && user?.id) {
      setSelectedChartId(readStoredChartId(selectedOrgId));
    } else {
      setSelectedChartId(null);
    }
  }, [selectedOrgId, user?.id, readStoredChartId]);

  // Reset selection / drag / undo + load persisted collapsed and viewport when chart changes
  const undoStackRef = useRef<{ reset: () => void }>({ reset: () => {} });
  const autoCollapsedLargeScopesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setSelectedNode(null);
    setDragState({ draggedId: null, draggedName: null, draggedParentId: null, draggedIndex: null, dropTargetId: null, reorderTarget: null });
    undoStackRef.current.reset();

    // If a pending chart-view restore targets this scope, skip the
    // localStorage-restore so the saved view's collapsed/zoom/pan win.
    if (pendingRestore && pendingRestore.targetScope === selectedChartId) {
      return;
    }

    if (selectedOrgId && selectedChartId !== null) {
      try {
        const collapsedKey = getCollapsedKey(selectedOrgId, selectedChartId);
        const collapsedRaw = localStorage.getItem(collapsedKey);
        if (collapsedRaw) {
          const ids: number[] = JSON.parse(collapsedRaw);
          setCollapsed(new Set(Array.isArray(ids) ? ids : []));
        } else {
          setCollapsed(new Set());
        }
      } catch {
        setCollapsed(new Set());
      }

      try {
        const key = getViewportKey(selectedOrgId, selectedChartId);
        const raw = localStorage.getItem(key);
        if (raw) {
          const { zoom: savedZoom, pan: savedPan } = JSON.parse(raw);
          if (typeof savedZoom === "number") setZoom(savedZoom);
          else setZoom(1);
          if (savedPan && typeof savedPan.x === "number" && typeof savedPan.y === "number") {
            setPan(savedPan);
          } else {
            setPan({ x: 0, y: 0 });
          }
          return;
        }
      } catch {
        // fall through to defaults
      }
    } else {
      setCollapsed(new Set());
    }

    setZoom(1);
    setPan({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChartId, selectedOrgId, getViewportKey, getCollapsedKey]);

  const { data: charts } = useListCharts(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListChartsQueryKey(selectedOrgId!) } }
  );

  const { data: organization } = useGetOrganization(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: ["getOrganization", selectedOrgId] } }
  );

  useEffect(() => {
    if (charts && typeof selectedChartId === "number") {
      const exists = charts.some((c) => c.id === selectedChartId);
      if (!exists) selectChart(null);
    }
  }, [charts, selectedChartId, selectChart]);

  const { data: chartData, isLoading } = useGetOrgChart(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId && selectedChartId === "full", queryKey: getGetOrgChartQueryKey(selectedOrgId!) } }
  );

  const numericChartId = typeof selectedChartId === "number" ? selectedChartId : null;
  const { data: chartTreeData, isLoading: isChartTreeLoading } = useGetChartTree(
    selectedOrgId!,
    numericChartId!,
    { query: { enabled: !!selectedOrgId && numericChartId !== null, queryKey: numericChartId !== null ? getGetChartTreeQueryKey(selectedOrgId!, numericChartId) : [] } }
  );

  const { data: secondaryPairs } = useListAllSecondaryManagers(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListAllSecondaryManagersQueryKey(selectedOrgId!) } }
  );

  const { data: selectedNodeSecondary } = useListSecondaryManagers(
    selectedOrgId!,
    selectedNode?.id!,
    {
      query: {
        enabled: !!selectedOrgId && !!selectedNode,
        queryKey: selectedNode
          ? getListSecondaryManagersQueryKey(selectedOrgId!, selectedNode.id)
          : [],
      },
    }
  );

  const rawActiveTreeData = selectedChartId === null ? undefined : selectedChartId === "full" ? chartData : chartTreeData;
  const activeLoading = selectedChartId === null ? false : selectedChartId === "full" ? isLoading : isChartTreeLoading;

  const filterScopeKey =
    selectedOrgId && selectedChartId !== null
      ? `${user?.id}_${selectedOrgId}_${selectedChartId}`
      : null;
  const {
    filter,
    toggleDepartment: filterToggleDepartment,
    toggleAdministration: filterToggleAdministration,
    toggleNationality: filterToggleNationality,
    toggleTitle: filterToggleTitle,
    toggleTag: filterToggleTag,
    setTagsMode: filterSetTagsMode,
    clear: clearFilter,
    applyFilter,
    isActive: isFilterActive,
  } = useOrgChartFilter(filterScopeKey);

  const { tree: filteredTree, visibleCount, totalCount } = useFilteredTree(
    rawActiveTreeData as OrgChartNode[] | undefined,
    filter,
  );

  const activeTreeData = isFilterActive ? filteredTree : (rawActiveTreeData as OrgChartNode[] | undefined);
  const isLargeTree = totalCount >= LARGE_TREE_NODE_THRESHOLD;
  const effectiveAnimationsEnabled = animationsEnabled && !isLargeTree;
  const activeRootCount = activeTreeData?.length ?? 0;
  const renderedTreeRoots = useMemo(() => {
    const roots = (activeTreeData as OrgChartNode[] | undefined) ?? [];
    if (!isLargeTree || viewMode !== "tree") return roots;
    return roots.slice(0, rootRenderLimit);
  }, [activeTreeData, isLargeTree, viewMode, rootRenderLimit]);
  const remainingRootCount = Math.max(0, activeRootCount - renderedTreeRoots.length);
  const nextRootBatchCount = Math.min(LARGE_TREE_ROOT_STEP, remainingRootCount);

  useEffect(() => {
    setRootRenderLimit(LARGE_TREE_ROOT_INITIAL_LIMIT);
  }, [selectedOrgId, selectedChartId, isFilterActive, viewMode]);

  const filterNationalityOptions = useMemo(() => {
    const tree = rawActiveTreeData as OrgChartNode[] | undefined;
    if (!tree) return [] as Array<{ code: string; name: string; flag: string }>;
    const codes = new Set<string>();
    const walk = (nodes: OrgChartNode[]) => {
      for (const n of nodes) {
        if (n.nationality) codes.add(n.nationality.toUpperCase());
        if (n.children?.length) walk(n.children);
      }
    };
    walk(tree);
    const isAr = i18n.language?.startsWith("ar");
    return Array.from(codes)
      .map((code) => {
        const c = getCountryByCode(code);
        return {
          code,
          name: c ? (isAr ? c.nameAr : c.name) : code,
          flag: c?.flag || countryCodeToFlag(code),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawActiveTreeData, i18n.language]);

  const filterTitleOptions = useMemo(() => {
    const tree = rawActiveTreeData as OrgChartNode[] | undefined;
    if (!tree) return [] as Array<{ title: string }>;
    const titles = new Set<string>();
    const walk = (nodes: OrgChartNode[]) => {
      for (const n of nodes) {
        const ttl = (n.title || "").trim();
        if (ttl) titles.add(ttl);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(tree);
    return Array.from(titles)
      .sort((a, b) => a.localeCompare(b))
      .map((title) => ({ title }));
  }, [rawActiveTreeData]);

  const noDepartmentLabel = t("orgChart.noDepartment");
  const { headcountMap, orgTotalCount, orgOpenCount, orgLongestVacancy } = useMemo(() => {
    const map = new Map<number, BranchHeadcount>();
    let orgTotal = 0;
    let orgOpen = 0;
    let orgLongest: BranchVacancy | null = null;
    if (!activeTreeData || activeTreeData.length === 0) {
      return { headcountMap: map, orgTotalCount: 0, orgOpenCount: 0, orgLongestVacancy: null };
    }
    type DeptAgg = Map<string, { id: number | null; name: string; color: string | null; count: number }>;
    const now = Date.now();
    const computeDays = (n: OrgChartNode): number | null => {
      if (!n.openSinceDate) return null;
      const ts = Date.parse(n.openSinceDate);
      if (Number.isNaN(ts)) return null;
      return Math.max(0, Math.floor((now - ts) / 86400000));
    };
    const toVacancy = (n: OrgChartNode): BranchVacancy | null => {
      const days = computeDays(n);
      if (days === null) return null;
      const fullName = `${n.firstName ?? ""} ${n.lastName ?? ""}`.trim();
      return { id: n.id, name: fullName, title: n.title ?? "", days };
    };
    const visit = (node: OrgChartNode): { total: number; open: number; deptAgg: DeptAgg; vacancies: BranchVacancy[] } => {
      let total = 0;
      let open = 0;
      const deptAgg: DeptAgg = new Map();
      const vacancies: BranchVacancy[] = [];
      const addEmployee = (n: OrgChartNode) => {
        total += 1;
        if (n.isActive === false) open += 1;
        if (n.isOpenPosition) {
          const v = toVacancy(n);
          if (v) {
            vacancies.push(v);
            if (!orgLongest || v.days > orgLongest.days) orgLongest = v;
          }
        }
        const key = n.departmentId === null || n.departmentId === undefined ? "__none__" : String(n.departmentId);
        const name = n.departmentName || noDepartmentLabel;
        const existing = deptAgg.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          deptAgg.set(key, {
            id: n.departmentId ?? null,
            name,
            color: n.departmentColor ?? null,
            count: 1,
          });
        }
      };
      for (const child of node.children || []) {
        addEmployee(child);
        const sub = visit(child);
        total += sub.total;
        open += sub.open;
        for (const v of sub.vacancies) vacancies.push(v);
        for (const [k, v] of sub.deptAgg) {
          const existing = deptAgg.get(k);
          if (existing) existing.count += v.count;
          else deptAgg.set(k, { ...v });
        }
      }
      const sortedVac = vacancies.slice().sort((a, b) => b.days - a.days);
      const avgVacantDays = sortedVac.length
        ? Math.round(sortedVac.reduce((acc, v) => acc + v.days, 0) / sortedVac.length)
        : null;
      map.set(node.id, {
        total,
        open,
        byDept: Array.from(deptAgg.values()).sort((a, b) => b.count - a.count),
        vacancies: sortedVac,
        avgVacantDays,
      });
      return { total, open, deptAgg, vacancies };
    };
    for (const root of activeTreeData as OrgChartNode[]) {
      orgTotal += 1;
      const rootNode = root as OrgChartNode;
      if (rootNode.isActive === false) orgOpen += 1;
      if (rootNode.isOpenPosition) {
        const v = toVacancy(rootNode);
        if (v && (!orgLongest || v.days > (orgLongest as BranchVacancy).days)) orgLongest = v;
      }
      const sub = visit(rootNode);
      orgTotal += sub.total;
      orgOpen += sub.open;
    }
    return { headcountMap: map, orgTotalCount: orgTotal, orgOpenCount: orgOpen, orgLongestVacancy: orgLongest as BranchVacancy | null };
  }, [activeTreeData, noDepartmentLabel]);

  const [branchSummaryNodeId, setBranchSummaryNodeId] = useState<number | null>(null);
  const handleShowBranchSummary = useCallback((id: number) => {
    setBranchSummaryNodeId(id);
  }, []);
  const branchSummaryNode = useMemo(() => {
    if (branchSummaryNodeId === null || !activeTreeData) return null;
    const stack: OrgChartNode[] = [...(activeTreeData as OrgChartNode[])];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === branchSummaryNodeId) return n;
      if (n.children) stack.push(...n.children);
    }
    return null;
  }, [branchSummaryNodeId, activeTreeData]);
  const branchSummaryStats = branchSummaryNodeId !== null ? headcountMap.get(branchSummaryNodeId) ?? null : null;

  const { data: departments } = useListDepartments(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListDepartmentsQueryKey(selectedOrgId!) } }
  );

  const { data: administrations } = useListAdministrations(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListAdministrationsQueryKey(selectedOrgId!) } }
  );

  const { data: tagLibrary } = useListTags(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListTagsQueryKey(selectedOrgId!) } }
  );

  const { data: employees } = useListEmployees(
    selectedOrgId!,
    {},
    { query: { enabled: !!selectedOrgId, queryKey: getListEmployeesQueryKey(selectedOrgId!) } }
  );

  const talentPoolEmployees = useMemo(() => {
    if (!employees) return [];
    const deptMap = new Map(
      (departments || []).map((d) => [d.id, { name: d.name, color: d.color }])
    );
    return employees
      .filter((e) => !e.showInOrgChart)
      .map((e) => {
        const dept = e.departmentId ? deptMap.get(e.departmentId) : undefined;
        return {
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName || "",
          title: e.title,
          email: e.email,
          avatarUrl: null as string | null,
          departmentId: e.departmentId ?? null,
          departmentName: dept?.name || null,
          departmentColor: dept?.color || null,
          managerId: e.managerId ?? null,
        };
      });
  }, [employees, departments]);

  const talentPoolManagers = useMemo(() => {
    const tree = activeTreeData as OrgChartNode[] | undefined;
    if (!tree) return [] as Array<{ id: number; name: string; title: string | null }>;
    const out: Array<{ id: number; name: string; title: string | null }> = [];
    const walk = (nodes: OrgChartNode[]) => {
      for (const node of nodes) {
        if (!node.isOpenPosition) {
          out.push({
            id: node.id,
            name: `${node.firstName} ${node.lastName}`.trim(),
            title: node.title || null,
          });
        }
        if (node.children?.length) walk(node.children);
      }
    };
    walk(tree);
    return out.sort((a, b) => a.name.localeCompare(b.name, i18n.language || undefined));
  }, [activeTreeData, i18n.language]);

  const createChartMutation = useCreateChart({
    mutation: {
      onSuccess: (createdChart) => {
        if (selectedOrgId) {
          queryClient.invalidateQueries({ queryKey: getListChartsQueryKey(selectedOrgId) });
          queryClient.invalidateQueries({ queryKey: getGetChartTreeQueryKey(selectedOrgId, createdChart.id) });
        }
        selectChart(createdChart.id);
        setIsChartDialogOpen(false);
        setChartToast(t("orgChart.chartCreated"));
        setTimeout(() => setChartToast(null), 3000);
      },
      onError: () => {
        setChartToast(t("orgChart.chartCreateFailed"));
        setTimeout(() => setChartToast(null), 4000);
      },
    },
  });

  const updateChartMutation = useUpdateChart({
    mutation: {
      onSuccess: () => {
        if (selectedOrgId) {
          queryClient.invalidateQueries({ queryKey: getListChartsQueryKey(selectedOrgId) });
          if (typeof selectedChartId === "number") queryClient.invalidateQueries({ queryKey: getGetChartTreeQueryKey(selectedOrgId, selectedChartId) });
        }
        setIsChartDialogOpen(false);
        setEditingChart(null);
        setChartToast(t("orgChart.chartUpdated"));
        setTimeout(() => setChartToast(null), 3000);
      },
      onError: () => {
        setChartToast(t("orgChart.chartUpdateFailed"));
        setTimeout(() => setChartToast(null), 4000);
      },
    },
  });

  const deleteChartMutation = useDeleteChart({
    mutation: {
      onSuccess: () => {
        if (selectedOrgId) queryClient.invalidateQueries({ queryKey: getListChartsQueryKey(selectedOrgId) });
        if (chartToDelete && selectedChartId === chartToDelete.id) selectChart(null);
        setChartToDelete(null);
        setChartToast(t("orgChart.chartDeleted"));
        setTimeout(() => setChartToast(null), 3000);
      },
    },
  });

  const openCreateChart = useCallback(() => {
    setEditingChart(null);
    setChartForm({ name: "", description: "", type: "company", rootEmployeeId: null, departmentId: null });
    setIsChartDialogOpen(true);
  }, []);

  const openEditChart = useCallback((chart: { id: number; name: string; description: string | null; type: string; rootEmployeeId: number | null; departmentId: number | null }) => {
    setEditingChart(chart);
    setChartForm({
      name: chart.name,
      description: chart.description || "",
      type: chart.type,
      rootEmployeeId: chart.rootEmployeeId,
      departmentId: chart.departmentId,
    });
    setIsChartDialogOpen(true);
  }, []);

  const handleSaveChart = useCallback(() => {
    if (!selectedOrgId || !chartForm.name.trim()) return;
    if (editingChart) {
      updateChartMutation.mutate({
        orgId: selectedOrgId,
        chartId: editingChart.id,
        data: {
          name: chartForm.name.trim(),
          description: chartForm.description.trim() || undefined,
          type: chartForm.type as "company" | "department" | "management",
          rootEmployeeId: chartForm.rootEmployeeId || undefined,
          departmentId: chartForm.departmentId || undefined,
        },
      });
    } else {
      createChartMutation.mutate({
        orgId: selectedOrgId,
        data: {
          name: chartForm.name.trim(),
          description: chartForm.description.trim() || undefined,
          type: chartForm.type as "company" | "department" | "management",
          rootEmployeeId: chartForm.rootEmployeeId || undefined,
          departmentId: chartForm.departmentId || undefined,
        },
      });
    }
  }, [selectedOrgId, chartForm, editingChart, createChartMutation, updateChartMutation]);

  const invalidateAll = useCallback(() => {
    if (!selectedOrgId) return;
    queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(selectedOrgId) });
    if (typeof selectedChartId === "number") queryClient.invalidateQueries({ queryKey: getGetChartTreeQueryKey(selectedOrgId, selectedChartId) });
  }, [queryClient, selectedOrgId, selectedChartId]);

  const moveMutation = useMoveEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
      },
    },
  });

  const reorderMutation = useReorderEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
      },
    },
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsEditOpen(false);
        setSelectedNode(null);
      },
    },
  });

  const bulkDeleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
      },
    },
  });

  const collectFilteredIds = useCallback((nodes: OrgChartNode[] | undefined): Set<number> => {
    const out = new Set<number>();
    if (!nodes) return out;
    const walk = (list: OrgChartNode[]) => {
      for (const n of list) {
        out.add(n.id);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }, []);

  const activeTreeIdSet = useMemo(
    () => collectFilteredIds(rawActiveTreeData as OrgChartNode[] | undefined),
    [collectFilteredIds, rawActiveTreeData]
  );

  const quickSearchResults = useMemo<QuickSearchResult[]>(() => {
    const q = normalizeSearchText(orgSearchQuery);
    if (q.length < QUICK_SEARCH_MIN_LENGTH || !employees) return [];

    return employees
      .filter((employee) => {
        const haystack = [
          employeeDisplayName(employee),
          employee.title,
          employee.email,
          employee.location ?? "",
          employee.nationality ?? "",
        ].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aInChart = activeTreeIdSet.has(a.id);
        const bInChart = activeTreeIdSet.has(b.id);
        if (aInChart !== bInChart) return aInChart ? -1 : 1;
        return employeeDisplayName(a).localeCompare(employeeDisplayName(b));
      })
      .slice(0, 8)
      .map((employee) => ({
        id: employee.id,
        name: employeeDisplayName(employee),
        title: employee.title,
        email: employee.email,
        inChart: activeTreeIdSet.has(employee.id),
      }));
  }, [activeTreeIdSet, employees, orgSearchQuery]);

  const dataQuality = useMemo(() => {
    const allEmployees = employees ?? [];
    const employeeById = new Map(allEmployees.map((employee) => [employee.id, employee]));
    const visibleEmployees = allEmployees.filter((employee) => employee.showInOrgChart);
    const visiblePeople = visibleEmployees.filter((employee) => !employee.isOpenPosition);
    const visibleIds = new Set(visibleEmployees.map((employee) => employee.id));
    const directReports = new Map<number, Employee[]>();

    for (const employee of visibleEmployees) {
      if (employee.managerId == null) continue;
      const bucket = directReports.get(employee.managerId) ?? [];
      bucket.push(employee);
      directReports.set(employee.managerId, bucket);
    }

    const toSamples = (rows: Employee[], limit = 4): DataQualitySample[] =>
      rows.slice(0, limit).map((employee) => ({
        id: employee.id,
        name: employeeDisplayName(employee),
        detail: employee.title || employee.email,
      }));

    const issues: DataQualityIssue[] = [];
    const addIssue = (
      key: string,
      severity: DataQualitySeverity,
      title: string,
      description: string,
      rows: Employee[],
    ) => {
      if (rows.length === 0) return;
      issues.push({
        key,
        severity,
        title,
        description,
        count: rows.length,
        samples: toSamples(rows),
      });
    };

    const emailBuckets = new Map<string, Employee[]>();
    for (const employee of allEmployees) {
      const email = normalizeSearchText(employee.email);
      if (!email || employee.isOpenPosition) continue;
      const bucket = emailBuckets.get(email) ?? [];
      bucket.push(employee);
      emailBuckets.set(email, bucket);
    }
    const duplicateEmailEmployees = Array.from(emailBuckets.values())
      .filter((bucket) => bucket.length > 1)
      .flat();

    const orphanManagerEmployees = visibleEmployees.filter(
      (employee) => employee.managerId != null && !visibleIds.has(employee.managerId)
    );
    const rootEmployees = visibleEmployees.filter((employee) => employee.managerId == null);
    const missingDepartments = visiblePeople.filter((employee) => employee.departmentId == null);
    const missingAdministrations = visiblePeople.filter((employee) => employee.administrationId == null);
    const missingJobDescriptions = visiblePeople.filter(
      (employee) => !normalizeSearchText(employee.jobDescription)
    );
    const inactiveInChart = visiblePeople.filter((employee) => employee.isActive === false);
    const overloadedManagers = Array.from(directReports.entries())
      .filter(([, reports]) => reports.length > DIRECT_REPORTS_WARNING_THRESHOLD)
      .map(([managerId]) => employeeById.get(managerId))
      .filter((employee): employee is Employee => !!employee);
    const talentPoolEmployeesCount = allEmployees.filter((employee) => !employee.showInOrgChart).length;

    addIssue(
      "duplicate-email",
      "critical",
      uiText("Duplicate emails", "بريد إلكتروني مكرر"),
      uiText("These employees share an email address.", "يوجد موظفون يستخدمون نفس البريد الإلكتروني."),
      duplicateEmailEmployees,
    );
    addIssue(
      "orphan-manager",
      "critical",
      uiText("Manager not in chart", "مدير غير موجود في الهيكل"),
      uiText("These employees point to a manager outside the visible chart.", "هؤلاء الموظفون مرتبطون بمدير غير ظاهر داخل الهيكل."),
      orphanManagerEmployees,
    );
    if (rootEmployees.length > 1) {
      addIssue(
        "multiple-roots",
        "warning",
        uiText("Multiple top-level employees", "أكثر من موظف في أعلى الهيكل"),
        uiText("Review whether these roots should report to one leader.", "راجع إن كان ينبغي ربط هذه الجذور بقائد واحد."),
        rootEmployees,
      );
    }
    addIssue(
      "missing-department",
      "warning",
      uiText("Missing departments", "أقسام غير محددة"),
      uiText("Departments improve filtering, reporting, and exports.", "تحديد القسم يحسن الفلاتر والتقارير والتصدير."),
      missingDepartments,
    );
    addIssue(
      "missing-administration",
      "warning",
      uiText("Missing administrations", "إدارات غير محددة"),
      uiText("Administrations make high-level reporting cleaner.", "تحديد الإدارة يجعل التقارير العليا أوضح."),
      missingAdministrations,
    );
    addIssue(
      "missing-job-description",
      "info",
      uiText("Missing job descriptions", "وصف وظيفي غير مكتمل"),
      uiText("Role descriptions help handover, succession, and hiring.", "الوصف الوظيفي يساعد في التسليم والتعاقب والتوظيف."),
      missingJobDescriptions,
    );
    addIssue(
      "inactive-in-chart",
      "warning",
      uiText("Inactive people still shown", "موظفون غير نشطين ظاهرون"),
      uiText("Inactive people can skew headcount and reporting.", "الموظفون غير النشطين قد يؤثرون على أعداد وتقارير الهيكل."),
      inactiveInChart,
    );
    addIssue(
      "overloaded-manager",
      "info",
      uiText("High direct-report load", "عدد مرؤوسين مباشر كبير"),
      uiText(`Managers above ${DIRECT_REPORTS_WARNING_THRESHOLD} direct reports may need review.`, `المديرون فوق ${DIRECT_REPORTS_WARNING_THRESHOLD} مرؤوس مباشر قد يحتاجون مراجعة.`),
      overloadedManagers,
    );

    const severityWeight = { critical: 12, warning: 6, info: 2 } satisfies Record<DataQualitySeverity, number>;
    const penalty = issues.reduce((total, issue) => total + Math.min(issue.count, 10) * severityWeight[issue.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const infoCount = issues.filter((issue) => issue.severity === "info").length;

    return {
      score,
      issues,
      criticalCount,
      warningCount,
      infoCount,
      talentPoolEmployeesCount,
      visibleEmployeesCount: visibleEmployees.length,
      totalEmployeesCount: allEmployees.length,
    };
  }, [employees, uiText]);

  const handleBulkMove = useCallback((ids: number[]) => {
    setBulkMoveIds(ids);
    setIsBulkMoveOpen(true);
  }, []);

  const handleBulkMoveConfirm = useCallback(async (newManagerId: number | null) => {
    if (!selectedOrgId || bulkMoveIds.length === 0) return;
    let success = 0;
    let failed = 0;
    for (const id of bulkMoveIds) {
      try {
        await moveMutation.mutateAsync({ id, data: { managerId: newManagerId } });
        success++;
      } catch {
        failed++;
      }
    }
    setIsBulkMoveOpen(false);
    setBulkMoveIds([]);
    setBulkSelectedIds(new Set());
    if (failed > 0) {
      setBulkActionToast(t("orgChart.table.bulkActionFailed"));
    } else {
      setBulkActionToast(t("orgChart.table.moveSuccess", { count: success }));
    }
    setTimeout(() => setBulkActionToast(null), 3000);
  }, [bulkMoveIds, selectedOrgId, moveMutation, t]);

  const handleBulkDelete = useCallback((ids: number[]) => {
    setBulkDeleteIds(ids);
  }, []);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!selectedOrgId || bulkDeleteIds.length === 0) return;
    const ids = bulkDeleteIds;
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await bulkDeleteMutation.mutateAsync({ orgId: selectedOrgId, id });
        success++;
      } catch {
        failed++;
      }
    }
    setBulkDeleteIds([]);
    setBulkSelectedIds(new Set());
    if (failed > 0) {
      setBulkActionToast(t("orgChart.table.bulkActionFailed"));
    } else {
      setBulkActionToast(t("orgChart.table.deleteSuccess", { count: success }));
    }
    setTimeout(() => setBulkActionToast(null), 3000);
  }, [bulkDeleteIds, selectedOrgId, bulkDeleteMutation, t]);

  const handleBulkExport = useCallback((ids: number[]) => {
    if (!employees || ids.length === 0) return;
    const idSet = new Set(ids);
    const rows = employees.filter((e) => idSet.has(e.id));
    const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name] as const));
    const empMap = new Map(employees.map((e) => [e.id, e] as const));
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      t("orgChart.table.name"),
      t("orgChart.table.title"),
      t("orgChart.table.department"),
      t("orgChart.table.manager"),
      t("orgChart.table.email"),
      t("orgChart.table.phone"),
      t("orgChart.table.location"),
    ];
    const lines = [header.join(",")];
    for (const e of rows) {
      const mgr = e.managerId != null ? empMap.get(e.managerId) : null;
      lines.push([
        `${e.firstName} ${e.lastName}`,
        e.title,
        e.departmentId != null ? deptMap.get(e.departmentId) ?? "" : "",
        mgr ? `${mgr.firstName} ${mgr.lastName}` : "",
        e.email,
        e.phone ?? "",
        e.location ?? "",
      ].map(escape).join(","));
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBulkActionToast(t("orgChart.table.exportSuccess", { count: rows.length }));
    setTimeout(() => setBulkActionToast(null), 3000);
  }, [employees, departments, t]);

  const createOpenPositionMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsOpenPosDialogOpen(false);
        setOpenPosForm({ title: "", administrationId: null, departmentId: null, managerId: null, jobDescription: "" });
      },
    },
  });

  const handleCreateOpenPosition = useCallback(() => {
    if (!selectedOrgId || !openPosForm.title.trim()) return;
    if (createOpenPositionMutation.isPending) return;
    createOpenPositionMutation.mutate({
      orgId: selectedOrgId,
      data: {
        title: openPosForm.title.trim(),
        firstName: "Open",
        lastName: "Position",
        email: "",
        isOpenPosition: true,
        showInOrgChart: true,
        administrationId: openPosForm.administrationId,
        departmentId: openPosForm.departmentId,
        managerId: openPosForm.managerId,
        jobDescription: openPosForm.jobDescription ?? "",
      },
    });
  }, [selectedOrgId, openPosForm, createOpenPositionMutation]);

  const handleFillPosition = useCallback((nodeOverride?: OrgChartNode) => {
    const targetNode = nodeOverride ?? selectedNode;
    if (!targetNode) return;
    setSelectedNode(targetNode);
    setEditForm({
      firstName: targetNode.firstName === "Open" ? "" : targetNode.firstName,
      lastName: targetNode.lastName === "Position" ? "" : targetNode.lastName,
      title: targetNode.title,
      email: targetNode.email || "",
      phone: "",
      location: "",
      nationality: targetNode.nationality || "",
      administrationId: targetNode.administrationId,
      departmentId: targetNode.departmentId,
      managerId: targetNode.managerId,
      jobDescription:
        employees?.find((e) => e.id === targetNode.id)?.jobDescription || "",
    });
    setIsEditOpen(true);
  }, [selectedNode, employees]);

  const collectParentIds = useCallback((nodes: OrgChartNode[]): number[] => {
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
  }, []);

  // Undo/redo history hook (handles Ctrl/Cmd+Z and Ctrl/Cmd+Y internally)
  const handleUndoAction = useCallback((action: UndoAction) => {
    if (action.type === "collapse") {
      setCollapsed(new Set(action.undoSnapshot));
    } else if (action.type === "reorder") {
      reorderMutation.mutate({ id: action.employeeId, data: { newIndex: action.undoIndex } });
    } else if (action.type === "move") {
      moveMutation.mutate({
        id: action.employeeId,
        data: {
          managerId: action.undoManagerId,
          ...(action.undoShowInOrgChart !== undefined ? { showInOrgChart: action.undoShowInOrgChart } : {}),
        },
      });
    }
  }, [moveMutation, reorderMutation]);

  const handleRedoAction = useCallback((action: UndoAction) => {
    if (action.type === "collapse") {
      setCollapsed(new Set(action.redoSnapshot));
    } else if (action.type === "reorder") {
      reorderMutation.mutate({ id: action.employeeId, data: { newIndex: action.redoIndex } });
    } else if (action.type === "move") {
      moveMutation.mutate({
        id: action.employeeId,
        data: {
          managerId: action.redoManagerId,
          ...(action.redoShowInOrgChart !== undefined ? { showInOrgChart: action.redoShowInOrgChart } : {}),
        },
      });
    }
  }, [moveMutation, reorderMutation]);

  const undoStatusMessage = useCallback(() => t("orgChart.undoDone"), [t]);
  const redoStatusMessage = useCallback(() => t("orgChart.redoDone"), [t]);

  const {
    undoToast,
    undoStack,
    redoStack,
    showUndoToast,
    handleUndo,
    handleRedo,
    reset: resetUndo,
  } = useUndoStack({
    onUndo: handleUndoAction,
    onRedo: handleRedoAction,
    onUndoStatus: undoStatusMessage,
    onRedoStatus: redoStatusMessage,
    historyLimit: 5,
  });

  // Wire ref so the chart-change effect can reset the undo stack without depending on resetUndo identity
  useEffect(() => {
    undoStackRef.current.reset = resetUndo;
  }, [resetUndo]);

  const toggleCollapse = useCallback((id: number) => {
    const snapshot = new Set(collapsed);
    const isCurrentlyCollapsed = collapsed.has(id);
    const redoSnapshot = new Set(collapsed);
    if (redoSnapshot.has(id)) redoSnapshot.delete(id);
    else redoSnapshot.add(id);
    setCollapsed(redoSnapshot);
    if (isCurrentlyCollapsed) {
      showUndoToast({ type: "collapse", message: t("orgChart.nodeExpandedUndoMsg"), undoSnapshot: snapshot, redoSnapshot });
    } else {
      showUndoToast({ type: "collapse", message: t("orgChart.nodeCollapsedUndoMsg"), undoSnapshot: snapshot, redoSnapshot });
    }
  }, [collapsed, showUndoToast, t]);

  const expandAll = useCallback(() => {
    showUndoToast({ type: "collapse", message: t("orgChart.expandAllUndoMsg"), undoSnapshot: new Set(collapsed), redoSnapshot: new Set() });
    setCollapsed(new Set());
  }, [showUndoToast, t, collapsed]);

  const collapseAll = useCallback(() => {
    if (!activeTreeData) return;
    const ids = collectParentIds(activeTreeData as OrgChartNode[]);
    const redoSnapshot = new Set(ids);
    showUndoToast({ type: "collapse", message: t("orgChart.collapseAllUndoMsg"), undoSnapshot: new Set(collapsed), redoSnapshot });
    setCollapsed(redoSnapshot);
  }, [activeTreeData, collectParentIds, showUndoToast, t, collapsed]);

  useEffect(() => {
    if (!selectedOrgId || selectedChartId === null || !activeTreeData || !isLargeTree || isFilterActive) return;
    const scope = `${selectedOrgId}:${selectedChartId}`;
    if (autoCollapsedLargeScopesRef.current.has(scope)) return;
    const autoCollapseKey = `orgchart_large_auto_collapsed_${user?.id ?? "anon"}_${selectedOrgId}_${selectedChartId}`;

    try {
      if (localStorage.getItem(autoCollapseKey)) {
        autoCollapsedLargeScopesRef.current.add(scope);
        return;
      }
      const collapsedRaw = localStorage.getItem(getCollapsedKey(selectedOrgId, selectedChartId));
      if (collapsedRaw) {
        const savedIds = JSON.parse(collapsedRaw);
        if (Array.isArray(savedIds) && savedIds.length > 0) {
          autoCollapsedLargeScopesRef.current.add(scope);
          return;
        }
      }
    } catch {
      // storage unavailable; fall through to the in-memory guard
    }

    const ids = collectParentIds(activeTreeData as OrgChartNode[]);
    if (ids.length === 0) {
      autoCollapsedLargeScopesRef.current.add(scope);
      return;
    }

    setCollapsed((prev) => {
      autoCollapsedLargeScopesRef.current.add(scope);
      if (prev.size > 0) return prev;
      try {
        localStorage.setItem(autoCollapseKey, "1");
      } catch {
        // storage unavailable
      }
      return new Set(ids);
    });
  }, [
    selectedOrgId,
    selectedChartId,
    user?.id,
    activeTreeData,
    isLargeTree,
    isFilterActive,
    getCollapsedKey,
    collectParentIds,
  ]);

  const collapsedCount = useMemo(() => {
    if (!activeTreeData || collapsed.size === 0) return 0;
    const parentIds = new Set(collectParentIds(activeTreeData as OrgChartNode[]));
    let count = 0;
    for (const id of collapsed) {
      if (parentIds.has(id)) count++;
    }
    return count;
  }, [activeTreeData, collapsed, collectParentIds]);

  const collapsedNodesList = useMemo(() => {
    if (!activeTreeData || collapsed.size === 0) return [] as { id: number; name: string; hiddenCount: number }[];
    const parentIds = new Set(collectParentIds(activeTreeData as OrgChartNode[]));
    const nodeMap = new Map<number, OrgChartNode>();
    const traverse = (nodes: OrgChartNode[]) => {
      for (const node of nodes) {
        nodeMap.set(node.id, node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(activeTreeData as OrgChartNode[]);
    const countDescendants = (node: OrgChartNode): number => {
      if (!node.children || node.children.length === 0) return 0;
      let total = node.children.length;
      for (const child of node.children) total += countDescendants(child);
      return total;
    };
    const result: { id: number; name: string; hiddenCount: number }[] = [];
    for (const id of collapsed) {
      if (parentIds.has(id)) {
        const node = nodeMap.get(id);
        if (node) result.push({ id, name: `${node.firstName} ${node.lastName}`, hiddenCount: countDescendants(node) });
      }
    }
    return result;
  }, [activeTreeData, collapsed, collectParentIds]);

  const expandNode = useCallback((id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((id: number, name: string, parentId: number | null, siblingIndex: number) => {
    setDragState({ draggedId: id, draggedName: name, draggedParentId: parentId, draggedIndex: siblingIndex, dropTargetId: null, reorderTarget: null });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragState(prev => {
      if (prev.dropTargetId === targetId) return prev;
      return { ...prev, dropTargetId: targetId };
    });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragState(prev => {
      if (prev.dropTargetId === null) return prev;
      return { ...prev, dropTargetId: null };
    });
  }, []);

  const resetDragState = useCallback(() => {
    setDragState(prev => {
      if (
        prev.draggedId === null &&
        prev.draggedName === null &&
        prev.draggedParentId === null &&
        prev.draggedIndex === null &&
        prev.dropTargetId === null &&
        prev.reorderTarget === null
      ) {
        return prev;
      }
      return {
        draggedId: null,
        draggedName: null,
        draggedParentId: null,
        draggedIndex: null,
        dropTargetId: null,
        reorderTarget: null,
      };
    });
  }, []);

  const parentChildrenMap = useMemo(() => {
    const map = new Map<number | null, OrgChartNode[]>();
    if (!activeTreeData) return map;
    map.set(null, activeTreeData as OrgChartNode[]);
    const walk = (nodes: OrgChartNode[]) => {
      for (const n of nodes) {
        if (n.children?.length) {
          map.set(n.id, n.children);
          walk(n.children);
        }
      }
    };
    walk(activeTreeData as OrgChartNode[]);
    return map;
  }, [activeTreeData]);

  const childParentMap = useMemo(() => {
    const map = new Map<number, number | null>();
    if (!activeTreeData) return map;
    const walk = (nodes: OrgChartNode[], parent: number | null) => {
      for (const n of nodes) {
        map.set(n.id, parent);
        if (n.children?.length) walk(n.children, n.id);
      }
    };
    walk(activeTreeData as OrgChartNode[], null);
    return map;
  }, [activeTreeData]);

  const findNodeById = useCallback((id: number): OrgChartNode | null => {
    if (!activeTreeData) return null;
    const stack: OrgChartNode[] = [...(activeTreeData as OrgChartNode[])];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === id) return n;
      if (n.children?.length) stack.push(...n.children);
    }
    return null;
  }, [activeTreeData]);

  const getMoveHistoryState = useCallback((id: number) => {
    const treeNode = findNodeById(id);
    const employee = employees?.find((
      e: { id: number; managerId?: number | null; showInOrgChart?: boolean | null }
    ) => e.id === id);
    const employeeShowInOrgChart = employee?.showInOrgChart;

    return {
      managerId: treeNode?.managerId ?? employee?.managerId ?? null,
      showInOrgChart:
        typeof employeeShowInOrgChart === "boolean"
          ? employeeShowInOrgChart
          : treeNode
            ? true
            : false,
    };
  }, [employees, findNodeById]);

  const recordMoveHistory = useCallback((
    employeeId: number,
    nextManagerId: number | null,
    nextShowInOrgChart?: boolean,
  ) => {
    const previous = getMoveHistoryState(employeeId);
    const redoShowInOrgChart = nextShowInOrgChart ?? previous.showInOrgChart;
    if (
      previous.managerId === nextManagerId &&
      previous.showInOrgChart === redoShowInOrgChart
    ) {
      return;
    }

    showUndoToast({
      type: "move",
      message: t("orgChart.moveUndoMsg"),
      employeeId,
      undoManagerId: previous.managerId,
      redoManagerId: nextManagerId,
      undoShowInOrgChart: previous.showInOrgChart,
      redoShowInOrgChart,
    });
  }, [getMoveHistoryState, showUndoToast, t]);

  const focusOnNode = useCallback((id: number) => {
    requestAnimationFrame(() => {
      const container = containerRef.current;
      const nodeEl = nodeRefs.current.get(id);
      if (!container || !nodeEl) return;
      const cRect = container.getBoundingClientRect();
      const nRect = nodeEl.getBoundingClientRect();
      const dx = (cRect.left + cRect.width / 2) - (nRect.left + nRect.width / 2);
      const dy = (cRect.top + cRect.height / 2) - (nRect.top + nRect.height / 2);
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    });
  }, [setPan]);

  const focusEmployeeById = useCallback((id: number) => {
    const employee = employees?.find((item) => item.id === id);
    const isInActiveTree = activeTreeIdSet.has(id) && !!findNodeById(id);
    setHighlightedId(id);
    setOrgSearchQuery("");

    if (!isInActiveTree) {
      setIsTalentPoolOpen(true);
      setMoveToast(
        employee
          ? uiText(`${employeeDisplayName(employee)} is in the Talent Pool.`, `${employeeDisplayName(employee)} موجود في مجمع المواهب.`)
          : uiText("Employee is not visible in this chart.", "الموظف غير ظاهر في هذا الهيكل.")
      );
      window.setTimeout(() => setMoveToast(null), 2500);
      return;
    }

    setIsTalentPoolOpen(false);
    setViewMode("tree");
    setCollapsed((prev) => {
      const next = new Set(prev);
      let parent = childParentMap.get(id);
      while (parent != null) {
        next.delete(parent);
        parent = childParentMap.get(parent) ?? null;
      }
      return next;
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => focusOnNode(id));
    });
  }, [
    activeTreeIdSet,
    childParentMap,
    employees,
    findNodeById,
    focusOnNode,
    setViewMode,
    uiText,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      e.preventDefault();
      orgSearchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const fitToView = useCallback((options?: { padding?: number; maxZoom?: number; minZoom?: number }) => {
    requestAnimationFrame(() => {
      const c = containerRef.current;
      const content = chartContentRef.current;
      if (!c || !content) return;
      const cw = c.clientWidth;
      const ch = c.clientHeight;
      // chartContentRef measures only the currently-rendered (expanded) tree,
      // since collapsed subtrees aren't in the DOM.
      const contentW = content.scrollWidth;
      const contentH = content.scrollHeight;
      if (contentW <= 0 || contentH <= 0 || cw <= 0 || ch <= 0) return;
      const padding = options?.padding ?? 48;
      const maxZoom = options?.maxZoom ?? 1;
      const minZoom = options?.minZoom ?? 0.2;
      const availW = Math.max(cw - padding * 2, 1);
      const availH = Math.max(ch - padding * 2, 1);
      const zoomFit = Math.min(availW / contentW, availH / contentH);
      const newZoom = Math.max(Math.min(zoomFit, maxZoom), minZoom);
      // The outer scaled wrapper has p-12 (48px) padding which scales with it.
      // chartContent's top in screen coords = container.top + 48 * newZoom + panY.
      // Pick panY so the visible content is vertically centered in the container.
      const wrapperPaddingPx = 48;
      const scaledContentH = contentH * newZoom;
      const panY = (ch - scaledContentH) / 2 - wrapperPaddingPx * newZoom;
      setZoom(newZoom);
      setPan({ x: 0, y: panY });
    });
  }, [setZoom, setPan]);

  const enterPresentation = useCallback(async () => {
    if (selectedChartId === null) return;
    if (!activeTreeData || activeTreeData.length === 0) return;
    prevViewportRef.current = { zoom, pan };
    setPresentationMode(true);
    const root = (activeTreeData as OrgChartNode[])[0];
    setHighlightedId(root.id);
    setHintVisible(true);
    if (typeof document !== "undefined" && containerRef.current?.requestFullscreen) {
      try { await containerRef.current.requestFullscreen(); } catch { /* user denied or unavailable */ }
    }
    // Wait for fullscreen + layout to settle, then fit with generous padding
    // and a conservative max zoom so small charts don't get blown up.
    setTimeout(() => {
      requestAnimationFrame(() => {
        fitToView({ padding: 80, maxZoom: 1, minZoom: 0.2 });
      });
    }, 160);
  }, [selectedChartId, activeTreeData, zoom, pan, setPresentationMode, fitToView, setZoom, setPan]);

  const handlePrint = useCallback((orientation: "portrait" | "landscape") => {
    if (typeof window === "undefined") return;
    const body = document.body;

    // ---- Inject @page rules: orientation + localized "Page n / m" footer ----
    // Browsers don't allow conditional @page selectors, and the default
    // @page footer in index.css is English. Re-emit a stronger @page
    // rule here so the language and orientation can change at print time.
    const pageOf = t("orgChart.print.pageOf", { page: "__P__", total: "__T__" });
    // pageOf example: "Page __P__ of __T__" → split into prefix/mid/suffix
    const [pre, midRest = ""] = pageOf.split("__P__");
    const [mid, suf = ""] = midRest.split("__T__");
    const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const sizeRule = orientation === "landscape" ? "size: A4 landscape;" : "size: A4 portrait;";
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-print-runtime", "true");
    styleEl.textContent = `
      @page {
        ${sizeRule}
        margin: 14mm 12mm 16mm 12mm;
        @bottom-center {
          content: "${escape(pre)}" counter(page) "${escape(mid)}" counter(pages) "${escape(suf)}";
          font-family: var(--app-font-sans);
          font-size: 9pt;
          color: #555;
        }
      }
    `;
    document.head.appendChild(styleEl);

    body.classList.add("printing");

    // ---- JS-driven pagination pass ----
    // Walk each top-level [data-print-subtree]; if it overflows a page,
    // split its immediate child sibling row into chunks and emit per-chunk
    // continuation blocks with a repeated manager-of-page header.
    const restoreOps: Array<() => void> = [];
    const pageHeightPx = orientation === "portrait" ? 1009 : 680; // ~A4 usable, 96dpi
    const subtreeLabel = t("orgChart.print.subtreeLabel");
    const continuedLabel = t("orgChart.print.continued");
    const printArea = document.querySelector<HTMLElement>("[data-print-area]");
    if (printArea) {
      const subtrees = Array.from(printArea.querySelectorAll<HTMLElement>("[data-print-subtree]"));
      for (const sub of subtrees) {
        const orgRoot = sub.querySelector<HTMLElement>(".flex.flex-col.items-center");
        if (!orgRoot) continue;
        // Find the immediate child row directly under this OrgNode root
        const childRow = Array.from(orgRoot.children).find(
          (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("flex") && c.classList.contains("items-stretch"),
        );
        if (!childRow) continue;

        const subRect = sub.getBoundingClientRect();
        if (subRect.height <= pageHeightPx) continue;

        const children = Array.from(childRow.children).filter(
          (c): c is HTMLElement => c instanceof HTMLElement,
        );
        if (children.length <= 1) continue;

        // Resolve a friendly manager name from the root card
        const rootCard = orgRoot.querySelector<HTMLElement>("[data-testid^='card-employee-']");
        const rootName = rootCard?.querySelector("p")?.textContent?.trim() ?? "";

        // Number of pages required ≈ subtree height / page height; chunk
        // children evenly across continuation pages.
        const pages = Math.max(2, Math.ceil(subRect.height / pageHeightPx));
        const chunkSize = Math.max(1, Math.ceil(children.length / pages));
        if (chunkSize >= children.length) continue;

        const subParent = sub.parentNode;
        if (!subParent) continue;
        const subNext = sub.nextSibling;
        const insertedConts: HTMLElement[] = [];

        for (let start = chunkSize; start < children.length; start += chunkSize) {
          const chunk = children.slice(start, start + chunkSize);

          const cont = document.createElement("div");
          cont.setAttribute("data-print-continuation", "");

          const header = document.createElement("div");
          header.className = "print-only print-subtree-header";
          const labelSpan = document.createElement("span");
          labelSpan.className = "print-subtree-label";
          labelSpan.textContent = subtreeLabel + " ";
          const nameSpan = document.createElement("span");
          nameSpan.textContent = rootName ? `${rootName} ${continuedLabel}` : continuedLabel;
          header.appendChild(labelSpan);
          header.appendChild(nameSpan);
          cont.appendChild(header);

          const row = document.createElement("div");
          row.className = "flex items-stretch print-cont-row";
          for (const ch of chunk) {
            const origParent = ch.parentNode!;
            const origNext = ch.nextSibling;
            restoreOps.push(() => {
              if (origNext && origNext.parentNode === origParent) {
                origParent.insertBefore(ch, origNext);
              } else {
                origParent.appendChild(ch);
              }
            });
            row.appendChild(ch);
          }
          cont.appendChild(row);

          if (subNext && subNext.parentNode === subParent) {
            subParent.insertBefore(cont, subNext);
          } else {
            subParent.appendChild(cont);
          }
          insertedConts.push(cont);
        }

        for (const cont of insertedConts) {
          restoreOps.push(() => cont.remove());
        }
      }
    }

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      body.classList.remove("printing");
      if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      // Restore DOM mutations in reverse insertion order
      for (let i = restoreOps.length - 1; i >= 0; i--) {
        try { restoreOps[i](); } catch { /* ignore */ }
      }
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      try {
        window.print();
      } finally {
        setTimeout(cleanup, 1000);
      }
    }, 50);
  }, [t]);

  const exitPresentation = useCallback(() => {
    setPresentationMode(false);
    setHighlightedId(null);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignore */ });
    }
    if (prevViewportRef.current) {
      setZoom(prevViewportRef.current.zoom);
      setPan(prevViewportRef.current.pan);
      prevViewportRef.current = null;
    }
  }, [setPresentationMode, setZoom, setPan]);

  // Sync browser fullscreen exit with presentation mode
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => {
      if (!document.fullscreenElement && presentationMode) {
        exitPresentation();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [presentationMode, exitPresentation]);

  // Auto-hide hint after 3s; reappear on mouse move
  useEffect(() => {
    if (!presentationMode) return;
    const reset = () => {
      setHintVisible(true);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setHintVisible(false), 3000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    return () => {
      window.removeEventListener("mousemove", reset);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [presentationMode]);

  // Auto-focus on highlight change when follow mode is on
  useEffect(() => {
    if (!presentationMode || highlightedId === null || !followMode) return;
    focusOnNode(highlightedId);
  }, [highlightedId, presentationMode, followMode, focusOnNode]);

  // Global keyboard handler: P to toggle, plus arrow nav while in presentation mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "p" || e.key === "P")) {
        if (!presentationMode && selectedChartId === null) return;
        e.preventDefault();
        if (presentationMode) exitPresentation(); else void enterPresentation();
        return;
      }
      if (!presentationMode) return;
      if (e.key === "Escape") { e.preventDefault(); exitPresentation(); return; }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setFollowMode(v => !v); return; }
      if (highlightedId === null) return;
      const isRtl = i18n.dir() === "rtl";
      const goSibling = (delta: number) => {
        const parentId = childParentMap.get(highlightedId) ?? null;
        const sibs = parentChildrenMap.get(parentId);
        if (!sibs) return;
        const idx = sibs.findIndex(n => n.id === highlightedId);
        if (idx < 0) return;
        const next = sibs[idx + delta];
        if (next) setHighlightedId(next.id);
      };
      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault();
          const parent = childParentMap.get(highlightedId);
          if (parent != null) setHighlightedId(parent);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const node = findNodeById(highlightedId);
          if (node && node.children?.length) {
            if (collapsed.has(node.id)) {
              setCollapsed(prev => {
                const n = new Set(prev);
                n.delete(node.id);
                return n;
              });
            }
            setHighlightedId(node.children[0].id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          goSibling(isRtl ? 1 : -1);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          goSibling(isRtl ? -1 : 1);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          focusOnNode(highlightedId);
          break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    presentationMode,
    selectedChartId,
    enterPresentation,
    exitPresentation,
    highlightedId,
    childParentMap,
    parentChildrenMap,
    findNodeById,
    collapsed,
    focusOnNode,
    i18n,
  ]);

  const handleReorderOver = useCallback((parentId: number | null, index: number) => {
    setDragState(prev => {
      if (
        prev.reorderTarget?.parentId === parentId &&
        prev.reorderTarget?.index === index &&
        prev.dropTargetId === null
      ) return prev;
      return { ...prev, dropTargetId: null, reorderTarget: { parentId, index } };
    });
  }, []);

  const handleReorderLeave = useCallback(() => {
    setDragState(prev => prev.reorderTarget === null ? prev : { ...prev, reorderTarget: null });
  }, []);

  const handleReorderDrop = useCallback((parentId: number | null, index: number) => {
    const draggedId = dragState.draggedId;
    const draggedParentId = dragState.draggedParentId;
    const draggedIndex = dragState.draggedIndex;
    setDragState({ draggedId: null, draggedName: null, draggedParentId: null, draggedIndex: null, dropTargetId: null, reorderTarget: null });
    if (draggedId === null || draggedIndex === null) return;
    if (draggedParentId !== parentId) return;
    let newIndex = index;
    if (draggedIndex < index) newIndex = index - 1;
    if (newIndex === draggedIndex) return;
    reorderMutation.mutate({ id: draggedId, data: { newIndex } });
    showUndoToast({ type: "reorder", message: t("orgChart.reorderUndoMsg"), employeeId: draggedId, undoIndex: draggedIndex, redoIndex: newIndex });
  }, [dragState, reorderMutation, t, showUndoToast]);

  const handleSiblingKeyDown = useCallback((e: React.KeyboardEvent, id: number, parentId: number | null, siblingIndex: number) => {
    if (!e.altKey) return;
    const isLeft = e.key === "ArrowLeft";
    const isRight = e.key === "ArrowRight";
    if (!isLeft && !isRight) return;
    e.preventDefault();
    e.stopPropagation();
    const isRtl = i18n.dir() === "rtl";
    const direction = (isLeft ? -1 : 1) * (isRtl ? -1 : 1);
    const siblings = parentChildrenMap.get(parentId);
    if (!siblings) return;
    const newIdx = siblingIndex + direction;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    reorderMutation.mutate({ id, data: { newIndex: newIdx } });
    showUndoToast({ type: "reorder", message: t("orgChart.reorderUndoMsg"), employeeId: id, undoIndex: siblingIndex, redoIndex: newIdx });
  }, [parentChildrenMap, reorderMutation, t, showUndoToast, i18n]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData("text/plain");
    const isFromTalentPool = raw.startsWith("talent:");
    const draggedId = raw
      ? parseInt(raw.replace("talent:", ""), 10)
      : dragState.draggedId;
    if (draggedId && draggedId !== targetId) {
      const nextShowInOrgChart = isFromTalentPool ? true : undefined;
      recordMoveHistory(draggedId, targetId, nextShowInOrgChart);
      moveMutation.mutate({
        id: draggedId,
        data: {
          managerId: targetId,
          ...(nextShowInOrgChart !== undefined ? { showInOrgChart: nextShowInOrgChart } : {}),
        },
      });
    }
    setDragState({ draggedId: null, draggedName: null, draggedParentId: null, draggedIndex: null, dropTargetId: null, reorderTarget: null });
  }, [dragState.draggedId, moveMutation, recordMoveHistory]);

  const [isCanvasDropTarget, setIsCanvasDropTarget] = useState(false);

  const handleDragEnd = useCallback(() => {
    setIsCanvasDropTarget(false);
    resetDragState();
  }, [resetDragState]);

  useEffect(() => {
    if (dragState.draggedId === null) return;
    window.addEventListener("dragend", handleDragEnd);
    window.addEventListener("drop", handleDragEnd);
    return () => {
      window.removeEventListener("dragend", handleDragEnd);
      window.removeEventListener("drop", handleDragEnd);
    };
  }, [dragState.draggedId, handleDragEnd]);

  const handleAddTalentToChart = useCallback((employeeId: number, managerId: number | null = null) => {
    if (!employeeId) return;
    recordMoveHistory(employeeId, managerId, true);
    moveMutation.mutate({
      id: employeeId,
      data: { managerId, showInOrgChart: true },
    });
  }, [moveMutation, recordMoveHistory]);

  const handleDropOnCanvas = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCanvasDropTarget(false);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw.startsWith("talent:")) return;
    const draggedId = parseInt(raw.replace("talent:", ""), 10);
    if (draggedId) {
      handleAddTalentToChart(draggedId);
    }
    setDragState({ draggedId: null, draggedName: null, draggedParentId: null, draggedIndex: null, dropTargetId: null, reorderTarget: null });
  }, [handleAddTalentToChart]);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-talent-pool")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsCanvasDropTarget(prev => prev ? prev : true);
  }, []);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsCanvasDropTarget(false);
    }
  }, []);

  const handleNodeClick = useCallback((node: OrgChartNode) => {
    setSelectedNode(node);
  }, []);

  const openEditDialog = useCallback((node: OrgChartNode) => {
    const fullEmployee = employees?.find(e => e.id === node.id);
    setSelectedNode(node);
    setEditForm({
      firstName: node.firstName,
      lastName: node.lastName,
      title: node.title,
      email: node.email,
      phone: fullEmployee?.phone || "",
      location: fullEmployee?.location || "",
      nationality: fullEmployee?.nationality || node.nationality || "",
      administrationId: fullEmployee?.administrationId ?? null,
      departmentId: node.departmentId,
      managerId: node.managerId,
      jobDescription: fullEmployee?.jobDescription || "",
    });
    setIsEditOpen(true);
  }, [employees]);

  const openOpenPositionDialogForNode = useCallback((node: OrgChartNode) => {
    setOpenPosForm({
      title: "",
      administrationId: node.administrationId,
      departmentId: node.departmentId,
      managerId: node.id,
      jobDescription: "",
    });
    setSelectedNode(null);
    setIsOpenPosDialogOpen(true);
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (!selectedNode || !selectedOrgId) return;
    const wasOpenPosition = !!selectedNode.isOpenPosition;
    updateMutation.mutate({
      orgId: selectedOrgId,
      id: selectedNode.id,
      data: {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        title: editForm.title,
        email: editForm.email,
        phone: editForm.phone || null,
        location: editForm.location || null,
        nationality: editForm.nationality || null,
        administrationId: editForm.administrationId || null,
        departmentId: editForm.departmentId || null,
        managerId: editForm.managerId || null,
        jobDescription: editForm.jobDescription ?? "",
        ...(wasOpenPosition ? { isOpenPosition: false } : {}),
      },
    });
  }, [selectedNode, selectedOrgId, editForm, updateMutation]);

  const handleRemoveFromChart = useCallback((id: number) => {
    recordMoveHistory(id, null);
    moveMutation.mutate({
      id,
      data: { managerId: null },
    });
    setSelectedNode(null);
  }, [moveMutation, recordMoveHistory]);

  const findNodeInTree = useCallback((id: number): OrgChartNode | null => {
    if (!activeTreeData) return null;
    const stack: OrgChartNode[] = [...(activeTreeData as OrgChartNode[])];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === id) return n;
      if (n.children) stack.push(...n.children);
    }
    return null;
  }, [activeTreeData]);

  // Deep-linking from the global Cmd+K palette: if ?focusEmployee=<id> is
  // present, or a `palette:focus-employee` event fires, select that employee
  // and scroll their card into view. Pending requests are buffered until the
  // tree is loaded and the matching node DOM ref is registered.
  const pendingFocusRef = useRef<number | null>(null);
  const focusEmployee = useCallback(
    (id: number) => {
      const node = findNodeInTree(id);
      if (!node) {
        pendingFocusRef.current = id;
        return;
      }
      setSelectedNode(node);
      const el = nodeRefs.current.get(id);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
      pendingFocusRef.current = null;
    },
    [findNodeInTree],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("focusEmployee");
    if (raw) {
      const id = parseInt(raw, 10);
      if (!Number.isNaN(id)) pendingFocusRef.current = id;
      params.delete("focusEmployee");
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", newUrl);
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: number }>).detail;
      if (detail && typeof detail.id === "number") focusEmployee(detail.id);
    };
    window.addEventListener("orgchart:palette:focus-employee", handler);
    return () => window.removeEventListener("orgchart:palette:focus-employee", handler);
  }, [focusEmployee]);

  // Palette deep-links for charts and saved filter views. Charts switch the
  // active scope; saved views additionally restore the user's stored filter
  // selections for that scope. We rely on the existing selectChart() and
  // applyFilter() handlers so storage and URL state stay in sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ scope: number | "full" }>).detail;
      if (!detail) return;
      const scope = detail.scope;
      if (scope === "full" || typeof scope === "number") {
        selectChart(scope);
      }
      return;
    };
    window.addEventListener("orgchart:palette:select-chart", handler);
    return () => window.removeEventListener("orgchart:palette:select-chart", handler);
  }, [selectChart]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{
        chartScope: string;
        departmentIds: number[];
        administrationIds: number[];
      }>).detail;
      if (!detail) return;
      // chartScope is stored as a string ("full" or a numeric chart id).
      if (detail.chartScope === "full") {
        selectChart("full");
      } else {
        const parsed = parseInt(detail.chartScope, 10);
        if (!Number.isNaN(parsed)) selectChart(parsed);
      }
      applyFilter({
        departmentIds: detail.departmentIds ?? [],
        administrationIds: detail.administrationIds ?? [],
        nationalities: [],
        titles: [],
        tagIds: [],
        tagsMode: "any",
      });
    };
    window.addEventListener("orgchart:palette:apply-saved-view", handler);
    return () => window.removeEventListener("orgchart:palette:apply-saved-view", handler);
  }, [selectChart, applyFilter]);

  // Drain any pending focus once the tree is available.
  useEffect(() => {
    if (pendingFocusRef.current !== null && activeTreeData) {
      const id = pendingFocusRef.current;
      // Defer one frame so node refs have a chance to register.
      const handle = window.setTimeout(() => focusEmployee(id), 0);
      return () => window.clearTimeout(handle);
    }
    return undefined;
  }, [activeTreeData, focusEmployee]);

  const collectAllDescendantIds = useCallback((node: OrgChartNode): number[] => {
    const ids: number[] = [];
    const walk = (children: OrgChartNode[]) => {
      for (const c of children) {
        ids.push(c.id);
        if (c.children?.length) walk(c.children);
      }
    };
    if (node.children?.length) walk(node.children);
    return ids;
  }, []);

  const [returnDialog, setReturnDialog] = useState<{
    node: OrgChartNode;
    childCount: number;
  } | null>(null);
  const [isApplyingReturn, setIsApplyingReturn] = useState(false);

  const applyReturnToPool = useCallback(
    async (id: number, strategy: ReturnStrategy | "none") => {
      const node = findNodeInTree(id);
      if (!node) return;
      recordMoveHistory(node.id, null, false);
      setIsApplyingReturn(true);
      try {
        if (strategy === "reassign" && node.children?.length) {
          const newManagerId = node.managerId;
          for (const child of node.children) {
            await moveMutation.mutateAsync({
              id: child.id,
              data: { managerId: newManagerId },
            });
          }
        } else if (strategy === "promote" && node.children?.length) {
          for (const child of node.children) {
            await moveMutation.mutateAsync({
              id: child.id,
              data: { managerId: null },
            });
          }
        } else if (strategy === "returnAll" && node.children?.length) {
          const descendantIds = collectAllDescendantIds(node);
          for (const descId of descendantIds) {
            await moveMutation.mutateAsync({
              id: descId,
              data: { managerId: null, showInOrgChart: false },
            });
          }
        }
        await moveMutation.mutateAsync({
          id: node.id,
          data: { managerId: null, showInOrgChart: false },
        });
        setMoveToast(t("orgChart.employeeReturnedToPool"));
        setTimeout(() => setMoveToast(null), 3000);
      } finally {
        setIsApplyingReturn(false);
        setReturnDialog(null);
      }
    },
    [findNodeInTree, collectAllDescendantIds, moveMutation, recordMoveHistory, t]
  );

  const handleReturnToPool = useCallback(
    (id: number) => {
      const node = findNodeInTree(id);
      if (!node) return;
      const childCount = node.children?.length ?? 0;
      if (childCount > 0) {
        setReturnDialog({ node, childCount });
      } else {
        applyReturnToPool(id, "none");
      }
    },
    [findNodeInTree, applyReturnToPool]
  );

  const [isTalentPoolButtonDropTarget, setIsTalentPoolButtonDropTarget] = useState(false);
  const talentPoolButtonOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (talentPoolButtonOpenTimerRef.current) {
        clearTimeout(talentPoolButtonOpenTimerRef.current);
      }
    };
  }, []);

  const isChartDragActive = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-org-chart")) return true;
    return dragState.draggedId !== null;
  }, [dragState.draggedId]);

  const handleTalentPoolButtonDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isChartDragActive(e)) return;
      e.preventDefault();
      setIsTalentPoolButtonDropTarget(true);
      if (!isTalentPoolOpen && !talentPoolButtonOpenTimerRef.current) {
        talentPoolButtonOpenTimerRef.current = setTimeout(() => {
          setIsTalentPoolOpen(true);
          talentPoolButtonOpenTimerRef.current = null;
        }, 150);
      }
    },
    [isChartDragActive, isTalentPoolOpen]
  );

  const handleTalentPoolButtonDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isChartDragActive(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isTalentPoolButtonDropTarget) {
        setIsTalentPoolButtonDropTarget(true);
      }
      if (!isTalentPoolOpen && !talentPoolButtonOpenTimerRef.current) {
        talentPoolButtonOpenTimerRef.current = setTimeout(() => {
          setIsTalentPoolOpen(true);
          talentPoolButtonOpenTimerRef.current = null;
        }, 150);
      }
    },
    [isChartDragActive, isTalentPoolOpen, isTalentPoolButtonDropTarget]
  );

  const handleTalentPoolButtonDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsTalentPoolButtonDropTarget(false);
    if (talentPoolButtonOpenTimerRef.current) {
      clearTimeout(talentPoolButtonOpenTimerRef.current);
      talentPoolButtonOpenTimerRef.current = null;
    }
  }, []);

  const handleTalentPoolButtonDrop = useCallback(
    (e: React.DragEvent) => {
      const raw = e.dataTransfer.getData("text/plain");
      const looksLikeChartCard = raw && !raw.startsWith("talent:");
      if (!isChartDragActive(e) && !looksLikeChartCard) return;
      e.preventDefault();
      e.stopPropagation();
      setIsTalentPoolButtonDropTarget(false);
      if (talentPoolButtonOpenTimerRef.current) {
        clearTimeout(talentPoolButtonOpenTimerRef.current);
        talentPoolButtonOpenTimerRef.current = null;
      }
      setIsTalentPoolOpen(true);
      const draggedId = raw
        ? parseInt(raw.replace("talent:", ""), 10)
        : dragState.draggedId;
      setDragState({ draggedId: null, draggedName: null, draggedParentId: null, draggedIndex: null, dropTargetId: null, reorderTarget: null });
      if (draggedId && !Number.isNaN(draggedId)) {
        handleReturnToPool(draggedId);
      }
    },
    [isChartDragActive, dragState.draggedId, handleReturnToPool]
  );

  const handleMakeRoot = useCallback((id: number) => {
    recordMoveHistory(id, null);
    moveMutation.mutate({
      id,
      data: { managerId: null },
    });
    setSelectedNode(null);
  }, [moveMutation, recordMoveHistory]);

  const selectedChart = typeof selectedChartId === "number" ? charts?.find(c => c.id === selectedChartId) : undefined;
  const isStructureSelected = selectedChartId !== null;
  const chartTypeIcon = (type: string) => {
    if (type === "department") return <Building2 className="h-4 w-4" />;
    if (type === "management") return <Network className="h-4 w-4" />;
    return <Briefcase className="h-4 w-4" />;
  };

  // Export hook
  const {
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
  } = useOrgChartExport({
    t,
    chartContentRef,
    nodeRefs,
    activeTreeData: activeTreeData as OrgChartNode[] | undefined,
    collapsed,
    setCollapsed,
    zoom,
    connectorStyle,
    organization,
    selectedChartName: selectedChart?.name ?? null,
    branchSummaryNode,
    branchSummaryStats,
    isFilterActive,
  });

  const [activeChartViewId, setActiveChartViewId] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem("orgchart_active_view_id");
      if (!raw) return null;
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? null : n;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (activeChartViewId == null) localStorage.removeItem("orgchart_active_view_id");
      else localStorage.setItem("orgchart_active_view_id", String(activeChartViewId));
    } catch {
      // storage unavailable
    }
  }, [activeChartViewId]);

  const [pendingRestore, setPendingRestore] = useState<{
    payload: ChartViewPayload;
    targetScope: number | "full";
    viewId: number;
  } | null>(null);

  const captureChartViewPayload = useCallback((): ChartViewPayload => {
    return {
      chartScope: selectedChartId,
      filter: {
        departmentIds: [...filter.departmentIds],
        administrationIds: [...filter.administrationIds],
        nationalities: [...filter.nationalities],
        titles: [...filter.titles],
        tagIds: [...filter.tagIds],
        tagsMode: filter.tagsMode,
      },
      connectorStyle,
      zoom,
      pan: { x: pan.x, y: pan.y },
      focusedEmployeeId: selectedNode?.id ?? null,
      collapsed: Array.from(collapsed),
    };
  }, [selectedChartId, filter, connectorStyle, zoom, pan, selectedNode, collapsed]);

  const applyPayloadCore = useCallback((payload: ChartViewPayload) => {
    if (payload.filter) {
      applyFilter({
        departmentIds: Array.isArray(payload.filter.departmentIds) ? payload.filter.departmentIds : [],
        administrationIds: Array.isArray(payload.filter.administrationIds) ? payload.filter.administrationIds : [],
        nationalities: Array.isArray(payload.filter.nationalities) ? payload.filter.nationalities : [],
        titles: Array.isArray(payload.filter.titles) ? payload.filter.titles : [],
        tagIds: Array.isArray(payload.filter.tagIds) ? payload.filter.tagIds : [],
        tagsMode: payload.filter.tagsMode === "all" ? "all" : "any",
      });
    }
    if (payload.connectorStyle && isConnectorStyle(payload.connectorStyle)) {
      setConnectorStyle(payload.connectorStyle);
    }
    if (typeof payload.zoom === "number") {
      setZoom(Math.min(2, Math.max(0.2, payload.zoom)));
    }
    if (payload.pan && typeof payload.pan.x === "number" && typeof payload.pan.y === "number") {
      setPan({ x: payload.pan.x, y: payload.pan.y });
    }
    if (Array.isArray(payload.collapsed)) {
      setCollapsed(new Set(payload.collapsed.filter((n): n is number => typeof n === "number")));
    }
    if (typeof payload.focusedEmployeeId === "number") {
      const targetId = payload.focusedEmployeeId;
      let attempts = 0;
      const tryScroll = () => {
        const el = nodeRefs.current.get(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          return;
        }
        if (attempts++ < 20) requestAnimationFrame(tryScroll);
      };
      requestAnimationFrame(tryScroll);
    }
  }, [applyFilter, setConnectorStyle, setZoom, setPan, setCollapsed]);

  const applyChartViewPayload = useCallback((viewId: number, payload: ChartViewPayload) => {
    setActiveChartViewId(viewId);
    const targetScope =
      payload.chartScope === "full" || typeof payload.chartScope === "number"
        ? payload.chartScope
        : null;
    if (targetScope !== null && targetScope !== selectedChartId) {
      // Stage restore: switch chart first, apply state once new chart's data + nodes are ready.
      setPendingRestore({ payload, targetScope, viewId });
      selectChart(targetScope);
      return;
    }
    applyPayloadCore(payload);
  }, [selectedChartId, selectChart, applyPayloadCore]);

  // Apply a deferred chart-view restore once the target chart's data has loaded.
  useEffect(() => {
    if (!pendingRestore) return;
    if (pendingRestore.targetScope !== selectedChartId) return;
    if (activeLoading) return;
    if (!activeTreeData) return;
    applyPayloadCore(pendingRestore.payload);
    setPendingRestore(null);
  }, [pendingRestore, selectedChartId, activeLoading, activeTreeData, applyPayloadCore]);

  // Deep-link: open a saved chart view directly via ?view=<id>
  const [pendingUrlViewId, setPendingUrlViewId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("view");
      if (!raw) return null;
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? null : n;
    } catch {
      return null;
    }
  });

  const stripViewParamFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("view")) return;
      url.searchParams.delete("view");
      const search = url.searchParams.toString();
      const next = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
      window.history.replaceState({}, "", next);
    } catch {
      // ignore
    }
  }, []);

  const { data: deepLinkViews, isFetched: deepLinkViewsFetched } = useListChartViews(
    selectedOrgId ?? 0,
    {
      query: {
        enabled: !!selectedOrgId && pendingUrlViewId !== null,
        queryKey: getListChartViewsQueryKey(selectedOrgId ?? 0),
      },
    }
  );

  useEffect(() => {
    if (pendingUrlViewId === null) return;
    if (!selectedOrgId) return;
    if (!deepLinkViewsFetched) return;
    const view = (deepLinkViews ?? []).find((v) => v.id === pendingUrlViewId);
    if (!view) {
      setChartToast(t("orgChart.chartViews.sharedLinkNotFound"));
      setTimeout(() => setChartToast(null), 4000);
      setPendingUrlViewId(null);
      stripViewParamFromUrl();
      return;
    }
    applyChartViewPayload(view.id, (view.payload ?? {}) as ChartViewPayload);
    setChartToast(t("orgChart.chartViews.sharedLinkApplied"));
    setTimeout(() => setChartToast(null), 3000);
    setPendingUrlViewId(null);
    stripViewParamFromUrl();
  }, [
    pendingUrlViewId,
    selectedOrgId,
    deepLinkViews,
    deepLinkViewsFetched,
    applyChartViewPayload,
    stripViewParamFromUrl,
    t,
  ]);

  // Persist collapsed nodes per chart (skip while exporting to avoid clobbering snapshot)
  useEffect(() => {
    if (!selectedOrgId || selectedChartId === null || isExporting) return;
    const timer = setTimeout(() => {
      try {
        const key = getCollapsedKey(selectedOrgId, selectedChartId);
        localStorage.setItem(key, JSON.stringify(Array.from(collapsed)));
      } catch {
        // storage unavailable
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [collapsed, selectedOrgId, selectedChartId, getCollapsedKey, isExporting]);

  // Secondary-managers overlay
  const { overlaySegments, overlaySize } = useSecondaryOverlay({
    chartContentRef,
    nodeRefs,
    secondaryPairs,
    activeTreeData: activeTreeData as OrgChartNode[] | undefined,
    collapsed,
    zoom,
    pan,
  });

  const dataQualityTone =
    dataQuality.criticalCount > 0
      ? "border-red-200 bg-red-50 text-red-700"
      : dataQuality.warningCount > 0
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const issueSeverityClass = (severity: DataQualitySeverity) => {
    if (severity === "critical") return "border-red-200 bg-red-50 text-red-800";
    if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
    return "border-blue-200 bg-blue-50 text-blue-800";
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${presentationMode ? "bg-background" : ""}`}>
      <div className={`p-4 sm:p-6 pb-0 flex flex-col gap-3 ${presentationMode ? "hidden" : ""}`}>
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{t("orgChart.title")}</h1>
              {isStructureSelected && orgTotalCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-muted text-foreground"
                      data-testid="badge-org-total-headcount"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{t("orgChart.orgTotalCount", { count: orgTotalCount })}</span>
                      {orgOpenCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          · {t("orgChart.orgOpenCount", { count: orgOpenCount })}
                        </span>
                      )}
                      {orgLongestVacancy && (
                        <span
                          className="text-amber-600 dark:text-amber-400"
                          data-testid="badge-org-longest-vacancy"
                        >
                          · {t("orgChart.orgLongestVacancy", { count: orgLongestVacancy.days })}
                        </span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div>
                      {isFilterActive
                        ? t("orgChart.orgTotalTooltipFiltered")
                        : t("orgChart.orgTotalTooltip")}
                    </div>
                    {orgLongestVacancy && (
                      <div className="mt-1 text-xs">
                        {t("orgChart.orgLongestVacancyTooltip", {
                          name:
                            orgLongestVacancy.title ||
                            orgLongestVacancy.name ||
                            t("orgChart.branchSummaryVacancyUntitled"),
                          count: orgLongestVacancy.days,
                        })}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t("orgChart.subtitle")}
            </p>
          </div>
          {(() => {
          const toolbarButtons = (
            <>
            {!isMobile && (
              <div
                className="inline-flex items-center rounded-md border border-input bg-background p-0.5 me-1"
                role="group"
                aria-label={t("orgChart.viewMode.label")}
                data-testid="view-mode-toggle"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={viewMode === "tree" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewMode("tree")}
                      data-testid="view-mode-tree"
                      aria-pressed={viewMode === "tree"}
                    >
                      <Network className="h-4 w-4 me-1" />
                      <span className="hidden lg:inline">{t("orgChart.viewMode.tree")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("orgChart.viewMode.tooltipTree")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={viewMode === "table" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewMode("table")}
                      data-testid="view-mode-table"
                      aria-pressed={viewMode === "table"}
                    >
                      <TableIcon className="h-4 w-4 me-1" />
                      <span className="hidden lg:inline">{t("orgChart.viewMode.table")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("orgChart.viewMode.tooltipTable")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewMode("grid")}
                      data-testid="view-mode-grid"
                      aria-pressed={viewMode === "grid"}
                    >
                      <LayoutGrid className="h-4 w-4 me-1" />
                      <span className="hidden lg:inline">{t("orgChart.viewMode.grid")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("orgChart.viewMode.tooltipGrid")}</TooltipContent>
                </Tooltip>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(zoom + 0.2, 2))} data-testid="button-zoom-in" disabled={viewMode !== "tree"}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.zoomIn")}</TooltipContent>
            </Tooltip>
            <span
              className="text-sm text-muted-foreground w-12 text-center"
              data-testid="text-zoom-percent"
            >{Math.round(zoom * 100)}%</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(zoom - 0.2, 0.2))} data-testid="button-zoom-out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.zoomOut")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={resetView} data-testid="button-reset-view">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.resetView")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0 || moveMutation.isPending || reorderMutation.isPending}
                  data-testid="button-undo-history"
                  aria-label={t("orgChart.undoAction")}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("orgChart.undoTooltip", { shortcut: isMacLike ? "⌘Z" : "Ctrl+Z" })}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0 || moveMutation.isPending || reorderMutation.isPending}
                  data-testid="button-redo-history"
                  aria-label={t("orgChart.redoAction")}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("orgChart.redoTooltip", { shortcut: isMacLike ? "⌘Y" : "Ctrl+Y" })}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={openShortcuts} data-testid="button-help-shortcuts" aria-label={t("shortcuts.openButton")}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("shortcuts.openTooltip")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void enterPresentation()}
                  disabled={!isStructureSelected || !activeTreeData || activeTreeData.length === 0}
                  data-testid="button-presentation-mode"
                  aria-label={t("orgChart.presentation.enter")}
                >
                  <Presentation className="h-4 w-4 me-1" />
                  {t("orgChart.presentation.enter")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("orgChart.presentation.tooltip")}</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-border" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expandAll}
                  disabled={!isStructureSelected || !activeTreeData || activeTreeData.length === 0}
                  data-testid="button-expand-all"
                  className="relative"
                >
                  <ChevronDown className="h-4 w-4 me-1" />
                  {t("orgChart.expandAll")}
                  <AnimatePresence mode="popLayout">
                    {collapsedCount > 0 && (
                      <Popover
                        open={badgePopoverOpen}
                        onOpenChange={(open) => {
                          setBadgePopoverOpen(open);
                          if (!open) {
                            setCollapsedSearchQuery("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <motion.span
                            key={collapsedCount}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20, duration: 0.2 }}
                            className="ms-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none cursor-pointer hover:bg-primary/80 transition-colors"
                            data-testid="collapsed-count-badge"
                            aria-label={t("tooltips.collapsedCount", { count: collapsedCount })}
                            onClick={(e) => {
                              e.stopPropagation();
                              setBadgePopoverOpen(true);
                            }}
                          >
                            {collapsedCount}
                          </motion.span>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-64 p-0"
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                          onOpenAutoFocus={(e) => {
                            e.preventDefault();
                            collapsedSearchInputRef.current?.focus();
                          }}
                          data-testid="collapsed-nodes-popover"
                        >
                          <div className="px-3 py-2 border-b">
                            <p className="text-sm font-semibold">{t("orgChart.collapsedBranches")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("tooltips.collapsedCount", { count: collapsedCount })}
                            </p>
                          </div>
                          <div className="px-2 py-2 border-b">
                            <div className="relative">
                              <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                              <Input
                                ref={collapsedSearchInputRef}
                                value={collapsedSearchQuery}
                                onChange={(e) => setCollapsedSearchQuery(e.target.value)}
                                placeholder={t("orgChart.searchCollapsedBranches")}
                                className="h-8 ps-7 text-sm"
                                data-testid="input-search-collapsed-branches"
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {(() => {
                              const q = collapsedSearchQuery.trim().toLowerCase();
                              const filtered = q
                                ? collapsedNodesList.filter(({ name }) =>
                                    name.toLowerCase().includes(q)
                                  )
                                : collapsedNodesList;
                              if (filtered.length === 0) {
                                return (
                                  <div
                                    className="px-3 py-4 text-xs text-muted-foreground text-center"
                                    data-testid="text-no-collapsed-branches-found"
                                  >
                                    {t("orgChart.noCollapsedBranchesFound")}
                                  </div>
                                );
                              }
                              return filtered.map(({ id, name, hiddenCount }) => (
                                <div
                                  key={id}
                                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-sm"
                                >
                                  <span className="truncate min-w-0 flex-1">
                                    <span className="truncate">{name}</span>
                                    <span
                                      className="text-xs text-muted-foreground ms-2"
                                      data-testid={`hidden-count-${id}`}
                                    >
                                      {t("orgChart.hiddenCount", { count: hiddenCount })}
                                    </span>
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs ms-2 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      expandNode(id);
                                    }}
                                    data-testid={`expand-node-${id}`}
                                  >
                                    {t("orgChart.expandNode")}
                                  </Button>
                                </div>
                              ));
                            })()}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </AnimatePresence>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {collapsedCount > 0
                  ? `${t("tooltips.expandAll")} · ${t("tooltips.collapsedCount", { count: collapsedCount })}`
                  : t("tooltips.expandAll")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={collapseAll}
                  disabled={!isStructureSelected || !activeTreeData || activeTreeData.length === 0}
                  data-testid="button-collapse-all"
                >
                  <ChevronRight className="h-4 w-4 me-1" />
                  {t("orgChart.collapseAll")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.collapseAll")}</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-border" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpenPosForm({ title: "", administrationId: null, departmentId: null, managerId: null, jobDescription: "" });
                    setIsOpenPosDialogOpen(true);
                  }}
                  data-testid="button-add-open-position"
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t("orgChart.openPositions.addOpenPosition")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("orgChart.openPositions.addOpenPositionTooltip")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={animationsEnabled ? "outline" : "secondary"}
                  size="sm"
                  onClick={toggleAnimations}
                  data-testid="button-toggle-animations"
                  aria-pressed={animationsEnabled}
                >
                  <Zap className={`h-4 w-4 me-1 ${animationsEnabled ? "" : "opacity-50"}`} />
                  {animationsEnabled ? t("orgChart.animationsOn") : t("orgChart.animationsOff")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {animationsEnabled ? t("tooltips.toggleAnimationsOn") : t("tooltips.toggleAnimationsOff")}
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="button-connector-style"
                      aria-label={t("tooltips.connectorStyle")}
                    >
                      {connectorStyle === "curved" ? (
                        <Spline className="h-4 w-4 me-1" />
                      ) : connectorStyle === "straight" ? (
                        <MoveDownRight className="h-4 w-4 me-1" />
                      ) : (
                        <CornerDownRight className="h-4 w-4 me-1" />
                      )}
                      {t(`orgChart.connectorStyle_${connectorStyle}`)}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("tooltips.connectorStyle")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setConnectorStyle("straight")}
                  data-testid="connector-style-straight"
                >
                  <MoveDownRight className="h-4 w-4 me-2" />
                  {t("orgChart.connectorStyle_straight")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setConnectorStyle("angled")}
                  data-testid="connector-style-angled"
                >
                  <CornerDownRight className="h-4 w-4 me-2" />
                  {t("orgChart.connectorStyle_angled")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setConnectorStyle("curved")}
                  data-testid="connector-style-curved"
                >
                  <Spline className="h-4 w-4 me-2" />
                  {t("orgChart.connectorStyle_curved")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-border" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isTalentPoolOpen ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsTalentPoolOpen((v) => !v)}
                  data-testid="button-talent-pool"
                  aria-pressed={isTalentPoolButtonDropTarget}
                  className={`${isTalentPoolOpen ? "bg-purple-600 hover:bg-purple-700 text-white" : ""} ${
                    isTalentPoolButtonDropTarget
                      ? "ring-2 ring-purple-500 ring-offset-1 border-purple-500"
                      : ""
                  }`}
                  onDragEnter={handleTalentPoolButtonDragEnter}
                  onDragOver={handleTalentPoolButtonDragOver}
                  onDragLeave={handleTalentPoolButtonDragLeave}
                  onDrop={handleTalentPoolButtonDrop}
                >
                  <Users className="h-4 w-4 me-1" />
                  {t("orgChart.talentPool")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("orgChart.talentPoolTooltip")}</TooltipContent>
            </Tooltip>

            {hasPermission("snapshots", "create") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSnapshotDialogOpen(true)}
                    data-testid="button-save-snapshot"
                  >
                    <Camera className="h-4 w-4 me-1" />
                    {t("snapshots.save")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("snapshots.saveOnChartTooltip")}</TooltipContent>
              </Tooltip>
            )}

            {hasPermission("snapshots", "view") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/snapshots")}
                    data-testid="button-chart-versions"
                  >
                    <History className="h-4 w-4 me-1" />
                    {t("snapshots.openVersions")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("snapshots.openVersionsTooltip")}</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isStructureSelected || !activeTreeData || activeTreeData.length === 0}
                      data-testid="button-print"
                    >
                      <Printer className="h-4 w-4 me-1" />
                      {t("orgChart.print.button")}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("orgChart.print.tooltip")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handlePrint("portrait")}
                  data-testid="print-portrait"
                >
                  <Printer className="h-4 w-4 me-2" />
                  {t("orgChart.print.portrait")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handlePrint("landscape")}
                  data-testid="print-landscape"
                >
                  <Printer className="h-4 w-4 me-2" />
                  {t("orgChart.print.landscape")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting || !isStructureSelected} data-testid="button-export">
                      <Download className="h-4 w-4 me-1" />
                      {isExporting ? t("orgChart.exporting") : t("orgChart.export")}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("tooltips.export")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setExportOptions((o) => ({ ...o, format: "png" }));
                    setExportError(null);
                    setIsExportDialogOpen(true);
                  }}
                  data-testid="export-png"
                >
                  <FileImage className="h-4 w-4 me-2" />
                  {t("orgChart.exportPNG")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setExportOptions((o) => ({ ...o, format: "jpeg" }));
                    setExportError(null);
                    setIsExportDialogOpen(true);
                  }}
                  data-testid="export-jpeg"
                >
                  <FileImage className="h-4 w-4 me-2" />
                  {t("orgChart.exportJPEG")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setExportOptions((o) => ({ ...o, format: "pdf" }));
                    setExportError(null);
                    setIsExportDialogOpen(true);
                  }}
                  data-testid="export-pdf"
                >
                  <FileText className="h-4 w-4 me-2" />
                  {t("orgChart.exportPDF")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setExportOptions((o) => ({ ...o, format: "svg" }));
                    setExportError(null);
                    setIsExportDialogOpen(true);
                  }}
                  data-testid="export-svg"
                >
                  <FileCode2 className="h-4 w-4 me-2" />
                  {t("orgChart.exportSVG")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsExcel} data-testid="export-excel">
                  <FileSpreadsheet className="h-4 w-4 me-2" />
                  {t("orgChart.exportExcel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ChartViewsMenu
              orgId={selectedOrgId ?? null}
              canShare={hasPermission("organizations", "edit")}
              capturePayload={captureChartViewPayload}
              onApply={(view, payload) => applyChartViewPayload(view.id, payload)}
              activeViewId={activeChartViewId}
              onClearActive={() => setActiveChartViewId(null)}
            />

            {hasPermission("organizations", "edit") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShareForm({ password: "", expiresAt: "" });
                      setCreatedShareUrl("");
                      setShareError("");
                      setIsShareDialogOpen(true);
                    }}
                    data-testid="button-share"
                  >
                    <Share2 className="h-4 w-4 me-1" />
                    {t("orgChart.share.button")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("orgChart.share.tooltip")}</TooltipContent>
              </Tooltip>
            )}
            </>
          );
          return isMobile ? (
            <Sheet open={isMobileToolsOpen} onOpenChange={setIsMobileToolsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[44px]" data-testid="button-mobile-tools">
                  <Settings2 className="h-4 w-4 me-1" />
                  {t("orgChart.mobileTools")}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto" data-testid="sheet-mobile-tools">
                <SheetHeader>
                  <SheetTitle>{t("orgChart.mobileToolsTitle")}</SheetTitle>
                </SheetHeader>
                <div className="mt-4 mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t("orgChart.mobileViewToggle")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={mobileViewMode === "tree" ? "default" : "outline"}
                      onClick={() => setMobileViewMode("tree")}
                      className="min-h-[44px]"
                      data-testid="button-mobile-view-tree"
                    >
                      {t("orgChart.mobileTreeView")}
                    </Button>
                    <Button
                      type="button"
                      variant={mobileViewMode === "graph" ? "default" : "outline"}
                      onClick={() => setMobileViewMode("graph")}
                      className="min-h-[44px]"
                      data-testid="button-mobile-view-graph"
                    >
                      {t("orgChart.mobileGraphView")}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pb-6 border-t border-border pt-3 [&_button]:min-h-[44px] [&_[role=combobox]]:min-h-[44px]">
                  {toolbarButtons}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {toolbarButtons}
            </div>
          );
          })()}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedChartId === null ? undefined : selectedChartId === "full" ? "full-company" : String(selectedChartId)}
            onValueChange={(val) => selectChart(val === "full-company" ? "full" : Number(val))}
          >
            <SelectTrigger
              className={`w-[220px] h-9 ${selectedChartId === null ? "ring-2 ring-primary/60 border-primary" : ""}`}
              data-testid="select-chart-view"
            >
              <div className="flex items-center gap-1.5">
                {selectedChartId === null ? (
                  <span className="text-muted-foreground">{t("orgChart.selectStructure")}</span>
                ) : selectedChartId === "full" ? (
                  <>
                    <LayoutGrid className="h-4 w-4" />
                    <span>{t("orgChart.fullCompany")}</span>
                  </>
                ) : selectedChart ? (
                  <>
                    {chartTypeIcon(selectedChart.type)}
                    <span>{selectedChart.name}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t("orgChart.selectStructure")}</span>
                )}
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-company">
                <div className="flex items-center gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  <span>{t("orgChart.fullCompany")}</span>
                </div>
              </SelectItem>
              {charts && charts.map((chart) => (
                <SelectItem key={chart.id} value={String(chart.id)}>
                  <div className="flex items-center gap-1.5">
                    {chartTypeIcon(chart.type)}
                    <span>{chart.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {typeof selectedChartId === "number" && selectedChart && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditChart(selectedChart as any)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setChartToDelete({ id: selectedChart.id, name: selectedChart.name })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <Button variant="outline" size="sm" onClick={openCreateChart} data-testid="button-create-chart">
            <Plus className="h-4 w-4 me-1" />
            {t("orgChart.createChart")}
          </Button>
        </div>
      </div>

      {isStructureSelected && !presentationMode && (
        <div className="mx-6 mt-3 grid gap-3 xl:grid-cols-[minmax(320px,520px)_1fr]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={orgSearchInputRef}
              value={orgSearchQuery}
              onChange={(e) => setOrgSearchQuery(e.target.value)}
              placeholder={uiText("Find and focus employee... (/)", "ابحث وركز على موظف... (/)")}
              className="h-10 ps-9"
              data-testid="input-org-chart-focus-search"
            />
            {orgSearchQuery.trim().length >= QUICK_SEARCH_MIN_LENGTH && (
              <div
                className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden"
                data-testid="org-chart-focus-search-results"
              >
                {quickSearchResults.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    {uiText("No matching employees", "لا يوجد موظفون مطابقون")}
                  </div>
                ) : (
                  quickSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="w-full px-3 py-2 text-start hover:bg-muted/60 flex items-center gap-2"
                      onClick={() => focusEmployeeById(result.id)}
                      data-testid={`focus-search-result-${result.id}`}
                    >
                      <LocateFixed className={`h-4 w-4 shrink-0 ${result.inChart ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{result.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.title || result.email}
                        </span>
                      </span>
                      {!result.inChart && (
                        <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {uiText("Pool", "المجمع")}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isLargeTree && (
              <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="large-chart-mode-banner">
                <Gauge className="h-4 w-4" />
                <span className="font-medium">{uiText("Large chart mode", "وضع الهيكل الكبير")}</span>
                <span className="text-amber-700/80">{totalCount.toLocaleString(i18n.language)}</span>
                {remainingRootCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-amber-300 bg-white/70 px-2 text-xs text-amber-800 hover:bg-white"
                    onClick={() => setRootRenderLimit(activeRootCount)}
                    data-testid="button-load-all-root-nodes"
                  >
                    {uiText("Load all roots", "تحميل كل الجذور")}
                  </Button>
                )}
                {viewMode !== "table" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-amber-300 bg-white/70 px-2 text-xs text-amber-800 hover:bg-white"
                    onClick={() => setViewMode("table")}
                    data-testid="button-large-chart-table-view"
                  >
                    {uiText("Table", "جدول")}
                  </Button>
                )}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-10 ${dataQualityTone}`}
              onClick={() => setIsDataQualityOpen((open) => !open)}
              data-testid="button-data-quality"
              aria-expanded={isDataQualityOpen}
            >
              {dataQuality.criticalCount > 0 || dataQuality.warningCount > 0 ? (
                <AlertTriangle className="h-4 w-4 me-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 me-1" />
              )}
              {uiText("Data quality", "جودة البيانات")}
              <span className="ms-1 font-semibold">{dataQuality.score}%</span>
            </Button>
          </div>
        </div>
      )}

      {isStructureSelected && isDataQualityOpen && !presentationMode && (
        <div className="mx-6 mt-3 rounded-lg border bg-card p-4 shadow-sm" data-testid="data-quality-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">
                  {uiText("Org health", "صحة الهيكل")}
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {uiText("Quality checks across people, reporting lines, and role data.", "فحص سريع للموظفين وخطوط التقارير وبيانات الأدوار.")}
              </p>
            </div>
            <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${dataQualityTone}`}>
              {uiText("Score", "التقييم")} {dataQuality.score}%
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs text-muted-foreground">{uiText("People", "الموظفون")}</div>
              <div className="mt-1 text-lg font-semibold">{dataQuality.totalEmployeesCount.toLocaleString(i18n.language)}</div>
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs text-muted-foreground">{uiText("In chart", "داخل الهيكل")}</div>
              <div className="mt-1 text-lg font-semibold">{dataQuality.visibleEmployeesCount.toLocaleString(i18n.language)}</div>
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs text-muted-foreground">{uiText("Talent pool", "مجمع المواهب")}</div>
              <div className="mt-1 text-lg font-semibold">{dataQuality.talentPoolEmployeesCount.toLocaleString(i18n.language)}</div>
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs text-muted-foreground">{uiText("Critical", "حرج")}</div>
              <div className="mt-1 text-lg font-semibold text-red-600">{dataQuality.criticalCount}</div>
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs text-muted-foreground">{uiText("Warnings", "تنبيهات")}</div>
              <div className="mt-1 text-lg font-semibold text-amber-600">{dataQuality.warningCount}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {dataQuality.issues.length === 0 ? (
              <div className="lg:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-testid="data-quality-empty">
                {uiText("No quality issues found in the current chart.", "لم يتم العثور على مشاكل جودة في الهيكل الحالي.")}
              </div>
            ) : (
              dataQuality.issues.map((issue) => (
                <div
                  key={issue.key}
                  className={`rounded-md border p-3 ${issueSeverityClass(issue.severity)}`}
                  data-testid={`data-quality-issue-${issue.key}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{issue.title}</div>
                      <div className="mt-0.5 text-xs opacity-80">{issue.description}</div>
                    </div>
                    <div className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
                      {issue.count}
                    </div>
                  </div>
                  {issue.samples.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {issue.samples.map((sample) => (
                        <button
                          key={`${issue.key}-${sample.id}`}
                          type="button"
                          className="rounded border bg-white/70 px-2 py-1 text-xs hover:bg-white"
                          onClick={() => focusEmployeeById(sample.id)}
                          data-testid={`data-quality-sample-${issue.key}-${sample.id}`}
                        >
                          {sample.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isStructureSelected && rawActiveTreeData && rawActiveTreeData.length > 0 && !presentationMode && hasPermission("audit", "view") && (
        <div className="mx-6 mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMissingSuccessors}
              onChange={(e) => setShowMissingSuccessors(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-500"
              data-testid="toggle-missing-successors"
            />
            <span>{t("succession.highlightMissing")}</span>
          </label>
          {showMissingSuccessors && missingSuccessorIds && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {t("succession.missingCount", { count: missingSuccessorIds.size })}
            </span>
          )}
        </div>
      )}

      {isStructureSelected && rawActiveTreeData && rawActiveTreeData.length > 0 && !presentationMode && (
        <div className="mx-6 mt-3">
          <OrgChartFilterBar
            departments={(departments ?? []).map((d) => ({ id: d.id, name: d.name, color: d.color }))}
            administrations={((administrations ?? []) as Array<{ id: number; name: string; color: string | null }>).map((a) => ({ id: a.id, name: a.name, color: a.color }))}
            nationalities={filterNationalityOptions}
            titles={filterTitleOptions}
            tags={(tagLibrary ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color }))}
            filter={filter}
            onToggleDepartment={filterToggleDepartment}
            onToggleAdministration={filterToggleAdministration}
            onToggleNationality={filterToggleNationality}
            onToggleTitle={filterToggleTitle}
            onToggleTag={filterToggleTag}
            onSetTagsMode={filterSetTagsMode}
            onClear={clearFilter}
            onApplyFilter={applyFilter}
            visibleCount={visibleCount}
            totalCount={totalCount}
            orgId={selectedOrgId ?? null}
            chartScope={selectedChartId != null ? String(selectedChartId) : null}
          />
        </div>
      )}

      {moveToast && (
        <div className="mx-6 mt-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
          <ArrowRightLeft className="h-4 w-4" />
          {moveToast}
        </div>
      )}

      {undoToast && (
        <div className="mx-6 mt-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2" data-testid="undo-toast">
          <Undo2 className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{undoToast}</span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="font-semibold underline underline-offset-2 hover:text-blue-900 disabled:opacity-50 transition-colors"
            data-testid="button-undo-history-toast"
          >
            {t("orgChart.undoAction")}
          </button>
          {redoStack.length > 0 && (
            <button
              type="button"
              onClick={handleRedo}
              className="font-semibold underline underline-offset-2 hover:text-blue-900 transition-colors"
              data-testid="button-redo-history-toast"
            >
              {t("orgChart.redoAction")}
            </button>
          )}
          <span className="text-blue-400 text-xs" data-testid="undo-shortcut-hint">
            {t("orgChart.undoRedoShortcutHint", {
              undo: isMacLike ? "⌘Z" : "Ctrl+Z",
              redo: isMacLike ? "⌘Y" : "Ctrl+Y",
            })}
          </span>
        </div>
      )}

      {dragState.draggedId && (
        <div className="mx-6 mt-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
          <GripVertical className="h-4 w-4" />
          {t("orgChart.dragging")} <strong>{dragState.draggedName}</strong> {t("orgChart.dropToAssign")}
        </div>
      )}

      {!isMobile && viewMode === "table" && isStructureSelected ? (
        <div className="flex-1 overflow-hidden relative m-3 mt-3 sm:m-6 sm:mt-4 rounded-xl border-2 border-border bg-card">
          <EmployeeTableView
            orgId={selectedOrgId ?? 0}
            totalEmployees={(employees ?? []).length}
            employees={employees ?? []}
            departments={(departments ?? []).map((d) => ({ id: d.id, name: d.name, color: d.color }))}
            filteredIds={isFilterActive ? collectFilteredIds(activeTreeData as OrgChartNode[] | undefined) : null}
            selectedIds={bulkSelectedIds}
            onSelectionChange={setBulkSelectedIds}
            onRowClick={(node) => setSelectedNode(node)}
            onBulkDelete={handleBulkDelete}
            onBulkMove={handleBulkMove}
            onBulkExport={handleBulkExport}
            t={t}
          />
        </div>
      ) : !isMobile && viewMode === "grid" && isStructureSelected ? (
        <div className="flex-1 overflow-auto relative m-3 mt-3 sm:m-6 sm:mt-4 rounded-xl border-2 border-border bg-card p-4" data-testid="employee-grid-view" dir={i18n.dir()}>
          {(() => {
            const filteredIds = isFilterActive ? collectFilteredIds(activeTreeData as OrgChartNode[] | undefined) : null;
            const list = filteredIds
              ? (employees ?? []).filter((e) => filteredIds.has(e.id))
              : (employees ?? []);
            if (list.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                  <Users className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-sm">{t("orgChart.grid.empty")}</p>
                </div>
              );
            }
            const deptMap = new Map((departments ?? []).map((d) => [d.id, { name: d.name, color: d.color }] as const));
            return (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {list.map((e) => {
                  const dept = e.departmentId != null ? deptMap.get(e.departmentId) : null;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        const node: OrgChartNode = {
                          id: e.id,
                          firstName: e.firstName,
                          lastName: e.lastName,
                          title: e.title,
                          email: e.email,
                          avatarUrl: e.avatarUrl ?? null,
                          departmentId: e.departmentId ?? null,
                          departmentName: dept?.name ?? null,
                          departmentColor: dept?.color ?? null,
                          administrationId: e.administrationId ?? null,
                          administrationName: null,
                          administrationColor: null,
                          managerId: e.managerId ?? null,
                          nationality: e.nationality ?? null,
                          directReports: 0,
                          isActive: e.isActive,
                          isOpenPosition: e.isOpenPosition,
                          openSinceDate: e.openSinceDate ?? null,
                          children: [],
                        };
                        setSelectedNode(node);
                      }}
                      className="text-start rounded-lg border bg-background hover:bg-muted/40 transition-colors p-3 flex flex-col items-center text-center"
                      data-testid={`grid-card-${e.id}`}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm font-medium mb-2"
                        style={{ backgroundColor: dept?.color ? `${dept.color}20` : undefined, color: dept?.color || undefined }}
                      >
                        {e.avatarUrl ? (
                          <img src={resolvePhotoUrl(e.avatarUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{(e.firstName[0] || "").toUpperCase()}{(e.lastName[0] || "").toUpperCase()}</span>
                        )}
                      </div>
                      <div className="font-medium text-sm truncate w-full">{e.firstName} {e.lastName}</div>
                      <div className="text-xs text-muted-foreground truncate w-full">{e.title}</div>
                      {dept && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          {dept.color && <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: dept.color }} />}
                          <span className="truncate">{dept.name}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : (
      <div
        ref={containerRef}
        data-print-area
        className={`flex-1 overflow-hidden relative transition-colors ${
          presentationMode
            ? "m-0 rounded-none border-0 bg-background"
            : `m-3 mt-3 sm:m-6 sm:mt-4 rounded-xl border-2 bg-muted/30 ${
                isCanvasDropTarget ? "border-primary/60 bg-primary/5" : "border-border"
              }`
        } ${
          isMobile ? "" : isPanning ? "cursor-grabbing" : dragState.draggedId ? "cursor-move" : "cursor-grab"
        }`}
        data-presentation-mode={presentationMode ? "true" : undefined}
        onMouseDown={isMobile ? undefined : handleMouseDown}
        onMouseMove={isMobile ? undefined : handleMouseMove}
        onMouseUp={isMobile ? undefined : handleMouseUp}
        onMouseLeave={isMobile ? undefined : handleMouseUp}
        onWheel={isMobile ? undefined : handleWheel}
        onTouchStart={isMobile && mobileViewMode === "graph" ? handleTouchStart : undefined}
        onTouchMove={isMobile && mobileViewMode === "graph" ? handleTouchMove : undefined}
        onTouchEnd={isMobile && mobileViewMode === "graph" ? handleTouchEnd : undefined}
        style={isMobile && mobileViewMode === "graph" ? { touchAction: "none" } : undefined}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleDropOnCanvas}
      >
        <div className="print-only print-header" aria-hidden="true">
          <span className="print-title">
            {(organization?.name ?? "")}
            {selectedChart ? ` — ${selectedChart.name}` : selectedChartId === "full" ? ` — ${t("orgChart.fullCompany")}` : ""}
          </span>
          <span className="print-meta">
            {new Date().toLocaleDateString(i18n.language)}
          </span>
        </div>
        {selectedChartId === null ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground" data-testid="empty-state-no-structure">
            <LayoutGrid className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">{t("orgChart.selectStructureTitle")}</p>
            <p className="text-sm mt-1">{t("orgChart.selectStructureHint")}</p>
          </div>
        ) : activeLoading ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton className="h-64 w-96" />
          </div>
        ) : isFilterActive && (!activeTreeData || activeTreeData.length === 0) && rawActiveTreeData && rawActiveTreeData.length > 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground" data-testid="empty-state-filter-no-matches">
            <Search className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">{t("orgChart.filterNoMatchesTitle")}</p>
            <p className="text-sm mt-1">{t("orgChart.filterNoMatchesHint")}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilter} data-testid="empty-state-clear-filter">
              <X className="h-4 w-4 me-1" />
              {t("orgChart.filterClearAll")}
            </Button>
          </div>
        ) : activeTreeData && activeTreeData.length > 0 ? (
          isMobile && mobileViewMode === "tree" ? (
            <div ref={chartContentRef} className="w-full h-full overflow-y-auto">
              <MobileOrgChart
                roots={activeTreeData as OrgChartNode[]}
                collapsed={collapsed}
                onToggle={toggleCollapse}
                onNodeClick={handleNodeClick}
              />
            </div>
          ) : (
            <div
              data-chart-canvas
              className="min-w-full min-h-full flex items-start justify-center p-12"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center top",
                transition: isPanning ? "none" : (effectiveAnimationsEnabled ? (presentationMode ? "transform 0.4s ease" : "transform 0.2s ease") : "none"),
              }}
            >
              <div ref={chartContentRef} className="relative flex items-stretch gap-12">
                {overlaySize.w > 0 && overlaySegments.length > 0 && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width={overlaySize.w}
                    height={overlaySize.h}
                    data-testid="secondary-manager-overlay"
                  >
                    <defs>
                      <marker id="secondary-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                      </marker>
                    </defs>
                    {overlaySegments.map((seg) => (
                      <path
                        key={seg.id}
                        d={`M ${seg.x1} ${seg.y1} C ${seg.x1} ${(seg.y1+seg.y2)/2}, ${seg.x2} ${(seg.y1+seg.y2)/2}, ${seg.x2} ${seg.y2}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        markerEnd="url(#secondary-arrow)"
                        opacity={0.85}
                      />
                    ))}
                  </svg>
                )}
                {renderedTreeRoots.map((root, i) => (
                  <Fragment key={root.id}>
                    <SiblingGap
                      parentId={null}
                      index={i}
                      active={
                        dragState.draggedId !== null &&
                        dragState.draggedParentId === null &&
                        dragState.reorderTarget?.parentId === null &&
                        dragState.reorderTarget?.index === i
                      }
                      canAccept={dragState.draggedId !== null && dragState.draggedParentId === null}
                      onDragOver={handleReorderOver}
                      onDragLeave={handleReorderLeave}
                      onDrop={handleReorderDrop}
                    />
                    <div data-print-subtree className="contents">
                      <div className="print-only print-subtree-header" aria-hidden="true">
                        <span className="print-subtree-label">{t("orgChart.print.subtreeLabel")}</span>
                        <span>{root.firstName ? `${root.firstName} ${root.lastName ?? ""}`.trim() : (root.title ?? "")}</span>
                        {root.title && root.firstName ? <span className="print-subtree-label"> · {root.title}</span> : null}
                      </div>
                      <OrgNode
                      node={root}
                      parentId={null}
                      siblingIndex={i}
                      collapsed={collapsed}
                      onToggle={toggleCollapse}
                      dragState={dragState}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDrop}
                      onNodeClick={handleNodeClick}
                      onFillPosition={handleFillPosition}
                      onEdit={openEditDialog}
                      onAddOpenPosition={openOpenPositionDialogForNode}
                      onMakeRoot={handleMakeRoot}
                      onRequestRemoveFromChart={setRemoveFromChartNode}
                      onReorderOver={handleReorderOver}
                      onReorderLeave={handleReorderLeave}
                      onReorderDrop={handleReorderDrop}
                      onSiblingKeyDown={handleSiblingKeyDown}
                      t={t}
                      animationsEnabled={effectiveAnimationsEnabled}
                      connectorStyle={connectorStyle}
                      nodeRefs={nodeRefs}
                      headcountMap={headcountMap}
                      onShowBranchSummary={handleShowBranchSummary}
                      highlightedId={highlightedId}
                      missingSuccessorIds={missingSuccessorIds}
                      presentationMode={presentationMode}
                      largeTreeMode={isLargeTree}
                    />
                    </div>
                  </Fragment>
                ))}
                {remainingRootCount > 0 && (
                  <div className="flex min-w-60 flex-col items-center justify-center px-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => setRootRenderLimit((limit) => limit + LARGE_TREE_ROOT_STEP)}
                      data-testid="button-load-more-root-nodes"
                    >
                      {t("orgChart.loadMoreRootNodes", { count: nextRootBatchCount })}
                    </Button>
                    <p className="mt-2 max-w-56 text-center text-xs text-muted-foreground">
                      {t("orgChart.largeChartRenderHint")}
                    </p>
                  </div>
                )}
                <SiblingGap
                  parentId={null}
                  index={renderedTreeRoots.length}
                  active={
                    dragState.draggedId !== null &&
                    dragState.draggedParentId === null &&
                    dragState.reorderTarget?.parentId === null &&
                    dragState.reorderTarget?.index === renderedTreeRoots.length
                  }
                  canAccept={dragState.draggedId !== null && dragState.draggedParentId === null}
                  onDragOver={handleReorderOver}
                  onDragLeave={handleReorderLeave}
                  onDrop={handleReorderDrop}
                />
              </div>
            </div>
          )
        ) : (
          <div className={`flex flex-col items-center justify-center h-full transition-colors pointer-events-none ${isCanvasDropTarget ? "text-primary" : "text-muted-foreground"}`}>
            {isCanvasDropTarget ? (
              <>
                <div className="w-24 h-24 mb-4 rounded-2xl border-2 border-dashed border-primary flex items-center justify-center animate-pulse">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <p className="text-lg font-medium">{t("orgChart.dropHereToAdd")}</p>
              </>
            ) : (
              <>
                <Users className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">{t("orgChart.noEmployeesYet")}</p>
                <p className="text-sm mt-1">{t("orgChart.addEmployeesToSee")}</p>
              </>
            )}
          </div>
        )}

        {departments && departments.filter(d => d.color).length > 0 && (
          <div className="absolute bottom-4 start-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-md pointer-events-auto" style={{ maxWidth: 160 }}>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              onClick={() => setLegendOpen(prev => !prev)}
            >
              <span>{t("dashboard.departments")}</span>
              <span className="text-[8px]">{legendOpen ? "▲" : "▼"}</span>
            </button>
            {legendOpen && (
              <div className="px-3 pb-2 space-y-1.5 overflow-y-auto" style={{ maxHeight: 200 }}>
                {departments.filter(d => d.color).map((dept) => (
                  <div key={dept.id} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: dept.color || undefined }}
                    />
                    <span className="text-xs text-foreground truncate">{dept.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      <BulkMoveDialog
        open={isBulkMoveOpen}
        onOpenChange={(o) => { if (!o) { setIsBulkMoveOpen(false); setBulkMoveIds([]); } }}
        selectedIds={bulkMoveIds}
        employees={employees ?? []}
        onConfirm={handleBulkMoveConfirm}
        isSaving={moveMutation.isPending}
        t={t}
      />

      <AlertDialog open={bulkDeleteIds.length > 0} onOpenChange={(o) => { if (!o) setBulkDeleteIds([]); }}>
        <AlertDialogContent data-testid="bulk-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orgChart.table.bulkDeleteTitle", { count: bulkDeleteIds.length })}</AlertDialogTitle>
            <AlertDialogDescription>{t("orgChart.table.bulkDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="bulk-delete-cancel">{t("orgChart.table.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="bulk-delete-confirm-button"
            >
              {bulkDeleteMutation.isPending ? t("orgChart.table.deleting") : t("orgChart.table.bulkDeleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={removeFromChartNode != null}
        onOpenChange={(open) => {
          if (!open) setRemoveFromChartNode(null);
        }}
      >
        <AlertDialogContent data-testid="remove-from-chart-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDialog.removeFromChartDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeFromChartNode) {
                  handleRemoveFromChart(removeFromChartNode.id);
                  setRemoveFromChartNode(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="remove-from-chart-confirm-button"
            >
              {t("orgChart.deleteBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {bulkActionToast && (
        <div className="fixed bottom-6 start-1/2 -translate-x-1/2 px-4 py-2 bg-foreground text-background rounded-lg text-sm shadow-lg z-50" data-testid="bulk-action-toast">
          {bulkActionToast}
        </div>
      )}

      <EmployeeDetailDialog
        selectedNode={selectedNode}
        isEditOpen={isEditOpen}
        selectedNodeSecondary={selectedNodeSecondary}
        orgId={selectedOrgId ?? null}
        language={i18n.language}
        onClose={() => setSelectedNode(null)}
        onFillPosition={() => handleFillPosition()}
        onEdit={openEditDialog}
        onAddOpenPosition={openOpenPositionDialogForNode}
        onMakeRoot={handleMakeRoot}
        onRemoveFromChart={handleRemoveFromChart}
        t={t}
      />

      <EditEmployeeDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        selectedNode={selectedNode}
        selectedOrgId={selectedOrgId}
        administrations={administrations}
        departments={departments}
        employees={employees}
        onSubmit={handleEditSubmit}
        isSaving={updateMutation.isPending}
        t={t}
      />

      {chartToast && (
        <div className="fixed bottom-6 end-6 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm shadow-lg animate-in slide-in-from-bottom-2 z-50">
          {chartToast}
        </div>
      )}

      <OpenPositionDialog
        open={isOpenPosDialogOpen}
        onOpenChange={setIsOpenPosDialogOpen}
        form={openPosForm}
        setForm={setOpenPosForm}
        administrations={administrations}
        departments={departments}
        employees={employees}
        orgId={selectedOrgId}
        onSubmit={handleCreateOpenPosition}
        isSaving={createOpenPositionMutation.isPending}
        t={t}
      />

      <ChartFormDialog
        open={isChartDialogOpen}
        onOpenChange={(open) => {
          setIsChartDialogOpen(open);
          if (!open) setEditingChart(null);
        }}
        form={chartForm}
        setForm={setChartForm}
        editing={!!editingChart}
        departments={departments}
        employees={employees}
        onSubmit={handleSaveChart}
        isSaving={createChartMutation.isPending || updateChartMutation.isPending}
        t={t}
      />

      <DeleteChartDialog
        chartToDelete={chartToDelete}
        onClose={() => setChartToDelete(null)}
        onConfirm={(id) => {
          if (selectedOrgId) {
            deleteChartMutation.mutate({ orgId: selectedOrgId, chartId: id });
          }
        }}
        t={t}
      />

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        exportOptions={exportOptions}
        setExportOptions={setExportOptions}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportStatus={exportStatus}
        exportError={exportError}
        onRunExport={runExport}
        t={t}
      />

      <BranchSummarySheet
        branchSummaryNodeId={branchSummaryNodeId}
        branchSummaryNode={branchSummaryNode}
        branchSummaryStats={branchSummaryStats}
        isFilterActive={isFilterActive}
        onClose={() => setBranchSummaryNodeId(null)}
        onExport={exportBranchHeadcount}
        t={t}
      />

      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={(open) => {
          setIsShareDialogOpen(open);
          if (!open) {
            setCreatedShareUrl("");
            setShareError("");
          }
        }}
        shareForm={shareForm}
        setShareForm={setShareForm}
        createdShareUrl={createdShareUrl}
        shareError={shareError}
        onCreate={() => {
          if (!selectedOrgId) return;
          createShareMutation.mutate({
            orgId: selectedOrgId,
            data: {
              password: shareForm.password ? shareForm.password : null,
              expiresAt: shareForm.expiresAt ? shareForm.expiresAt : null,
            },
          });
        }}
        isCreating={createShareMutation.isPending}
        canCreate={!!selectedOrgId}
        t={t}
      />

      <TalentPool
        employees={talentPoolEmployees}
        managers={talentPoolManagers}
        departments={(departments || []).map((d) => ({
          id: d.id,
          name: d.name,
          color: d.color || null,
        }))}
        isOpen={isTalentPoolOpen}
        onClose={() => setIsTalentPoolOpen(false)}
        onDragStart={(id, name) => handleDragStart(id, name, null, -1)}
        onDragEnd={handleDragEnd}
        onAddToChart={handleAddTalentToChart}
        onDropFromChart={handleReturnToPool}
      />

      <ReturnToPoolDialog
        returnDialog={returnDialog}
        isApplyingReturn={isApplyingReturn}
        onClose={() => setReturnDialog(null)}
        onApply={(id, strategy) => applyReturnToPool(id, strategy)}
        t={t}
      />

      {isTalentPoolOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsTalentPoolOpen(false)}
        />
      )}

      <SnapshotDialog
        open={isSnapshotDialogOpen}
        onOpenChange={setIsSnapshotDialogOpen}
        selectedOrgId={selectedOrgId}
        snapshotName={snapshotName}
        setSnapshotName={setSnapshotName}
        snapshotDesc={snapshotDesc}
        setSnapshotDesc={setSnapshotDesc}
        t={t}
      />

      {presentationMode && (
        <>
          <button
            type="button"
            onClick={exitPresentation}
            className="fixed top-4 end-4 z-50 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-card border border-border shadow-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            aria-label={t("orgChart.presentation.exit")}
            data-testid="button-exit-presentation"
          >
            <X className="h-4 w-4" />
            {t("orgChart.presentation.exit")}
          </button>
          <div
            className={`fixed bottom-4 inset-x-0 mx-auto w-fit max-w-[95vw] z-50 px-4 py-2 rounded-lg bg-card/95 backdrop-blur border border-border shadow-lg text-sm text-foreground flex items-center gap-3 transition-opacity duration-300 ${
              hintVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            data-testid="presentation-hint-bar"
            data-visible={hintVisible ? "true" : "false"}
          >
            <span className="font-semibold text-foreground">{t("orgChart.presentation.hintTitle")}</span>
            <span className="text-muted-foreground">{t("orgChart.presentation.hintArrows")}</span>
            <span className="text-muted-foreground">{t("orgChart.presentation.hintEnter")}</span>
            <span className="text-muted-foreground">
              {t(followMode ? "orgChart.presentation.hintFollowOn" : "orgChart.presentation.hintFollowOff")}
            </span>
            <span className="text-muted-foreground">{t("orgChart.presentation.hintEsc")}</span>
          </div>
        </>
      )}
    </div>
  );
}
