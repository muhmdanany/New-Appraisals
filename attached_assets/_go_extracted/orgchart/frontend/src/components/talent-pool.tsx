import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolvePhotoUrl } from "@/lib/photo-url";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Search,
  GripVertical,
  UserPlus,
  Users,
  Filter,
  Briefcase,
  Building2,
} from "lucide-react";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  avatarUrl?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  departmentColor?: string | null;
  managerId?: number | null;
}

interface Department {
  id: number;
  name: string;
  color?: string | null;
}

interface ManagerOption {
  id: number;
  name: string;
  title?: string | null;
}

type TabType = "all" | "unassigned" | "assigned";

const TALENT_POOL_INITIAL_VISIBLE = 80;
const TALENT_POOL_VISIBLE_STEP = 80;

interface TalentPoolProps {
  employees: Employee[];
  departments: Department[];
  isOpen: boolean;
  onClose: () => void;
  onDragStart: (id: number, name: string) => void;
  onDragEnd?: () => void;
  managers?: ManagerOption[];
  onAddEmployee?: () => void;
  onAddToChart?: (employeeId: number, managerId?: number | null) => void;
  onDropFromChart?: (employeeId: number) => void;
}

export function TalentPool({
  employees,
  departments,
  isOpen,
  onClose,
  onDragStart,
  onDragEnd,
  managers = [],
  onAddEmployee,
  onAddToChart,
  onDropFromChart,
}: TalentPoolProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [visibleLimit, setVisibleLimit] = useState(TALENT_POOL_INITIAL_VISIBLE);
  const [targetManagerId, setTargetManagerId] = useState<number | null>(null);
  const [managerSearch, setManagerSearch] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onDropFromChart) return;
      if (!e.dataTransfer.types.includes("application/x-org-chart")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDropTarget(true);
    },
    [onDropFromChart]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDropTarget(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setIsDropTarget(false);
      if (!onDropFromChart) return;
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw || raw.startsWith("talent:")) return;
      const id = parseInt(raw, 10);
      if (!Number.isNaN(id)) {
        e.preventDefault();
        e.stopPropagation();
        onDropFromChart(id);
      }
    },
    [onDropFromChart]
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 350);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (activeTab === "unassigned") {
      list = list.filter((e) => !e.managerId);
    } else if (activeTab === "assigned") {
      list = list.filter((e) => !!e.managerId);
    }

    if (departmentFilter !== "all") {
      if (departmentFilter === "none") {
        list = list.filter((e) => !e.departmentId);
      } else {
        list = list.filter((e) => e.departmentId === Number(departmentFilter));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.title?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [employees, activeTab, search, departmentFilter]);

  useEffect(() => {
    setVisibleLimit(TALENT_POOL_INITIAL_VISIBLE);
  }, [activeTab, departmentFilter, search, employees.length, isOpen]);

  const visibleEmployees = useMemo(
    () => filteredEmployees.slice(0, visibleLimit),
    [filteredEmployees, visibleLimit]
  );

  const remainingCount = Math.max(0, filteredEmployees.length - visibleEmployees.length);
  const nextBatchCount = Math.min(TALENT_POOL_VISIBLE_STEP, remainingCount);

  const targetManager = useMemo(
    () => managers.find((manager) => manager.id === targetManagerId) ?? null,
    [managers, targetManagerId]
  );

  useEffect(() => {
    if (targetManagerId !== null && !targetManager) {
      setTargetManagerId(null);
    }
  }, [targetManagerId, targetManager]);

  const managerMatches = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return [];
    return managers
      .filter((manager) =>
        manager.name.toLowerCase().includes(q) ||
        manager.title?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [managerSearch, managers]);

  const counts = useMemo(() => {
    const all = employees.length;
    const unassigned = employees.filter((e) => !e.managerId).length;
    const assigned = employees.filter((e) => !!e.managerId).length;
    return { all, unassigned, assigned };
  }, [employees]);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "all", label: t("orgChart.talentPoolAll"), count: counts.all },
    {
      key: "unassigned",
      label: t("orgChart.talentPoolUnassigned"),
      count: counts.unassigned,
    },
    {
      key: "assigned",
      label: t("orgChart.talentPoolAssigned"),
      count: counts.assigned,
    },
  ];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t("orgChart.talentPool")}
      aria-hidden={!isOpen}
      tabIndex={-1}
      className={`fixed top-0 end-0 h-full z-40 transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
      }`}
      style={{ width: "380px" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="talent-pool-panel"
    >
      <div
        className={`h-full bg-card border-s shadow-2xl flex flex-col transition-colors ${
          isDropTarget ? "border-primary ring-2 ring-primary/40" : "border-border"
        }`}
      >
        {isDropTarget && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 backdrop-blur-[2px] pointer-events-none"
            data-testid="talent-pool-drop-overlay"
          >
            <div className="bg-card border-2 border-dashed border-primary rounded-xl px-5 py-4 shadow-lg flex flex-col items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              <p className="text-sm font-semibold text-primary text-center">
                {t("orgChart.dropToTalentPool")}
              </p>
            </div>
          </div>
        )}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white" id="talent-pool-title">
              {t("orgChart.talentPool")}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex border-b border-border" role="tablist" aria-label={t("orgChart.talentPool")}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-purple-700 dark:text-purple-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`ms-1 text-[10px] ${
                  activeTab === tab.key
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-muted-foreground/60"
                }`}
              >
                {tab.count}
              </span>
              {activeTab === tab.key && (
                <div className="absolute bottom-0 inset-x-2 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-3 space-y-2 border-b border-border">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("orgChart.talentPoolSearch")}
              aria-label={t("orgChart.talentPoolSearch")}
              className="ps-9 h-9 text-sm"
              data-testid="talent-pool-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <SelectTrigger className="h-8 text-xs" aria-label={t("employees.allDepartments")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("employees.allDepartments")}
                </SelectItem>
                <SelectItem value="none">
                  {t("orgChart.noDepartment")}
                </SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    <div className="flex items-center gap-1.5">
                      {d.color && (
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                      )}
                      <span>{d.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onAddEmployee && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={onAddEmployee}
                    aria-label={t("employees.addEmployee")}
                    data-testid="talent-pool-add"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("employees.addEmployee")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="px-3 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1" aria-hidden="true">
          <GripVertical className="h-3 w-3" />
          {t("orgChart.talentPoolDragHint")}
        </div>

        {onAddToChart && managers.length > 0 && (
          <div className="mx-3 mb-2 rounded-md border border-border bg-muted/30 p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-foreground">
                {t("orgChart.targetManager")}
              </p>
              {targetManager && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    setTargetManagerId(null);
                    setManagerSearch("");
                  }}
                  data-testid="talent-pool-clear-target-manager"
                >
                  {t("orgChart.clearTargetManager")}
                </Button>
              )}
            </div>
            {targetManager ? (
              <div className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs">
                <Users className="h-3.5 w-3.5 text-purple-600" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{targetManager.name}</p>
                  {targetManager.title && (
                    <p className="truncate text-[11px] text-muted-foreground">{targetManager.title}</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Input
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  placeholder={t("orgChart.searchTargetManager")}
                  aria-label={t("orgChart.searchTargetManager")}
                  className="h-8 text-xs"
                  data-testid="talent-pool-manager-search"
                />
                {managerMatches.length > 0 && (
                  <div className="mt-1 max-h-36 overflow-auto rounded-md border border-border bg-background">
                    {managerMatches.map((manager) => (
                      <button
                        key={manager.id}
                        type="button"
                        className="flex w-full items-start gap-2 px-2 py-1.5 text-start text-xs hover:bg-muted"
                        onClick={() => {
                          setTargetManagerId(manager.id);
                          setManagerSearch("");
                        }}
                        data-testid={`talent-pool-target-manager-${manager.id}`}
                      >
                        <Users className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-purple-600" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{manager.name}</span>
                          {manager.title && (
                            <span className="block truncate text-[11px] text-muted-foreground">{manager.title}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="px-2 pb-3" role="list" aria-label={t("orgChart.talentPool")}>
            {filteredEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 opacity-20 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium">
                  {t("orgChart.talentPoolEmpty")}
                </p>
                <p className="text-xs mt-1">
                  {t("orgChart.talentPoolEmptyDesc")}
                </p>
              </div>
            ) : (
              visibleEmployees.map((emp) => {
                const initials = `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`;
                const fullName = `${emp.firstName} ${emp.lastName}`.trim();
                return (
                  <div
                    key={emp.id}
                    role="listitem"
                    className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-muted/60 transition-colors cursor-grab active:cursor-grabbing group"
                    draggable
                    aria-label={`${emp.firstName} ${emp.lastName} — ${emp.title}`}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", "talent:" + String(emp.id));
                      e.dataTransfer.setData("application/x-talent-pool", "1");
                      onDragStart(
                        emp.id,
                        fullName
                      );
                    }}
                    onDragEnd={onDragEnd}
                    data-testid={`talent-pool-employee-${emp.id}`}
                  >
                    <div className="pt-2 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" aria-hidden="true">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                      <AvatarImage
                        src={resolvePhotoUrl(emp.avatarUrl)}
                        alt={fullName}
                      />
                      <AvatarFallback
                        className="text-[11px] font-semibold"
                        style={{
                          backgroundColor: emp.departmentColor
                            ? `${emp.departmentColor}20`
                            : undefined,
                          color: emp.departmentColor || undefined,
                        }}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                        <Briefcase className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{emp.title}</span>
                      </div>
                      {onAddToChart && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 w-fit gap-1.5 rounded-md border-purple-200 bg-purple-50 px-2 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 hover:text-purple-800 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-950/50"
                          draggable={false}
                          onPointerDown={(e) => e.stopPropagation()}
                          onDragStart={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onAddToChart(emp.id, targetManagerId);
                          }}
                          aria-label={
                            targetManager
                              ? t("orgChart.addUnderTargetManagerFor", {
                                  employee: fullName,
                                  manager: targetManager.name,
                                })
                              : t("orgChart.addToStructureFor", { name: fullName })
                          }
                          data-testid={`talent-pool-add-to-chart-${emp.id}`}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>
                            {targetManager
                              ? t("orgChart.addUnderSelectedManager")
                              : t("orgChart.addToStructure")}
                          </span>
                        </Button>
                      )}
                    </div>
                    {emp.departmentName && (
                      <Badge
                        variant="secondary"
                        className="mt-1 text-[10px] px-1.5 py-0 h-5 flex-shrink-0 max-w-[80px] truncate"
                        style={{
                          backgroundColor: emp.departmentColor
                            ? `${emp.departmentColor}15`
                            : undefined,
                          color: emp.departmentColor || undefined,
                          borderColor: emp.departmentColor
                            ? `${emp.departmentColor}30`
                            : undefined,
                        }}
                      >
                        <Building2 className="h-2.5 w-2.5 me-0.5 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{emp.departmentName}</span>
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
            {remainingCount > 0 && (
              <div className="px-3 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full text-xs"
                  onClick={() => setVisibleLimit((limit) => limit + TALENT_POOL_VISIBLE_STEP)}
                  data-testid="talent-pool-load-more"
                >
                  {t("orgChart.talentPoolLoadMore", { count: nextBatchCount })}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {remainingCount > 0
              ? t("orgChart.talentPoolShowing", {
                  shown: visibleEmployees.length,
                  total: filteredEmployees.length,
                })
              : t("orgChart.talentPoolCount", {
                  count: filteredEmployees.length,
                })}
          </p>
        </div>
      </div>
    </div>
  );
}
