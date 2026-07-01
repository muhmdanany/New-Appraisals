import { useState, useMemo, useCallback } from "react";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import {
  useListCharts,
  useCreateChart,
  useUpdateChart,
  useDeleteChart,
  getListChartsQueryKey,
  useListEmployees,
  useListDepartments,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
} from "@workspace/api-client-react";
import { PeopleTab } from "@/components/org-space/PeopleTab";
import { UsersTab } from "@/components/org-space/UsersTab";
import { FieldsTab } from "@/components/org-space/FieldsTab";
import { BackupsTab } from "@/components/org-space/BackupsTab";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Edit2,
  Trash2,
  Copy,
  Download,
  Printer,
  Search,
  Plus,
  Network,
  Building2,
  Briefcase,
  LayoutGrid,
  Calendar,
  Users,
  FileSpreadsheet,
} from "lucide-react";
import { Link } from "wouter";

export default function OrgSpacePage() {
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedCharts, setSelectedCharts] = useState<Set<number>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<{
    id: number;
    name: string;
    description: string | null;
    type: string;
    rootEmployeeId: number | null;
    departmentId: number | null;
  } | null>(null);
  const [chartForm, setChartForm] = useState({
    name: "",
    description: "",
    type: "company" as string,
    rootEmployeeId: null as number | null,
    departmentId: null as number | null,
  });
  const [chartToDelete, setChartToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"charts" | "people" | "users" | "fields" | "backups">("charts");

  const { data: charts, isLoading } = useListCharts(selectedOrgId!, {
    query: {
      enabled: !!selectedOrgId,
      queryKey: getListChartsQueryKey(selectedOrgId!),
    },
  });

  const { data: employees } = useListEmployees(selectedOrgId!, {}, {
    query: {
      enabled: !!selectedOrgId,
      queryKey: getListEmployeesQueryKey(selectedOrgId!),
    },
  });

  const { data: departments } = useListDepartments(selectedOrgId!, {
    query: {
      enabled: !!selectedOrgId,
      queryKey: getListDepartmentsQueryKey(selectedOrgId!),
    },
  });

  const createMutation = useCreateChart({
    mutation: {
      onSuccess: () => {
        if (selectedOrgId)
          queryClient.invalidateQueries({
            queryKey: getListChartsQueryKey(selectedOrgId),
          });
        setIsDialogOpen(false);
        showToast(t("orgChart.chartCreated"));
      },
    },
  });

  const updateMutation = useUpdateChart({
    mutation: {
      onSuccess: () => {
        if (selectedOrgId)
          queryClient.invalidateQueries({
            queryKey: getListChartsQueryKey(selectedOrgId),
          });
        setIsDialogOpen(false);
        setEditingChart(null);
        showToast(t("orgChart.chartUpdated"));
      },
    },
  });

  const deleteMutation = useDeleteChart({
    mutation: {
      onSuccess: () => {
        if (selectedOrgId)
          queryClient.invalidateQueries({
            queryKey: getListChartsQueryKey(selectedOrgId),
          });
        setChartToDelete(null);
        setSelectedCharts(new Set());
        showToast(t("orgChart.chartDeleted"));
      },
    },
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const filteredCharts = useMemo(() => {
    if (!charts) return [];
    if (!search.trim()) return charts;
    const q = search.toLowerCase();
    return charts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
    );
  }, [charts, search]);

  const openCreate = useCallback(() => {
    setEditingChart(null);
    setChartForm({
      name: "",
      description: "",
      type: "company",
      rootEmployeeId: null,
      departmentId: null,
    });
    setIsDialogOpen(true);
  }, []);

  const openEdit = useCallback(
    (chart: (typeof filteredCharts)[0]) => {
      setEditingChart({
        id: chart.id,
        name: chart.name,
        description: chart.description || null,
        type: chart.type,
        rootEmployeeId: chart.rootEmployeeId ?? null,
        departmentId: chart.departmentId ?? null,
      });
      setChartForm({
        name: chart.name,
        description: chart.description || "",
        type: chart.type,
        rootEmployeeId: chart.rootEmployeeId ?? null,
        departmentId: chart.departmentId ?? null,
      });
      setIsDialogOpen(true);
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!selectedOrgId || !chartForm.name.trim()) return;
    const payload = {
      name: chartForm.name.trim(),
      description: chartForm.description.trim() || undefined,
      type: chartForm.type as "company" | "department" | "management",
      rootEmployeeId: chartForm.rootEmployeeId || undefined,
      departmentId: chartForm.departmentId || undefined,
    };
    if (editingChart) {
      updateMutation.mutate({
        orgId: selectedOrgId,
        chartId: editingChart.id,
        data: payload,
      });
    } else {
      createMutation.mutate({ orgId: selectedOrgId, data: payload });
    }
  }, [
    selectedOrgId,
    chartForm,
    editingChart,
    createMutation,
    updateMutation,
  ]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedCharts.size === 1) {
      const id = Array.from(selectedCharts)[0];
      const chart = charts?.find((c) => c.id === id);
      if (chart)
        setChartToDelete({ id: chart.id, name: chart.name });
    }
  }, [selectedCharts, charts]);

  const toggleSelectAll = useCallback(() => {
    if (!filteredCharts) return;
    if (selectedCharts.size === filteredCharts.length) {
      setSelectedCharts(new Set());
    } else {
      setSelectedCharts(new Set(filteredCharts.map((c) => c.id)));
    }
  }, [filteredCharts, selectedCharts]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedCharts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getChartTypeLabel = (type: string) => {
    if (type === "department") return t("orgChart.chartTypeDepartment");
    if (type === "management") return t("orgChart.chartTypeManagement");
    return t("orgChart.chartTypeCompany");
  };

  const getChartTypeIcon = (type: string) => {
    if (type === "department")
      return <Building2 className="h-3.5 w-3.5" />;
    if (type === "management")
      return <Network className="h-3.5 w-3.5" />;
    return <Briefcase className="h-3.5 w-3.5" />;
  };

  const getChartRolesCount = (chart: (typeof filteredCharts)[0]) => {
    if (!employees) return 0;
    if (chart.type === "department" && chart.departmentId) {
      return employees.filter((e) => e.departmentId === chart.departmentId).length;
    }
    if (chart.type === "management" && chart.rootEmployeeId) {
      const countDescendants = (managerId: number): number => {
        const directs = employees.filter((e) => e.managerId === managerId);
        return directs.reduce(
          (sum, d) => sum + 1 + countDescendants(d.id),
          0
        );
      };
      return 1 + countDescendants(chart.rootEmployeeId);
    }
    return employees.length;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleDuplicateChart = useCallback(
    (chart: (typeof filteredCharts)[0]) => {
      if (!selectedOrgId) return;
      createMutation.mutate({
        orgId: selectedOrgId,
        data: {
          name: `${chart.name} (${t("orgSpace.copy")})`,
          description: chart.description || undefined,
          type: chart.type as "company" | "department" | "management",
          rootEmployeeId: chart.rootEmployeeId ?? undefined,
          departmentId: chart.departmentId ?? undefined,
        },
      });
    },
    [selectedOrgId, createMutation, t]
  );

  if (!selectedOrgId) {
    return (
      <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>
    );
  }

  const canEdit = hasPermission("organizations", "edit");

  const TABS = [
    { key: "charts" as const, label: "CHARTS" },
    { key: "people" as const, label: "PEOPLE" },
    { key: "users" as const, label: "USERS" },
    { key: "fields" as const, label: "FIELDS" },
    { key: "backups" as const, label: "BACKUPS" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-2xl font-bold text-foreground"
              data-testid="text-page-title"
            >
              {t("orgSpace.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("orgSpace.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex gap-0 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-semibold tracking-wide border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "people" && (
        <div className="p-6">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <PeopleTab orgId={selectedOrgId} />
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="p-6">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <UsersTab orgId={selectedOrgId} />
          </div>
        </div>
      )}

      {activeTab === "fields" && (
        <div className="p-6">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <FieldsTab orgId={selectedOrgId} />
          </div>
        </div>
      )}

      {activeTab === "backups" && (
        <div className="p-6">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <BackupsTab orgId={selectedOrgId} />
          </div>
        </div>
      )}

      {activeTab === "charts" && (
      <div className="p-6">
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              {canEdit && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        disabled={selectedCharts.size !== 1}
                        onClick={() => {
                          const id = Array.from(selectedCharts)[0];
                          const chart = charts?.find((c) => c.id === id);
                          if (chart) openEdit(chart);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("common.edit")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        disabled={selectedCharts.size !== 1}
                        onClick={handleDeleteSelected}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("common.delete")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        disabled={selectedCharts.size !== 1}
                        onClick={() => {
                          const id = Array.from(selectedCharts)[0];
                          const chart = charts?.find((c) => c.id === id);
                          if (chart) handleDuplicateChart(chart);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("orgSpace.duplicate")}</TooltipContent>
                  </Tooltip>
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={!charts || charts.length === 0}
                    onClick={() => window.print()}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("orgSpace.print")}</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("orgSpace.searchCharts")}
                  className="ps-9 h-9"
                  aria-label={t("orgSpace.searchCharts")}
                  data-testid="search-charts"
                />
              </div>
              {canEdit && (
                <Button
                  onClick={openCreate}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-new-chart"
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t("orgSpace.newChart")}
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredCharts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <LayoutGrid className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg font-medium">
                {charts?.length === 0
                  ? t("orgChart.noChartsYet")
                  : t("orgSpace.noChartsMatch")}
              </p>
              <p className="text-sm mt-1">
                {charts?.length === 0
                  ? t("orgChart.createFirstChart")
                  : t("orgSpace.tryAdjusting")}
              </p>
              {charts?.length === 0 && canEdit && (
                <Button
                  onClick={openCreate}
                  className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t("orgSpace.newChart")}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        filteredCharts.length > 0 &&
                        selectedCharts.size === filteredCharts.length
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label={t("orgSpace.selectAll")}
                    />
                  </TableHead>
                  <TableHead>{t("orgSpace.chartName")}</TableHead>
                  <TableHead>{t("orgSpace.lastUpdated")}</TableHead>
                  <TableHead className="text-center">
                    {t("orgSpace.totalRoles")}
                  </TableHead>
                  <TableHead>{t("orgSpace.chartType")}</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCharts.map((chart) => (
                  <TableRow
                    key={chart.id}
                    className={`cursor-pointer transition-colors ${
                      selectedCharts.has(chart.id) ? "bg-muted/50" : ""
                    }`}
                    onClick={() => toggleSelect(chart.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedCharts.has(chart.id)}
                        onCheckedChange={() => toggleSelect(chart.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={chart.name}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {chart.name}
                        </span>
                        {chart.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {chart.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(chart.updatedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono">
                        {getChartRolesCount(chart)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="gap-1"
                      >
                        {getChartTypeIcon(chart.type)}
                        {getChartTypeLabel(chart.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href="/org-chart">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Network className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(chart);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChartToDelete({
                                  id: chart.id,
                                  name: chart.name,
                                });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {t("orgSpace.totalCharts", {
                  count: charts?.length || 0,
                })}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {t("orgSpace.totalEmployees", {
                  count: employees?.length || 0,
                })}
              </span>
            </div>
            {selectedCharts.size > 0 && (
              <span>
                {t("orgSpace.selected", { count: selectedCharts.size })}
              </span>
            )}
          </div>
        </div>
      </div>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDialogOpen(false);
            setEditingChart(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingChart
                ? t("orgChart.editChart")
                : t("orgChart.createChart")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("orgChart.chartName")}</Label>
              <Input
                value={chartForm.name}
                onChange={(e) =>
                  setChartForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("orgChart.chartName")}
                data-testid="input-chart-name"
              />
            </div>
            <div>
              <Label>{t("orgChart.chartDescription")}</Label>
              <Input
                value={chartForm.description}
                onChange={(e) =>
                  setChartForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                placeholder={t("orgChart.chartDescription")}
              />
            </div>
            <div>
              <Label>{t("orgChart.chartType")}</Label>
              <Select
                value={chartForm.type}
                onValueChange={(v) =>
                  setChartForm((f) => ({
                    ...f,
                    type: v,
                    rootEmployeeId: null,
                    departmentId: null,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">
                    {t("orgChart.chartTypeCompany")}
                  </SelectItem>
                  <SelectItem value="department">
                    {t("orgChart.chartTypeDepartment")}
                  </SelectItem>
                  <SelectItem value="management">
                    {t("orgChart.chartTypeManagement")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {chartForm.type === "department" && (
              <div>
                <Label>{t("orgChart.selectDepartmentForChart")}</Label>
                <Select
                  value={
                    chartForm.departmentId
                      ? String(chartForm.departmentId)
                      : "none"
                  }
                  onValueChange={(v) =>
                    setChartForm((f) => ({
                      ...f,
                      departmentId: v === "none" ? null : Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("orgChart.noDepartment")}
                    </SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {chartForm.type === "management" && (
              <div>
                <Label>{t("orgChart.selectRootEmployee")}</Label>
                <Select
                  value={
                    chartForm.rootEmployeeId
                      ? String(chartForm.rootEmployeeId)
                      : "none"
                  }
                  onValueChange={(v) =>
                    setChartForm((f) => ({
                      ...f,
                      rootEmployeeId: v === "none" ? null : Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.firstName} {e.lastName} — {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingChart(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !chartForm.name.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t("common.saving")
                  : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!chartToDelete}
        onOpenChange={(open) => {
          if (!open) setChartToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("confirmDialog.areYouSure")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("orgChart.deleteChartDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (chartToDelete && selectedOrgId) {
                  deleteMutation.mutate({
                    orgId: selectedOrgId,
                    chartId: chartToDelete.id,
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirmDialog.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {toast && (
        <div className="fixed bottom-6 end-6 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm shadow-lg animate-in slide-in-from-bottom-2 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
