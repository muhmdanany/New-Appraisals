import { useEffect, useState } from "react";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import {
  useListDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useListEmployees,
  useListAdministrations,
  getListDepartmentsQueryKey,
  getGetOrgDashboardQueryKey,
  getGetDepartmentStatsQueryKey,
  getListEmployeesQueryKey,
  getListAdministrationsQueryKey,
  type Department,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Edit2,
  Trash2,
  Users,
  Building2,
  Palette,
} from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6d28d9",
];

interface DeptFormData {
  name: string;
  description: string;
  color: string;
  administrationId: number | null;
  parentDepartmentId: number | null;
  headEmployeeId: number | null;
}

const defaultForm: DeptFormData = {
  name: "",
  description: "",
  color: "#6366f1",
  administrationId: null,
  parentDepartmentId: null,
  headEmployeeId: null,
};

export default function Departments() {
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<DeptFormData>(defaultForm);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deptParam = params.get("departmentId");
    if (deptParam && /^\d+$/.test(deptParam)) {
      setHighlightedId(parseInt(deptParam, 10));
    }
  }, []);

  const { data: departments, isLoading } = useListDepartments(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListDepartmentsQueryKey(selectedOrgId!) } }
  );

  const { data: employees } = useListEmployees(
    selectedOrgId!,
    {},
    { query: { enabled: !!selectedOrgId, queryKey: getListEmployeesQueryKey(selectedOrgId!) } }
  );

  const { data: administrations } = useListAdministrations(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListAdministrationsQueryKey(selectedOrgId!) } }
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(selectedOrgId!) });
  };

  const createMutation = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsDialogOpen(false);
        setFormData(defaultForm);
      },
    },
  });

  const updateMutation = useUpdateDepartment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsDialogOpen(false);
        setEditingId(null);
        setFormData(defaultForm);
      },
    },
  });

  const deleteMutation = useDeleteDepartment({
    mutation: {
      onSuccess: () => {
        invalidateAll();
      },
    },
  });

  const handleSubmit = () => {
    if (!selectedOrgId) return;
    const data = {
      ...formData,
      description: formData.description || null,
      administrationId: formData.administrationId || null,
      parentDepartmentId: formData.parentDepartmentId || null,
      headEmployeeId: formData.headEmployeeId || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate({ orgId: selectedOrgId, data });
    }
  };

  const openEdit = (dept: Department) => {
    setEditingId(dept.id);
    setFormData({
      name: dept.name,
      description: dept.description || "",
      color: dept.color,
      administrationId: dept.administrationId ?? null,
      parentDepartmentId: dept.parentDepartmentId ?? null,
      headEmployeeId: dept.headEmployeeId ?? null,
    });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (highlightedId == null || !departments) return undefined;
    const el = document.querySelector(`[data-testid="card-department-${highlightedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightedId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightedId, departments]);

  const getEmployeeCount = (deptId: number) => {
    return employees?.filter(e => e.departmentId === deptId).length ?? 0;
  };

  const getHeadEmployee = (headId: number | null) => {
    if (!headId) return null;
    return employees?.find(e => e.id === headId);
  };

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  const deptCount = departments?.length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{t("departments.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {deptCount !== 1 ? t("departments.departmentCount_plural", { count: deptCount }) : t("departments.departmentCount", { count: deptCount })}
            </p>
          </div>
          {hasPermission("departments", "create") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={openCreate} data-testid="button-add-department">
                  <Plus className="h-4 w-4 me-2" />
                  {t("departments.addDepartment")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.addDepartment")}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : departments && departments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(dept => {
              const empCount = getEmployeeCount(dept.id);
              const head = getHeadEmployee(dept.headEmployeeId ?? null);
              return (
                <Card
                  key={dept.id}
                  className={`overflow-hidden transition-shadow ${
                    highlightedId === dept.id ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                  data-testid={`card-department-${dept.id}`}
                >
                  <div className="h-2" style={{ backgroundColor: dept.color }} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${dept.color}15` }}
                        >
                          <Building2 className="h-5 w-5" style={{ color: dept.color }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{dept.name}</h3>
                          {dept.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{dept.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {empCount !== 1 ? t("departments.memberCount_plural", { count: empCount }) : t("departments.memberCount", { count: empCount })}
                      </span>
                      {head && (
                        <span className="truncate">
                          {t("departments.head", { name: `${head.firstName} ${head.lastName}` })}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      {hasPermission("departments", "edit") && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => openEdit(dept)}
                              data-testid={`button-edit-department-${dept.id}`}
                            >
                              <Edit2 className="h-3.5 w-3.5 me-1" /> {t("common.edit")}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("tooltips.editDepartment")}</TooltipContent>
                        </Tooltip>
                      )}
                      {hasPermission("departments", "delete") && (
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="flex-1"
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-department-${dept.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 me-1" /> {t("common.delete")}
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>{t("tooltips.deleteDepartment")}</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("confirmDialog.deleteDepartmentDesc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate({ id: dept.id })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("confirmDialog.confirmDelete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">{t("departments.noDepartmentsYet")}</p>
            <p className="text-sm mt-1">{t("departments.createToOrganize")}</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("departments.editDepartment") : t("departments.createDepartment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>{t("departments.departmentName")}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder={t("departments.departmentNamePlaceholder")}
                data-testid="input-department-name"
              />
            </div>
            <div>
              <Label>{t("departments.description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder={t("departments.descriptionPlaceholder")}
                data-testid="input-department-description"
              />
            </div>
            <div>
              <Label>{t("administrations.administration")}</Label>
              <Select
                value={formData.administrationId?.toString() || "none"}
                onValueChange={(val) => setFormData(p => ({ ...p, administrationId: val === "none" ? null : parseInt(val, 10) }))}
              >
                <SelectTrigger data-testid="select-department-administration">
                  <SelectValue placeholder={t("administrations.selectAdministration")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("administrations.noAdministration")}</SelectItem>
                  {administrations?.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" /> {t("departments.color")}
              </Label>
              <div className="grid grid-cols-8 gap-2 mt-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${formData.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormData(p => ({ ...p, color: c }))}
                    type="button"
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>{t("departments.departmentHead")}</Label>
              <Select
                value={formData.headEmployeeId?.toString() || "none"}
                onValueChange={(val) => setFormData(p => ({ ...p, headEmployeeId: val === "none" ? null : parseInt(val, 10) }))}
              >
                <SelectTrigger data-testid="select-department-head">
                  <SelectValue placeholder={t("departments.selectHead")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("departments.noHead")}</SelectItem>
                  {employees?.map(e => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.firstName} {e.lastName} - {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={createMutation.isPending || updateMutation.isPending || !formData.name}
              data-testid="button-submit-department"
            >
              {createMutation.isPending || updateMutation.isPending ? t("departments.saving") : editingId ? t("departments.updateDepartment") : t("departments.createDepartment")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
