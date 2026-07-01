import { useState } from "react";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import {
  useListAdministrations,
  useCreateAdministration,
  useUpdateAdministration,
  useDeleteAdministration,
  useListEmployees,
  useListDepartments,
  getListAdministrationsQueryKey,
  getGetOrgDashboardQueryKey,
  getListDepartmentsQueryKey,
  getListEmployeesQueryKey,
  type Administration,
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
  Landmark,
  Palette,
  Building2,
} from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6d28d9",
];

interface AdminFormData {
  name: string;
  description: string;
  color: string;
  headEmployeeId: number | null;
}

const defaultForm: AdminFormData = {
  name: "",
  description: "",
  color: "#6366f1",
  headEmployeeId: null,
};

export default function Administrations() {
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AdminFormData>(defaultForm);

  const { data: administrations, isLoading } = useListAdministrations(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListAdministrationsQueryKey(selectedOrgId!) } }
  );

  const { data: employees } = useListEmployees(
    selectedOrgId!,
    {},
    { query: { enabled: !!selectedOrgId, queryKey: getListEmployeesQueryKey(selectedOrgId!) } }
  );

  const { data: departments } = useListDepartments(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListDepartmentsQueryKey(selectedOrgId!) } }
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListAdministrationsQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(selectedOrgId!) });
    queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey(selectedOrgId!) });
  };

  const createMutation = useCreateAdministration({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsDialogOpen(false);
        setFormData(defaultForm);
      },
    },
  });

  const updateMutation = useUpdateAdministration({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setIsDialogOpen(false);
        setEditingId(null);
        setFormData(defaultForm);
      },
    },
  });

  const deleteMutation = useDeleteAdministration({
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
      headEmployeeId: formData.headEmployeeId || null,
    };

    if (editingId) {
      updateMutation.mutate({ orgId: selectedOrgId, id: editingId, data });
    } else {
      createMutation.mutate({ orgId: selectedOrgId, data });
    }
  };

  const openEdit = (admin: Administration) => {
    setEditingId(admin.id);
    setFormData({
      name: admin.name,
      description: admin.description || "",
      color: admin.color,
      headEmployeeId: admin.headEmployeeId ?? null,
    });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setIsDialogOpen(true);
  };

  const getSectionCount = (adminId: number) => {
    return departments?.filter(d => d.administrationId === adminId).length ?? 0;
  };

  const getEmployeeCount = (adminId: number) => {
    return employees?.filter(e => e.administrationId === adminId).length ?? 0;
  };

  const getHeadEmployee = (headId: number | null) => {
    if (!headId) return null;
    return employees?.find(e => e.id === headId);
  };

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  const adminCount = administrations?.length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{t("administrations.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {adminCount !== 1 ? t("administrations.administrationCount_plural", { count: adminCount }) : t("administrations.administrationCount", { count: adminCount })}
            </p>
          </div>
          {hasPermission("departments", "create") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={openCreate} data-testid="button-add-administration">
                  <Plus className="h-4 w-4 me-2" />
                  {t("administrations.addAdministration")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("tooltips.addAdministration")}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : administrations && administrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {administrations.map(admin => {
              const sectionCount = getSectionCount(admin.id);
              const empCount = getEmployeeCount(admin.id);
              const head = getHeadEmployee(admin.headEmployeeId ?? null);
              const adminDepts = departments?.filter(d => d.administrationId === admin.id) ?? [];
              return (
                <Card key={admin.id} className="overflow-hidden" data-testid={`card-administration-${admin.id}`}>
                  <div className="h-2" style={{ backgroundColor: admin.color }} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${admin.color}15` }}
                        >
                          <Landmark className="h-5 w-5" style={{ color: admin.color }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{admin.name}</h3>
                          {admin.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{admin.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {sectionCount !== 1 ? t("administrations.sectionCount_plural", { count: sectionCount }) : t("administrations.sectionCount", { count: sectionCount })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {empCount !== 1 ? t("administrations.memberCount_plural", { count: empCount }) : t("administrations.memberCount", { count: empCount })}
                      </span>
                    </div>

                    {head && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {t("administrations.head", { name: `${head.firstName} ${head.lastName}` })}
                      </div>
                    )}

                    {adminDepts.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {adminDepts.slice(0, 4).map(dept => (
                          <Badge key={dept.id} variant="secondary" className="text-xs">
                            {dept.name}
                          </Badge>
                        ))}
                        {adminDepts.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{adminDepts.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      {hasPermission("departments", "edit") && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => openEdit(admin)}
                              data-testid={`button-edit-administration-${admin.id}`}
                            >
                              <Edit2 className="h-3.5 w-3.5 me-1" /> {t("common.edit")}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("tooltips.editAdministration")}</TooltipContent>
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
                                  data-testid={`button-delete-administration-${admin.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 me-1" /> {t("common.delete")}
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>{t("tooltips.deleteAdministration")}</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("confirmDialog.deleteDepartmentDesc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate({ orgId: selectedOrgId, id: admin.id })}
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
            <Landmark className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">{t("administrations.noAdministrationsYet")}</p>
            <p className="text-sm mt-1">{t("administrations.createToOrganize")}</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("administrations.editAdministration") : t("administrations.createAdministration")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>{t("administrations.administrationName")}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder={t("administrations.administrationNamePlaceholder")}
                data-testid="input-administration-name"
              />
            </div>
            <div>
              <Label>{t("administrations.description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder={t("administrations.descriptionPlaceholder")}
                data-testid="input-administration-description"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" /> {t("administrations.color")}
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
              <Label>{t("administrations.administrationHead")}</Label>
              <Select
                value={formData.headEmployeeId?.toString() || "none"}
                onValueChange={(val) => setFormData(p => ({ ...p, headEmployeeId: val === "none" ? null : parseInt(val, 10) }))}
              >
                <SelectTrigger data-testid="select-administration-head">
                  <SelectValue placeholder={t("administrations.selectHead")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("administrations.noHead")}</SelectItem>
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
              data-testid="button-submit-administration"
            >
              {createMutation.isPending || updateMutation.isPending ? t("administrations.saving") : editingId ? t("administrations.updateAdministration") : t("administrations.createAdministration")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
