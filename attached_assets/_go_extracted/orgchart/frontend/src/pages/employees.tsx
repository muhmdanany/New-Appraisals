import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useUploadEmployeePhoto,
  useDeleteEmployeePhoto,
  useListDepartments,
  useListAdministrations,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getListAdministrationsQueryKey,
  getGetOrgDashboardQueryKey,
  getGetOrgChartQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  type Employee,
  useListTags,
  useBulkAssignTag,
  useBulkUnassignTag,
  getListTagsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { OnboardingChecklist } from "@/components/employees/onboarding-checklist";
import { OffboardingChecklist } from "@/components/employees/offboarding-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit2,
  Trash2,
  Grid3X3,
  List,
  UserCircle,
  Upload,
  FileSpreadsheet,
  Loader2,
  Globe,
  Clock,
  Download,
  Cloud,
  Merge as MergeIcon,
  Tag as TagIconLucide,
  X as XIconLucide,
} from "lucide-react";
import { getCountryByCode, countryCodeToFlag } from "@/lib/countries";
import { CountryPicker } from "@/components/country-picker";
import { BulkImportWizard } from "@/components/bulk-import-wizard";
import { EntraImportWizard } from "@/components/entra-import-wizard";
import { GoogleImportWizard } from "@/components/google-import-wizard";
import { HrisImportWizard } from "@/components/hris-import-wizard";
import { FindDuplicatesDialog } from "@/components/find-duplicates-dialog";
import { resolvePhotoUrl } from "@/lib/photo-url";
import { SecondaryManagersField } from "@/components/secondary-managers-field";
import { PhotoCropDialog } from "@/components/photo-crop-dialog";
import { SuccessionPanel } from "@/components/succession-panel";
import { useToast } from "@/hooks/use-toast";

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  startDate: string;
  birthday: string;
  bio: string;
  nationality: string;
  administrationId: number | null;
  departmentId: number | null;
  managerId: number | null;
}

interface CustomFieldDef {
  id: number;
  label: string;
  fieldType: string;
  appliesTo: string;
  isRequired: boolean;
  isStandard: boolean;
  isSensitive?: boolean;
  options?: string[] | null;
}

const SENSITIVE_MASK = "••••••••";

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <Label>
      {children}
      <span className="text-destructive ms-1" aria-hidden="true">*</span>
    </Label>
  );
}

function SensitiveFieldReveal({
  orgId,
  employeeId,
  fieldId,
  masked,
}: {
  orgId: number;
  employeeId: number;
  fieldId: number;
  masked: string;
}) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
      const res = await fetch(
        `${apiBase}/organizations/${orgId}/employees/${employeeId}/custom-fields/${fieldId}/reveal`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setError(t("fields.revealError"));
        return;
      }
      const data = await res.json();
      setRevealed(typeof data?.value === "string" ? data.value : "");
    } catch {
      setError(t("fields.revealError"));
    } finally {
      setLoading(false);
    }
  };

  if (revealed !== null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground break-all" data-testid={`sensitive-revealed-${fieldId}`}>
          {revealed || "—"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setRevealed(null)}
          data-testid={`button-hide-sensitive-${fieldId}`}
        >
          {t("fields.hide")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-foreground tracking-widest">{masked}</span>
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs"
        onClick={handleReveal}
        disabled={loading}
        data-testid={`button-reveal-sensitive-${fieldId}`}
      >
        {loading ? "…" : t("fields.reveal")}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

const defaultFormData: EmployeeFormData = {
  firstName: "",
  lastName: "",
  title: "",
  email: "",
  phone: "",
  location: "",
  startDate: "",
  birthday: "",
  bio: "",
  nationality: "",
  administrationId: null,
  departmentId: null,
  managerId: null,
};

export default function Employees() {
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(defaultFormData);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isEntraImportOpen, setIsEntraImportOpen] = useState(false);
  const [isGoogleImportOpen, setIsGoogleImportOpen] = useState(false);
  const [isHrisImportOpen, setIsHrisImportOpen] = useState(false);
  const [isFindDuplicatesOpen, setIsFindDuplicatesOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkTagId, setBulkTagId] = useState<string>("");
  const { toast } = useToast();
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("entra") === "connected" || params.get("entra") === "error") {
      setIsEntraImportOpen(true);
      params.delete("entra");
      params.delete("message");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    if (params.get("google") === "connected" || params.get("google") === "error") {
      setIsGoogleImportOpen(true);
      params.delete("google");
      params.delete("message");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    const deptParam = params.get("departmentId");
    if (deptParam && /^\d+$/.test(deptParam)) {
      setDeptFilter(deptParam);
    }
    const searchParam = params.get("search");
    if (searchParam) {
      setSearch(searchParam);
    }
    const empParam = params.get("employeeId");
    if (empParam && /^\d+$/.test(empParam)) {
      setDetailId(parseInt(empParam, 10));
    }
    const mgrParam = params.get("managerId");
    if (mgrParam && /^\d+$/.test(mgrParam)) {
      setManagerFilter(parseInt(mgrParam, 10));
    }
  }, []);
  const [editingPhotoUrl, setEditingPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [visibleCustomCols, setVisibleCustomCols] = useState<Set<number>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  useEffect(() => {
    if (!selectedOrgId) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
    fetch(`${base}/organizations/${selectedOrgId}/fields`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list: CustomFieldDef[] = Array.isArray(data) ? data.filter((f: CustomFieldDef) => !f.isStandard) : [];
        setCustomFieldDefs(list);
      })
      .catch(() => setCustomFieldDefs([]));
  }, [selectedOrgId]);

  const deptFilterVal = deptFilter === "all" ? undefined : parseInt(deptFilter, 10);
  const { data: employees, isLoading } = useListEmployees(
    selectedOrgId!,
    { search: search || undefined, departmentId: deptFilterVal, managerId: managerFilter },
    {
      query: {
        enabled: !!selectedOrgId,
        queryKey: getListEmployeesQueryKey(selectedOrgId!, { search: search || undefined, departmentId: deptFilterVal, managerId: managerFilter }),
      },
    }
  );

  const { data: departments } = useListDepartments(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListDepartmentsQueryKey(selectedOrgId!) } }
  );

  const { data: administrations } = useListAdministrations(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListAdministrationsQueryKey(selectedOrgId!) } }
  );

  const { data: orgTags } = useListTags(selectedOrgId!, {
    query: { enabled: !!selectedOrgId, queryKey: getListTagsQueryKey(selectedOrgId!) },
  });

  const bulkAssignMutation = useBulkAssignTag({
    mutation: {
      onSuccess: (_d, vars) => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(selectedOrgId!) });
        queryClient.invalidateQueries({ queryKey: getListTagsQueryKey(selectedOrgId!) });
        queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(selectedOrgId!) });
        toast({ title: t("tags.bulkAssigned", { count: vars.data.employeeIds.length }) });
      },
      onError: (err: unknown) => {
        toast({ title: t("tags.bulkFailed"), description: (err as Error)?.message, variant: "destructive" });
      },
    },
  });
  const bulkUnassignMutation = useBulkUnassignTag({
    mutation: {
      onSuccess: (_d, vars) => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(selectedOrgId!) });
        queryClient.invalidateQueries({ queryKey: getListTagsQueryKey(selectedOrgId!) });
        queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(selectedOrgId!) });
        toast({ title: t("tags.bulkUnassigned", { count: vars.data.employeeIds.length }) });
      },
      onError: (err: unknown) => {
        toast({ title: t("tags.bulkFailed"), description: (err as Error)?.message, variant: "destructive" });
      },
    },
  });

  const handleBulkAssign = () => {
    if (!selectedOrgId || !bulkTagId || selectedIds.size === 0) return;
    bulkAssignMutation.mutate({
      orgId: selectedOrgId,
      tagId: parseInt(bulkTagId, 10),
      data: { employeeIds: Array.from(selectedIds) },
    });
  };
  const handleBulkUnassign = () => {
    if (!selectedOrgId || !bulkTagId || selectedIds.size === 0) return;
    bulkUnassignMutation.mutate({
      orgId: selectedOrgId,
      tagId: parseInt(bulkTagId, 10),
      data: { employeeIds: Array.from(selectedIds) },
    });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(selectedOrgId!) });
  };

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsDialogOpen(false);
        setFormData(defaultFormData);
      },
    },
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsDialogOpen(false);
        setEditingId(null);
        setFormData(defaultFormData);
      },
    },
  });

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setDetailId(null);
      },
    },
  });

  const uploadPhotoMutation = useUploadEmployeePhoto({
    mutation: {
      onSuccess: (res) => {
        setEditingPhotoUrl(res.avatarUrl);
        setPhotoError(null);
        setPendingPhotoFile(null);
        invalidateAll();
      },
      onError: () => setPhotoError(t("employees.photoUploadFailed")),
    },
  });

  const removePhotoMutation = useDeleteEmployeePhoto({
    mutation: {
      onSuccess: () => {
        setEditingPhotoUrl(null);
        setPhotoError(null);
        invalidateAll();
      },
      onError: () => setPhotoError(t("employees.photoUploadFailed")),
    },
  });

  const handlePhotoFileSelected = (file: File | null) => {
    if (!file || !selectedOrgId || !editingId) return;
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError(t("employees.photoTooLarge"));
      return;
    }
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setPhotoError(t("employees.photoTypeUnsupported"));
      return;
    }
    setPhotoError(null);
    setPendingPhotoFile(file);
  };

  const handleCroppedPhoto = (file: File) => {
    if (!selectedOrgId || !editingId) return;
    uploadPhotoMutation.mutate({ orgId: selectedOrgId, id: editingId, data: { file } });
  };

  const handleSubmit = () => {
    if (!selectedOrgId) return;
    for (const f of customFieldDefs) {
      if (f.isRequired && !(customFieldValues[String(f.id)] || "").trim()) {
        return;
      }
    }
    const data = {
      ...formData,
      administrationId: formData.administrationId || null,
      departmentId: formData.departmentId || null,
      managerId: formData.managerId || null,
      phone: formData.phone || null,
      location: formData.location || null,
      startDate: formData.startDate || null,
      birthday: formData.birthday || null,
      bio: formData.bio || null,
      nationality: formData.nationality || null,
      customFields: customFieldValues,
    };

    if (editingId) {
      updateMutation.mutate({ orgId: selectedOrgId, id: editingId, data });
    } else {
      createMutation.mutate({ orgId: selectedOrgId, data });
    }
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditingPhotoUrl(emp.avatarUrl ?? null);
    setPhotoError(null);
    setCustomFieldValues(emp.customFields || {});
    setFormData({
      firstName: emp.firstName,
      lastName: emp.lastName,
      title: emp.title,
      email: emp.email,
      phone: emp.phone || "",
      location: emp.location || "",
      startDate: emp.startDate || "",
      birthday: emp.birthday || "",
      bio: emp.bio || "",
      nationality: emp.nationality || "",
      administrationId: emp.administrationId ?? null,
      departmentId: emp.departmentId ?? null,
      managerId: emp.managerId ?? null,
    });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setEditingPhotoUrl(null);
    setPhotoError(null);
    setCustomFieldValues({});
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const handleExportCsv = () => {
    if (!selectedOrgId) return;
    const url = `${API_BASE}/organizations/${selectedOrgId}/employees/export`;
    window.open(url, "_blank");
  };


  const deptMap = new Map(departments?.map(d => [d.id, d]) ?? []);
  const selectedEmployee = detailId ? employees?.find(e => e.id === detailId) : null;

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  const empCount = employees?.length ?? 0;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-6 pb-0">
          <div className="flex items-start sm:items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{t("employees.title")}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {empCount !== 1 ? t("employees.employeeCount_plural", { count: empCount }) : t("employees.employeeCount", { count: empCount })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {hasPermission("employees", "create") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} data-testid="button-import-csv">
                      <FileSpreadsheet className="h-4 w-4 me-2" />
                      {t("bulkImport.button")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("bulkImport.tooltip")}</TooltipContent>
                </Tooltip>
              )}
              {hasPermission("employees", "create") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setIsEntraImportOpen(true)} data-testid="button-import-entra">
                      <Cloud className="h-4 w-4 me-2" />
                      {t("entraImport.button")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("entraImport.tooltip")}</TooltipContent>
                </Tooltip>
              )}
              {hasPermission("employees", "create") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setIsGoogleImportOpen(true)} data-testid="button-import-google">
                      <Cloud className="h-4 w-4 me-2" />
                      {t("googleImport.button")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("googleImport.tooltip")}</TooltipContent>
                </Tooltip>
              )}
              {hasPermission("employees", "create") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setIsHrisImportOpen(true)} data-testid="button-import-hris">
                      <Cloud className="h-4 w-4 me-2" />
                      {t("hrisImport.button")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("hrisImport.tooltip")}</TooltipContent>
                </Tooltip>
              )}
              {hasPermission("employees", "edit") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => setIsFindDuplicatesOpen(true)}
                      data-testid="button-find-duplicates"
                    >
                      <MergeIcon className="h-4 w-4 me-2" />
                      {t("existingDuplicates.button")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("existingDuplicates.tooltip")}</TooltipContent>
                </Tooltip>
              )}
              {hasPermission("employees", "view") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={handleExportCsv} data-testid="button-export-csv">
                      <Download className="h-4 w-4 me-2" />
                      {t("employees.exportCsv")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("employees.exportCsv")}</TooltipContent>
                </Tooltip>
              )}
              {hasPermission("employees", "create") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={openCreate} data-testid="button-add-employee">
                      <Plus className="h-4 w-4 me-2" />
                      {t("employees.addEmployee")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("tooltips.addEmployee")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("employees.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ps-9"
                    data-testid="input-search"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.searchEmployees")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-48" data-testid="select-department-filter">
                    <SelectValue placeholder={t("employees.allDepartments")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("employees.allDepartments")}</SelectItem>
                    {departments?.map(d => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.filterDepartment")}</TooltipContent>
            </Tooltip>
            <div className="flex items-center border border-border rounded-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    data-testid="button-view-grid"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("tooltips.gridView")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("tooltips.listView")}</TooltipContent>
              </Tooltip>
            </div>
            {viewMode === "list" && customFieldDefs.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnsMenuOpen((v) => !v)}
                  data-testid="button-toggle-columns"
                >
                  {t("employees.columns")}
                </Button>
                {columnsMenuOpen && (
                  <div className="absolute end-0 top-full mt-1 z-10 bg-popover border border-border rounded-md shadow-md p-2 min-w-[200px]">
                    {customFieldDefs.map((f) => {
                      const checked = visibleCustomCols.has(f.id);
                      return (
                        <label
                          key={f.id}
                          className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setVisibleCustomCols((prev) => {
                                const next = new Set(prev);
                                if (next.has(f.id)) next.delete(f.id);
                                else next.add(f.id);
                                return next;
                              });
                            }}
                            data-testid={`column-toggle-${f.id}`}
                          />
                          <span>{f.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && hasPermission("employees", "edit") && (orgTags?.length ?? 0) > 0 && (
          <div
            className="mx-4 sm:mx-6 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
            data-testid="bulk-tag-toolbar"
          >
            <TagIconLucide className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {t("tags.bulkAssignTitle", { count: selectedIds.size })}
            </span>
            <Select value={bulkTagId} onValueChange={setBulkTagId}>
              <SelectTrigger className="w-48 h-8" data-testid="bulk-tag-select">
                <SelectValue placeholder={t("tags.selectTag")} />
              </SelectTrigger>
              <SelectContent>
                {orgTags?.map((tg) => (
                  <SelectItem key={tg.id} value={String(tg.id)}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tg.color }} />
                      {tg.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleBulkAssign}
              disabled={!bulkTagId || bulkAssignMutation.isPending}
              data-testid="bulk-tag-assign"
            >
              {t("tags.bulkAssign")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkUnassign}
              disabled={!bulkTagId || bulkUnassignMutation.isPending}
              data-testid="bulk-tag-unassign"
            >
              {t("tags.bulkUnassign")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="ms-auto"
              data-testid="bulk-clear"
            >
              <XIconLucide className="h-3.5 w-3.5 me-1" />
              {t("common.cancel")}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {isLoading ? (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : employees && employees.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map(emp => {
                  const dept = emp.departmentId ? deptMap.get(emp.departmentId) : null;
                  const isSelected = selectedIds.has(emp.id);
                  return (
                    <Card
                      key={emp.id}
                      className={`hover:shadow-md transition-shadow cursor-pointer relative ${isSelected ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setDetailId(emp.id)}
                      data-testid={`card-employee-${emp.id}`}
                    >
                      <CardContent className="p-4">
                        {hasPermission("employees", "edit") && (
                          <input
                            type="checkbox"
                            className="absolute top-2 end-2 h-4 w-4 cursor-pointer z-10"
                            checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(emp.id); }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`select-${emp.id}`}
                            data-testid={`select-employee-${emp.id}`}
                          />
                        )}
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={resolvePhotoUrl(emp.avatarUrl)} />
                            <AvatarFallback
                              className="text-sm font-semibold"
                              style={{
                                backgroundColor: dept ? `${dept.color}20` : undefined,
                                color: dept?.color || undefined,
                              }}
                            >
                              {emp.firstName[0]}{emp.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {emp.nationality && <span className="mr-1">{countryCodeToFlag(emp.nationality)}</span>}
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{emp.title}</p>
                          </div>
                          {!emp.isActive && (
                            <Badge variant="secondary" className="text-[10px]">{t("common.inactive")}</Badge>
                          )}
                        </div>
                        <div className="mt-3 space-y-1">
                          {dept && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                              style={{
                                backgroundColor: `${dept.color}15`,
                                color: dept.color,
                              }}
                            >
                              {dept.name}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                          {emp.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{emp.location}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {employees.map(emp => {
                  const dept = emp.departmentId ? deptMap.get(emp.departmentId) : null;
                  const isSelected = selectedIds.has(emp.id);
                  return (
                    <div
                      key={emp.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${isSelected ? "border-primary bg-primary/5" : "border-border"} hover:bg-muted/50 cursor-pointer transition-colors`}
                      onClick={() => setDetailId(emp.id)}
                      data-testid={`row-employee-${emp.id}`}
                    >
                      {hasPermission("employees", "edit") && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(emp.id); }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`select-${emp.id}`}
                          data-testid={`select-employee-${emp.id}`}
                        />
                      )}
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={resolvePhotoUrl(emp.avatarUrl)} />
                        <AvatarFallback className="text-xs font-semibold">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                        <div>
                          <p className="text-sm font-medium truncate">
                            {emp.nationality && <span className="mr-1">{countryCodeToFlag(emp.nationality)}</span>}
                            {emp.firstName} {emp.lastName}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground truncate">{emp.title}</p>
                        </div>
                        <div>
                          {dept && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                              style={{ backgroundColor: `${dept.color}15`, color: dept.color }}
                            >
                              {dept.name}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                        </div>
                      </div>
                      {visibleCustomCols.size > 0 && (
                        <div className="flex flex-wrap gap-3 ms-3 max-w-md">
                          {customFieldDefs
                            .filter((f) => visibleCustomCols.has(f.id))
                            .map((f) => {
                              const v = emp.customFields?.[String(f.id)] || "";
                              return (
                                <div key={f.id} className="text-xs">
                                  <span className="text-muted-foreground">{f.label}: </span>
                                  <span className={f.isSensitive ? "text-foreground tracking-widest" : "text-foreground"}>
                                    {v || "—"}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <UserCircle className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">{t("employees.noEmployeesFound")}</p>
              <p className="text-sm mt-1">{search ? t("employees.tryAdjusting") : t("employees.addFirst")}</p>
            </div>
          )}
        </div>
      </div>

      {selectedEmployee && (
        <div className="w-80 border-s border-border bg-card overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">{t("employees.employeeDetails")}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDetailId(null)}>
                &times;
              </Button>
            </div>
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar className="h-16 w-16 mb-3">
                <AvatarImage src={resolvePhotoUrl(selectedEmployee.avatarUrl)} />
                <AvatarFallback className="text-lg font-bold">
                  {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <h4 className="text-lg font-bold">
                {selectedEmployee.nationality && <span className="mr-1">{countryCodeToFlag(selectedEmployee.nationality)}</span>}
                {selectedEmployee.firstName} {selectedEmployee.lastName}
              </h4>
              <p className="text-sm text-muted-foreground">{selectedEmployee.title}</p>
              {!selectedEmployee.isActive && (
                <Badge variant="destructive" className="mt-2">{t("common.inactive")}</Badge>
              )}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{selectedEmployee.email}</span>
              </div>
              {selectedEmployee.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEmployee.phone}</span>
                </div>
              )}
              {selectedEmployee.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEmployee.location}</span>
                </div>
              )}
              {selectedEmployee.nationality && (() => {
                const country = getCountryByCode(selectedEmployee.nationality);
                return country ? (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{country.flag} {country.name}</span>
                  </div>
                ) : null;
              })()}
              {selectedEmployee.startDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEmployee.startDate}</span>
                </div>
              )}
              {selectedEmployee.bio && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t("employees.bio")}</p>
                  <p className="text-sm text-foreground">{selectedEmployee.bio}</p>
                </div>
              )}
              {customFieldDefs.length > 0 && (() => {
                const cfValues = selectedEmployee.customFields || {};
                const rendered = customFieldDefs
                  .map((f) => {
                    const raw = cfValues[String(f.id)];
                    if (raw == null || raw === "") return null;
                    let display: string = raw;
                    if (f.fieldType === "boolean") {
                      display = raw === "true" ? t("common.yes") : t("common.no");
                    }
                    return { f, display };
                  })
                  .filter((x): x is { f: CustomFieldDef; display: string } => x !== null);
                if (rendered.length === 0) return null;
                return (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("employees.customFieldsHeader")}
                    </p>
                    {rendered.map(({ f, display }) => (
                      <div key={f.id} data-testid={`detail-custom-${f.id}`}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{f.label}</p>
                        {f.isSensitive ? (
                          <SensitiveFieldReveal
                            orgId={selectedOrgId}
                            employeeId={selectedEmployee.id}
                            fieldId={f.id}
                            masked={display}
                          />
                        ) : f.fieldType === "url" ? (
                          <a
                            href={display}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary underline break-all"
                          >
                            {display}
                          </a>
                        ) : (
                          <p className="text-sm text-foreground break-words">{display}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            {selectedOrgId && hasPermission("employees", "view") && (
              <SuccessionPanel
                orgId={selectedOrgId}
                employee={selectedEmployee}
                allEmployees={employees ?? []}
                canEdit={hasPermission("employees", "edit")}
              />
            )}
            <div className="mt-6 mb-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setLocation(`/employees/${selectedEmployee.id}/timeline`)}
                data-testid="button-view-timeline"
              >
                <Clock className="h-3.5 w-3.5 me-1" />
                {t("employees.viewTimeline")}
              </Button>
            </div>
            {selectedOrgId && (
              <OnboardingChecklist
                orgId={selectedOrgId}
                employeeId={selectedEmployee.id}
                canEdit={hasPermission("employees", "edit")}
              />
            )}
            {selectedOrgId && (
              <OffboardingChecklist
                orgId={selectedOrgId}
                employeeId={selectedEmployee.id}
                canEdit={hasPermission("employees", "edit")}
              />
            )}
            <div className="flex gap-2">
              {hasPermission("employees", "edit") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(selectedEmployee)} data-testid="button-edit-employee">
                      <Edit2 className="h-3.5 w-3.5 me-1" /> {t("common.edit")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("tooltips.editEmployee")}</TooltipContent>
                </Tooltip>
              )}
              {hasPermission("employees", "delete") && (
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          disabled={deleteMutation.isPending}
                          data-testid="button-delete-employee"
                        >
                          <Trash2 className="h-3.5 w-3.5 me-1" /> {t("common.delete")}
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t("tooltips.deleteEmployee")}</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("confirmDialog.deleteEmployeeDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate({ orgId: selectedOrgId, id: selectedEmployee.id })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("confirmDialog.confirmDelete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("employees.editEmployee") : t("employees.addEmployeeTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {editingId && (
              <div>
                <Label>{t("employees.profilePhoto")}</Label>
                <div className="mt-2 flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={resolvePhotoUrl(editingPhotoUrl)} />
                    <AvatarFallback className="text-base font-semibold">
                      {(formData.firstName[0] || "").toUpperCase()}{(formData.lastName[0] || "").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          handlePhotoFileSelected(f);
                          e.target.value = "";
                        }}
                        data-testid="input-employee-photo"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadPhotoMutation.isPending || removePhotoMutation.isPending}
                        data-testid="button-upload-photo"
                      >
                        {uploadPhotoMutation.isPending ? (
                          <><Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />{t("employees.photoUploading")}</>
                        ) : (
                          <><Upload className="h-3.5 w-3.5 me-1" />{editingPhotoUrl ? t("employees.changePhoto") : t("employees.uploadPhoto")}</>
                        )}
                      </Button>
                      {editingPhotoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (selectedOrgId && editingId) {
                              removePhotoMutation.mutate({ orgId: selectedOrgId, id: editingId });
                            }
                          }}
                          disabled={uploadPhotoMutation.isPending || removePhotoMutation.isPending}
                          data-testid="button-remove-photo"
                        >
                          <Trash2 className="h-3.5 w-3.5 me-1" />{t("employees.removePhoto")}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{t("employees.photoHint")}</p>
                    {photoError && (
                      <p className="text-xs text-destructive" data-testid="text-photo-error">{photoError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <RequiredLabel>{t("employees.firstName")}</RequiredLabel>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData(p => ({ ...p, firstName: e.target.value }))}
                  required
                  aria-required="true"
                  data-testid="input-first-name"
                />
              </div>
              <div>
                <RequiredLabel>{t("employees.lastName")}</RequiredLabel>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))}
                  required
                  aria-required="true"
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div>
              <RequiredLabel>{t("employees.jobTitle")}</RequiredLabel>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                required
                aria-required="true"
                data-testid="input-title"
              />
            </div>
            <div>
              <RequiredLabel>{t("employees.email")}</RequiredLabel>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                required
                aria-required="true"
                data-testid="input-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("employees.phone")}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                  data-testid="input-phone"
                />
              </div>
              <div>
                <Label>{t("employees.location")}</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
                  data-testid="input-location"
                />
              </div>
            </div>
            <div>
              <Label>{t("employees.startDate")}</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label>{t("employees.birthday")}</Label>
              <Input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData(p => ({ ...p, birthday: e.target.value }))}
                data-testid="input-birthday"
              />
            </div>
            <div>
              <Label>{t("employees.nationality")}</Label>
              <CountryPicker
                value={formData.nationality}
                onChange={(code) => setFormData(p => ({ ...p, nationality: code }))}
                placeholder={t("employees.selectNationality")}
                searchPlaceholder={t("employees.searchCountry")}
                noResultsText={t("employees.noCountryFound")}
              />
            </div>
            <div>
              <Label>{t("administrations.administration")}</Label>
              <Select
                value={formData.administrationId?.toString() || "none"}
                onValueChange={(val) => setFormData(p => ({ ...p, administrationId: val === "none" ? null : parseInt(val, 10) }))}
              >
                <SelectTrigger data-testid="select-administration">
                  <SelectValue placeholder={t("administrations.selectAdministration")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("administrations.noAdministration")}</SelectItem>
                  {administrations?.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("employees.department")}</Label>
              <Select
                value={formData.departmentId?.toString() || "none"}
                onValueChange={(val) => setFormData(p => ({ ...p, departmentId: val === "none" ? null : parseInt(val, 10) }))}
              >
                <SelectTrigger data-testid="select-department">
                  <SelectValue placeholder={t("employees.selectDepartment")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("employees.noDepartment")}</SelectItem>
                  {(formData.administrationId ? departments?.filter(d => d.administrationId === formData.administrationId) : departments)?.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("employees.manager")}</Label>
              <Select
                value={formData.managerId?.toString() || "none"}
                onValueChange={(val) => setFormData(p => ({ ...p, managerId: val === "none" ? null : parseInt(val, 10) }))}
              >
                <SelectTrigger data-testid="select-manager">
                  <SelectValue placeholder={t("employees.selectManager")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("employees.noManager")}</SelectItem>
                  {employees?.filter(e => e.id !== editingId).map(e => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.firstName} {e.lastName} - {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingId && selectedOrgId && (
              <SecondaryManagersField
                orgId={selectedOrgId}
                employeeId={editingId}
                primaryManagerId={formData.managerId}
                employees={employees}
              />
            )}
            <div>
              <Label>{t("employees.bioLabel")}</Label>
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData(p => ({ ...p, bio: e.target.value }))}
                placeholder={t("employees.bioPlaceholder")}
                data-testid="input-bio"
              />
            </div>
            {customFieldDefs.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("employees.customFieldsHeader")}
                </p>
                {customFieldDefs.map((f) => {
                  const key = String(f.id);
                  const value = customFieldValues[key] || "";
                  const setVal = (v: string) =>
                    setCustomFieldValues((prev) => ({ ...prev, [key]: v }));
                  const labelEl = (
                    <Label>
                      {f.label}
                      {f.isRequired && <span className="text-destructive ms-1">*</span>}
                    </Label>
                  );
                  if (f.fieldType === "select") {
                    return (
                      <div key={f.id}>
                        {labelEl}
                        <Select value={value || "__none__"} onValueChange={(v) => setVal(v === "__none__" ? "" : v)}>
                          <SelectTrigger data-testid={`input-custom-${f.id}`}>
                            <SelectValue placeholder={t("fields.optionsPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {(f.options || []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  if (f.fieldType === "boolean") {
                    return (
                      <div key={f.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`cf-${f.id}`}
                          checked={value === "true"}
                          onChange={(e) => setVal(e.target.checked ? "true" : "false")}
                          data-testid={`input-custom-${f.id}`}
                        />
                        <Label htmlFor={`cf-${f.id}`}>
                          {f.label}
                          {f.isRequired && <span className="text-destructive ms-1">*</span>}
                        </Label>
                      </div>
                    );
                  }
                  const inputType =
                    f.isSensitive ? "password" :
                    f.fieldType === "number" ? "number" :
                    f.fieldType === "date" ? "date" :
                    f.fieldType === "url" ? "url" :
                    f.fieldType === "email" ? "email" :
                    "text";
                  return (
                    <div key={f.id}>
                      {labelEl}
                      <Input
                        type={inputType}
                        value={value}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={f.isSensitive && value === SENSITIVE_MASK ? t("fields.sensitivePlaceholder") : undefined}
                        data-testid={`input-custom-${f.id}`}
                      />
                      {f.isSensitive && (
                        <p className="text-xs text-muted-foreground mt-1">{t("fields.sensitiveEditHint")}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={createMutation.isPending || updateMutation.isPending || !formData.firstName || !formData.lastName || !formData.title || !formData.email}
              data-testid="button-submit-employee"
            >
              {createMutation.isPending || updateMutation.isPending ? t("employees.saving") : editingId ? t("employees.updateEmployee") : t("employees.addEmployee")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkImportWizard
        orgId={selectedOrgId}
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
      />

      <EntraImportWizard
        orgId={selectedOrgId}
        open={isEntraImportOpen}
        onOpenChange={setIsEntraImportOpen}
      />

      <GoogleImportWizard
        orgId={selectedOrgId}
        open={isGoogleImportOpen}
        onOpenChange={setIsGoogleImportOpen}
      />

      <HrisImportWizard
        orgId={selectedOrgId}
        open={isHrisImportOpen}
        onOpenChange={setIsHrisImportOpen}
      />

      <FindDuplicatesDialog
        orgId={selectedOrgId}
        open={isFindDuplicatesOpen}
        onOpenChange={setIsFindDuplicatesOpen}
      />

      <PhotoCropDialog
        open={!!pendingPhotoFile}
        file={pendingPhotoFile}
        isUploading={uploadPhotoMutation.isPending}
        onCancel={() => setPendingPhotoFile(null)}
        onConfirm={handleCroppedPhoto}
      />

    </div>
  );
}
