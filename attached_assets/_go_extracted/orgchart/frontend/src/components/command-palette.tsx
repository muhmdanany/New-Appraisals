import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Briefcase,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Landmark,
  Network,
  Palette,
  ShieldCheck,
  Users,
  Camera,
  Home,
  Bell,
  Mail,
  UserPlus,
  Shield,
  Key,
  Trash2,
  Loader2,
  Filter,
  StickyNote,
  Sparkles,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDepartments,
  useListAdministrations,
  useListCharts,
  useListSavedFilterViews,
  useSearchOrganization,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getListAdministrationsQueryKey,
  getListChartsQueryKey,
  getListSavedFilterViewsQueryKey,
  getSearchOrganizationQueryKey,
} from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react";

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

type RecentKind =
  | "employee"
  | "department"
  | "administration"
  | "page"
  | "chart"
  | "snapshot"
  | "savedView"
  | "openPosition";

interface RecentEntry {
  kind: RecentKind;
  id: string;
  label: string;
  sublabel?: string;
  payload?: Record<string, unknown>;
  ts: number;
}

const MAX_RECENTS = 5;

// Beyond this many cached employees, in-memory filtering on every keystroke
// noticeably lags lower-end devices and ships a large payload to the
// client. Above the threshold we always defer to the backend /search
// endpoint, even when the cache is warm.
const LARGE_ORG_THRESHOLD = 500;
const SEARCH_DEBOUNCE_MS = 200;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

function recentsKey(userId: number | null | undefined, orgId: number | null) {
  if (!userId) return null;
  return `orgchart_palette_recents_${userId}_${orgId ?? "none"}`;
}

function loadRecents(userId: number | null | undefined, orgId: number | null): RecentEntry[] {
  const key = recentsKey(userId, orgId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX_RECENTS) as RecentEntry[];
  } catch {
    return [];
  }
}

function saveRecent(
  userId: number | null | undefined,
  orgId: number | null,
  entry: Omit<RecentEntry, "ts">,
) {
  const key = recentsKey(userId, orgId);
  if (!key) return;
  try {
    const existing = loadRecents(userId, orgId).filter(
      (e) => !(e.kind === entry.kind && e.id === entry.id),
    );
    const next: RecentEntry[] = [{ ...entry, ts: Date.now() }, ...existing].slice(0, MAX_RECENTS);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

/**
 * Cross-page coordination for the palette: focus an employee on the org chart
 * (selecting them and centering their card) or set a settings tab. Listening
 * pages dispatch and respond to these custom events.
 */
export const PALETTE_FOCUS_EMPLOYEE_EVENT = "orgchart:palette:focus-employee";
export const PALETTE_SET_SETTINGS_TAB_EVENT = "orgchart:palette:set-settings-tab";
export const PALETTE_SELECT_CHART_EVENT = "orgchart:palette:select-chart";
export const PALETTE_APPLY_SAVED_VIEW_EVENT = "orgchart:palette:apply-saved-view";

export function dispatchFocusEmployee(id: number) {
  window.dispatchEvent(new CustomEvent(PALETTE_FOCUS_EMPLOYEE_EVENT, { detail: { id } }));
}

export function dispatchSetSettingsTab(tab: string) {
  window.dispatchEvent(new CustomEvent(PALETTE_SET_SETTINGS_TAB_EVENT, { detail: { tab } }));
}

export function dispatchSelectChart(scope: number | "full") {
  window.dispatchEvent(new CustomEvent(PALETTE_SELECT_CHART_EVENT, { detail: { scope } }));
}

export interface PaletteSavedViewDetail {
  chartScope: string;
  departmentIds: number[];
  administrationIds: number[];
}

export function dispatchApplySavedView(detail: PaletteSavedViewDetail) {
  window.dispatchEvent(
    new CustomEvent(PALETTE_APPLY_SAVED_VIEW_EVENT, { detail }),
  );
}

interface NavRoute {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

interface SettingsRoute {
  tab: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Cmd/Ctrl + K opens the palette globally — including from inside text
      // inputs, since the palette is the standard search affordance.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  );
}

function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { selectedOrgId } = useOrg();
  const { user, hasPermission } = useAuth();
  const [query, setQuery] = useState("");

  // Reset query whenever the dialog reopens.
  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  const [recents, setRecents] = useState<RecentEntry[]>([]);
  useEffect(() => {
    if (isOpen) setRecents(loadRecents(user?.id, selectedOrgId));
  }, [isOpen, user?.id, selectedOrgId]);

  // Permission gates for the optional groups. The /search endpoint also
  // applies these server-side, but we hide queries the user can't see so we
  // don't waste a round trip and don't surface confusing empty rows.
  const canViewCharts = hasPermission("charts", "view");
  const canViewSnapshots = hasPermission("snapshots", "view");

  // The palette only consumes whatever employee list is already cached
  // by other pages (org chart, employees page, etc). It never triggers
  // its own fetch — for huge orgs that payload is the very thing this
  // task aims to avoid shipping. When the cache is empty or large we
  // route every keystroke through the /search endpoint instead.
  const queryClient = useQueryClient();
  const employees = useMemo(() => {
    if (!isOpen || !selectedOrgId) return undefined;
    return queryClient.getQueryData<Employee[]>(
      getListEmployeesQueryKey(selectedOrgId, {}),
    );
    // selectedOrgId/isOpen capture the relevant cache key; we don't
    // subscribe to mutations here because the palette refreshes on
    // every reopen and search results come from the server anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedOrgId, queryClient]);

  const { data: departments } = useListDepartments(selectedOrgId!, {
    query: {
      enabled: isOpen && !!selectedOrgId,
      queryKey: getListDepartmentsQueryKey(selectedOrgId ?? 0),
    },
  });
  const { data: administrations } = useListAdministrations(selectedOrgId!, {
    query: {
      enabled: isOpen && !!selectedOrgId,
      queryKey: getListAdministrationsQueryKey(selectedOrgId ?? 0),
    },
  });
  const { data: charts } = useListCharts(selectedOrgId!, {
    query: {
      enabled: isOpen && !!selectedOrgId && canViewCharts,
      queryKey: getListChartsQueryKey(selectedOrgId ?? 0),
    },
  });
  // Snapshots are not exposed via the OpenAPI client; suggestions for them
  // come solely from the backend /search response (see filteredSnapshots).
  const { data: savedViews } = useListSavedFilterViews(
    selectedOrgId!,
    {},
    {
      query: {
        enabled: isOpen && !!selectedOrgId,
        queryKey: getListSavedFilterViewsQueryKey(selectedOrgId ?? 0, {}),
      },
    },
  );

  const trimmed = query.trim();

  const handleAsk = useCallback(
    (q: string) => {
      const text = q.trim();
      if (!text) return;
      close();
      setLocation(`/?ask=${encodeURIComponent(text)}`);
    },
    [close, setLocation],
  );
  const debouncedTrimmed = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);

  // Big orgs always go through the backend even when the employee cache
  // is warm: filtering thousands of rows on every keystroke is the main
  // source of typing lag. Small orgs keep using the cached lists for
  // zero-latency local filtering. Snapshots have no client-side cache,
  // so the backend results also fill that group.
  const isLargeOrg = !employees || employees.length >= LARGE_ORG_THRESHOLD;
  const useBackend =
    !!selectedOrgId && isLargeOrg && debouncedTrimmed.length >= 1;
  const searchQuery = useSearchOrganization(
    selectedOrgId!,
    { q: debouncedTrimmed, limit: 10 },
    {
      query: {
        enabled: isOpen && useBackend,
        queryKey: getSearchOrganizationQueryKey(selectedOrgId ?? 0, {
          q: debouncedTrimmed,
          limit: 10,
        }),
        // Keep the previously-rendered results visible while the next
        // debounced request is in flight so the list doesn't flash empty.
        placeholderData: (prev) => prev,
      },
    },
  );
  const serverResults = searchQuery.data;
  const isSearching = searchQuery.isFetching;

  // True while the user is still typing (debounce hasn't caught up) or
  // the backend request itself is in flight. Used to suppress the
  // "no results" empty state so it never flickers between keystrokes.
  const isPaletteSearching =
    useBackend && (trimmed !== debouncedTrimmed || isSearching);

  const navRoutes: NavRoute[] = useMemo(() => {
    const items: NavRoute[] = [
      { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard, keywords: ["home"] },
      { href: "/org-space", label: t("nav.orgSpace"), icon: Home },
      { href: "/org-chart", label: t("nav.orgChart"), icon: Network, keywords: ["chart", "tree"] },
      { href: "/open-positions", label: t("nav.openPositions"), icon: Briefcase, keywords: ["jobs", "vacancies"] },
      { href: "/employees", label: t("nav.employees"), icon: Users, keywords: ["people", "staff"] },
      { href: "/departments", label: t("nav.departments"), icon: Building2 },
      { href: "/administrations", label: t("nav.administrations"), icon: Landmark },
      { href: "/reports", label: t("nav.reports"), icon: ClipboardList },
    ];
    if (hasPermission("audit", "view")) {
      items.push({ href: "/audit", label: t("audit.title"), icon: ShieldCheck, keywords: ["log", "history"] });
    }
    if (hasPermission("snapshots", "view")) {
      items.push({ href: "/snapshots", label: t("snapshots.title"), icon: Camera });
    }
    if (hasPermission("themes", "view") || hasPermission("themes", "edit")) {
      items.push({ href: "/themes", label: t("themes.title"), icon: Palette });
    }
    items.push({ href: "/security", label: t("nav.security"), icon: ShieldCheck });
    return items;
  }, [t, hasPermission]);

  const settingsRoutes: SettingsRoute[] = useMemo(() => {
    const items: SettingsRoute[] = [
      { tab: "organization", label: t("settings.tabOrganization"), icon: Building2 },
      { tab: "notifications", label: t("notifications.settings"), icon: Bell },
    ];
    if (hasPermission("users", "view")) {
      items.push({ tab: "users", label: t("settings.tabUsers"), icon: Users });
      items.push({ tab: "invitations", label: t("settings.tabInvitations"), icon: Mail });
      items.push({ tab: "joinRequests", label: t("settings.tabJoinRequests"), icon: UserPlus });
    }
    if (hasPermission("roles", "view")) {
      items.push({ tab: "roles", label: t("settings.tabRoles"), icon: Shield });
    }
    if (hasPermission("organizations", "edit")) {
      items.push({ tab: "apiTokens", label: t("settings.tabApiTokens"), icon: Key });
    }
    if (hasPermission("employees", "delete")) {
      items.push({ tab: "recycleBin", label: t("settings.tabRecycleBin"), icon: Trash2 });
    }
    return items;
  }, [t, hasPermission]);

  const handleSelectEmployee = useCallback(
    (entry: { id: number; firstName: string; lastName: string | null; title: string | null; departmentId?: number | null; departmentName?: string | null }) => {
      const fullName = `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim() || t("common.unnamed", { defaultValue: "" });
      saveRecent(user?.id, selectedOrgId, {
        kind: "employee",
        id: String(entry.id),
        label: fullName,
        sublabel: entry.title || undefined,
        payload: { id: entry.id },
      });
      close();
      setLocation(`/org-chart?focusEmployee=${entry.id}`);
      // Allow the org-chart page to mount/route, then ask it to focus the node.
      window.setTimeout(() => dispatchFocusEmployee(entry.id), 50);
    },
    [user?.id, selectedOrgId, close, setLocation, t],
  );

  const handleSelectDepartment = useCallback(
    (entry: { id: number; name: string }) => {
      saveRecent(user?.id, selectedOrgId, {
        kind: "department",
        id: String(entry.id),
        label: entry.name,
      });
      close();
      setLocation(`/org-chart?dept=${entry.id}`);
    },
    [user?.id, selectedOrgId, close, setLocation],
  );

  const handleSelectAdministration = useCallback(
    (entry: { id: number; name: string }) => {
      saveRecent(user?.id, selectedOrgId, {
        kind: "administration",
        id: String(entry.id),
        label: entry.name,
      });
      close();
      setLocation(`/org-chart?admin=${entry.id}`);
    },
    [user?.id, selectedOrgId, close, setLocation],
  );

  const handleSelectPage = useCallback(
    (route: { href: string; label: string }) => {
      saveRecent(user?.id, selectedOrgId, {
        kind: "page",
        id: route.href,
        label: route.label,
      });
      close();
      setLocation(route.href);
    },
    [user?.id, selectedOrgId, close, setLocation],
  );

  const handleSelectSettings = useCallback(
    (route: { tab: string; label: string }) => {
      saveRecent(user?.id, selectedOrgId, {
        kind: "page",
        id: `/settings#${route.tab}`,
        label: `${t("nav.settings")} • ${route.label}`,
      });
      close();
      setLocation(`/settings?tab=${route.tab}`);
      window.setTimeout(() => dispatchSetSettingsTab(route.tab), 50);
    },
    [user?.id, selectedOrgId, close, setLocation, t],
  );

  const handleSelectChart = useCallback(
    (entry: { id: number; name: string; type?: string | null }) => {
      saveRecent(user?.id, selectedOrgId, {
        kind: "chart",
        id: String(entry.id),
        label: entry.name,
        sublabel: entry.type ?? undefined,
      });
      close();
      setLocation(`/org-chart`);
      window.setTimeout(() => dispatchSelectChart(entry.id), 50);
    },
    [user?.id, selectedOrgId, close, setLocation],
  );

  const handleSelectSnapshot = useCallback(
    (entry: { id: number; name: string }) => {
      saveRecent(user?.id, selectedOrgId, {
        kind: "snapshot",
        id: String(entry.id),
        label: entry.name,
      });
      close();
      setLocation(`/snapshots?focus=${entry.id}`);
    },
    [user?.id, selectedOrgId, close, setLocation],
  );

  const handleSelectSavedView = useCallback(
    (entry: {
      id: number;
      name: string;
      chartScope: string;
      departmentIds?: number[];
      administrationIds?: number[];
    }) => {
      const departmentIds = entry.departmentIds ?? [];
      const administrationIds = entry.administrationIds ?? [];
      saveRecent(user?.id, selectedOrgId, {
        kind: "savedView",
        id: String(entry.id),
        label: entry.name,
        payload: {
          chartScope: entry.chartScope,
          departmentIds,
          administrationIds,
        },
      });
      close();
      setLocation(`/org-chart`);
      window.setTimeout(
        () =>
          dispatchApplySavedView({
            chartScope: entry.chartScope,
            departmentIds,
            administrationIds,
          }),
        50,
      );
    },
    [user?.id, selectedOrgId, close, setLocation],
  );

  const handleSelectOpenPosition = useCallback(
    (entry: { id: number; title: string; departmentName?: string | null }) => {
      saveRecent(user?.id, selectedOrgId, {
        kind: "openPosition",
        id: String(entry.id),
        label: entry.title || t("palette.unnamedPosition", { defaultValue: "Open position" }),
        sublabel: entry.departmentName ?? undefined,
      });
      close();
      setLocation(`/org-chart?focusEmployee=${entry.id}`);
      window.setTimeout(() => dispatchFocusEmployee(entry.id), 50);
    },
    [user?.id, selectedOrgId, close, setLocation, t],
  );

  // Build employee/department lists.
  //   - Small orgs with a warm cache: filter locally on every keystroke
  //     for zero-latency results.
  //   - Large orgs or cold caches: use the debounced server results so
  //     we never block the input on a multi-thousand-row scan.
  const filteredEmployees = useMemo(() => {
    if (!isLargeOrg && employees) {
      const visible = employees.filter((e) => e.showInOrgChart !== false);
      if (!trimmed) return visible.slice(0, 10);
      const q = trimmed.toLowerCase();
      return visible
        .filter((e) => {
          const full = `${e.firstName ?? ""} ${e.lastName ?? ""}`.toLowerCase();
          return (
            full.includes(q) ||
            (e.title || "").toLowerCase().includes(q) ||
            (e.email || "").toLowerCase().includes(q)
          );
        })
        .slice(0, 10);
    }
    if (!trimmed) return [];
    return serverResults?.employees ?? [];
  }, [employees, isLargeOrg, serverResults, trimmed]);

  const filteredDepartments = useMemo(() => {
    if (!isLargeOrg && departments && departments.length) {
      if (!trimmed) return departments.slice(0, 8);
      const q = trimmed.toLowerCase();
      return departments.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 8);
    }
    if (!trimmed) return departments?.slice(0, 8) ?? [];
    return serverResults?.departments ?? [];
  }, [departments, isLargeOrg, serverResults, trimmed]);

  const filteredAdministrations = useMemo(() => {
    if (!administrations) return [];
    if (!trimmed) return administrations.slice(0, 8);
    const q = trimmed.toLowerCase();
    return administrations.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 8);
  }, [administrations, trimmed]);

  const filteredCharts = useMemo(() => {
    if (!canViewCharts) return [];
    if (charts && charts.length) {
      if (!trimmed) return charts.slice(0, 6);
      const q = trimmed.toLowerCase();
      return charts
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.description || "").toLowerCase().includes(q),
        )
        .slice(0, 6);
    }
    if (serverResults?.charts) return serverResults.charts;
    return [];
  }, [canViewCharts, charts, serverResults, trimmed]);

  const filteredSnapshots = useMemo(() => {
    if (!canViewSnapshots) return [];
    if (serverResults?.snapshots) return serverResults.snapshots;
    return [];
  }, [canViewSnapshots, serverResults]);

  const filteredSavedViews = useMemo(() => {
    if (savedViews && savedViews.length) {
      if (!trimmed) return savedViews.slice(0, 6);
      const q = trimmed.toLowerCase();
      return savedViews.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 6);
    }
    // The server search returns id/name/chartScope only; that's enough to
    // navigate, but the apply-filter event will then resolve nothing until
    // the cached list catches up. Acceptable trade-off for cold-start.
    if (serverResults?.savedViews) {
      return serverResults.savedViews.map((v) => ({
        ...v,
        departmentIds: [] as number[],
        administrationIds: [] as number[],
      }));
    }
    return [];
  }, [savedViews, serverResults, trimmed]);

  const filteredOpenPositions = useMemo(() => {
    if (employees && employees.length) {
      const open = employees.filter((e) => e.isOpenPosition);
      if (!trimmed) return open.slice(0, 6);
      const q = trimmed.toLowerCase();
      return open
        .filter((e) => {
          const dept = (e as { departmentName?: string | null }).departmentName ?? "";
          return (
            (e.title || "").toLowerCase().includes(q) ||
            dept.toLowerCase().includes(q)
          );
        })
        .slice(0, 6);
    }
    if (serverResults?.openPositions) return serverResults.openPositions;
    return [];
  }, [employees, serverResults, trimmed]);

  // We control filtering ourselves (results come from cached lists or the
  // server), so disable cmdk's internal scoring.
  return (
    <CommandDialog open={isOpen} onOpenChange={(o) => (o ? null : close())}>
      <DialogTitle className="sr-only">{t("palette.placeholder")}</DialogTitle>
      <DialogDescription className="sr-only">{t("palette.noResults")}</DialogDescription>
      <CommandInput
        placeholder={t("palette.placeholder")}
        value={query}
        onValueChange={setQuery}
        data-testid="input-command-palette"
      />
      {isPaletteSearching && (
        <div
          className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground"
          data-testid="palette-searching-indicator"
          aria-live="polite"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("palette.searching")}
        </div>
      )}
      <CommandListInner
        emptyLabel={
          isPaletteSearching ? t("palette.searching") : t("palette.noResults")
        }
      >
        {!trimmed && recents.length > 0 && (
          <>
            <CommandGroup heading={t("palette.recents")}>
              {recents.map((r) => (
                <CommandItem
                  key={`recent-${r.kind}-${r.id}`}
                  value={`recent-${r.kind}-${r.id}-${r.label}`}
                  onSelect={() => {
                    if (r.kind === "employee") {
                      const id = Number(r.id);
                      if (!Number.isNaN(id)) {
                        handleSelectEmployee({
                          id,
                          firstName: r.label,
                          lastName: "",
                          title: r.sublabel ?? null,
                        });
                      }
                    } else if (r.kind === "department") {
                      handleSelectDepartment({ id: Number(r.id), name: r.label });
                    } else if (r.kind === "administration") {
                      handleSelectAdministration({ id: Number(r.id), name: r.label });
                    } else if (r.kind === "chart") {
                      handleSelectChart({ id: Number(r.id), name: r.label });
                    } else if (r.kind === "snapshot") {
                      handleSelectSnapshot({ id: Number(r.id), name: r.label });
                    } else if (r.kind === "savedView") {
                      const payload = (r.payload ?? {}) as {
                        chartScope?: string;
                        departmentIds?: number[];
                        administrationIds?: number[];
                      };
                      handleSelectSavedView({
                        id: Number(r.id),
                        name: r.label,
                        chartScope: payload.chartScope ?? "full",
                        departmentIds: payload.departmentIds,
                        administrationIds: payload.administrationIds,
                      });
                    } else if (r.kind === "openPosition") {
                      handleSelectOpenPosition({
                        id: Number(r.id),
                        title: r.label,
                        departmentName: r.sublabel ?? null,
                      });
                    } else if (r.kind === "page") {
                      const tabMatch = /^\/settings#(.+)$/.exec(r.id);
                      if (tabMatch) {
                        handleSelectSettings({ tab: tabMatch[1], label: r.label });
                      } else {
                        handleSelectPage({ href: r.id, label: r.label });
                      }
                    }
                  }}
                  data-testid={`palette-recent-${r.kind}-${r.id}`}
                >
                  <Clock />
                  <span className="truncate">{r.label}</span>
                  {r.sublabel ? (
                    <span className="ms-auto text-xs text-muted-foreground truncate">{r.sublabel}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {trimmed.length > 0 && (
          <CommandGroup heading={t("palette.ask")}>
            <CommandItem
              key="ask-question"
              value={`ask-${trimmed}`}
              onSelect={() => handleAsk(trimmed)}
              data-testid="palette-ask-item"
            >
              <Sparkles />
              <span className="truncate">{t("palette.askQuestion", { q: trimmed })}</span>
              <span className="ms-auto text-xs text-muted-foreground">
                {t("palette.askHint")}
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        {filteredEmployees.length > 0 && (
          <CommandGroup heading={t("palette.employees")}>
            {filteredEmployees.map((e) => {
              const fullName = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
              const sub = e.title || e.email || "";
              return (
                <CommandItem
                  key={`emp-${e.id}`}
                  value={`emp-${e.id}-${fullName}-${sub}`}
                  onSelect={() => handleSelectEmployee(e)}
                  data-testid={`palette-employee-${e.id}`}
                >
                  <Users />
                  <span className="truncate">{fullName || t("palette.unnamed")}</span>
                  {sub ? (
                    <span className="ms-auto text-xs text-muted-foreground truncate">{sub}</span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {filteredOpenPositions.length > 0 && (
          <CommandGroup heading={t("palette.openPositions")}>
            {filteredOpenPositions.map((p) => {
              const sub =
                (p as { departmentName?: string | null }).departmentName ?? "";
              return (
                <CommandItem
                  key={`open-${p.id}`}
                  value={`open-${p.id}-${p.title}-${sub}`}
                  onSelect={() =>
                    handleSelectOpenPosition({
                      id: p.id,
                      title: p.title || "",
                      departmentName: sub || null,
                    })
                  }
                  data-testid={`palette-open-position-${p.id}`}
                >
                  <Briefcase />
                  <span className="truncate">
                    {p.title || t("palette.unnamedPosition", { defaultValue: "Open position" })}
                  </span>
                  {sub ? (
                    <span className="ms-auto text-xs text-muted-foreground truncate">{sub}</span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {trimmed && (serverResults?.personalNotes?.length ?? 0) > 0 && (
          <CommandGroup heading={t("personalNotes.paletteHeading")}>
            {serverResults!.personalNotes.map((n) => (
              <CommandItem
                key={`pnote-${n.id}`}
                value={`pnote-${n.id}-${n.employeeName}-${n.snippet}`}
                onSelect={() =>
                  handleSelectEmployee({
                    id: n.employeeId,
                    firstName: n.employeeName,
                    lastName: "",
                    title: null,
                  })
                }
                data-testid={`palette-personal-note-${n.id}`}
              >
                <StickyNote />
                <span className="truncate">{n.employeeName}</span>
                {n.snippet ? (
                  <span className="ms-auto text-xs text-muted-foreground truncate">
                    {n.snippet}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredDepartments.length > 0 && (
          <CommandGroup heading={t("palette.departments")}>
            {filteredDepartments.map((d) => (
              <CommandItem
                key={`dept-${d.id}`}
                value={`dept-${d.id}-${d.name}`}
                onSelect={() => handleSelectDepartment(d)}
                data-testid={`palette-department-${d.id}`}
              >
                <Building2 />
                <span className="truncate">{d.name}</span>
                <span className="ms-auto text-xs text-muted-foreground">
                  {t("palette.filterChart")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredAdministrations.length > 0 && (
          <CommandGroup heading={t("palette.administrations")}>
            {filteredAdministrations.map((a) => (
              <CommandItem
                key={`adm-${a.id}`}
                value={`adm-${a.id}-${a.name}`}
                onSelect={() => handleSelectAdministration(a)}
                data-testid={`palette-administration-${a.id}`}
              >
                <Landmark />
                <span className="truncate">{a.name}</span>
                <span className="ms-auto text-xs text-muted-foreground">
                  {t("palette.filterChart")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredCharts.length > 0 && (
          <CommandGroup heading={t("palette.charts")}>
            {filteredCharts.map((c) => (
              <CommandItem
                key={`chart-${c.id}`}
                value={`chart-${c.id}-${c.name}`}
                onSelect={() =>
                  handleSelectChart({ id: c.id, name: c.name, type: c.type })
                }
                data-testid={`palette-chart-${c.id}`}
              >
                <Network />
                <span className="truncate">{c.name}</span>
                <span className="ms-auto text-xs text-muted-foreground">
                  {t("palette.openChart")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredSnapshots.length > 0 && (
          <CommandGroup heading={t("palette.snapshots")}>
            {filteredSnapshots.map((s) => (
              <CommandItem
                key={`snap-${s.id}`}
                value={`snap-${s.id}-${s.name}`}
                onSelect={() => handleSelectSnapshot({ id: s.id, name: s.name })}
                data-testid={`palette-snapshot-${s.id}`}
              >
                <Camera />
                <span className="truncate">{s.name}</span>
                <span className="ms-auto text-xs text-muted-foreground">
                  {t("palette.openSnapshot")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredSavedViews.length > 0 && (
          <CommandGroup heading={t("palette.savedViews")}>
            {filteredSavedViews.map((v) => (
              <CommandItem
                key={`view-${v.id}`}
                value={`view-${v.id}-${v.name}`}
                onSelect={() =>
                  handleSelectSavedView({
                    id: v.id,
                    name: v.name,
                    chartScope: v.chartScope,
                    departmentIds: v.departmentIds,
                    administrationIds: v.administrationIds,
                  })
                }
                data-testid={`palette-saved-view-${v.id}`}
              >
                <Filter />
                <span className="truncate">{v.name}</span>
                <span className="ms-auto text-xs text-muted-foreground">
                  {t("palette.applyFilterView")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading={t("palette.pages")}>
          {navRoutes.map((r) => {
            const Icon = r.icon;
            const value = `page-${r.href}-${r.label}-${(r.keywords ?? []).join(" ")}`;
            return (
              <CommandItem
                key={`page-${r.href}`}
                value={value}
                onSelect={() => handleSelectPage(r)}
                data-testid={`palette-page-${r.href}`}
              >
                <Icon />
                <span className="truncate">{r.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {settingsRoutes.length > 0 && (
          <CommandGroup heading={t("palette.settings")}>
            {settingsRoutes.map((r) => {
              const Icon = r.icon;
              return (
                <CommandItem
                  key={`settings-${r.tab}`}
                  value={`settings-${r.tab}-${r.label}`}
                  onSelect={() => handleSelectSettings(r)}
                  data-testid={`palette-settings-${r.tab}`}
                >
                  <Icon />
                  <span className="truncate">{r.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandListInner>
    </CommandDialog>
  );
}

function CommandListInner({
  emptyLabel,
  children,
}: {
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <CommandList>
      <CommandEmpty>{emptyLabel}</CommandEmpty>
      {children}
    </CommandList>
  );
}
