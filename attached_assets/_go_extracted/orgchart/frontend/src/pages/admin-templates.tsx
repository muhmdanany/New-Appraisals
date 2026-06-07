import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useListOrganizationTemplates,
  useAdminUpdateOrganizationTemplates,
  useAdminResetOrganizationTemplates,
  getListOrganizationTemplatesQueryKey,
  type OrganizationTemplate,
  type OrganizationTemplateDepartment,
  type OrganizationTemplatePosition,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ShieldCheck, RotateCcw, Save } from "lucide-react";

type EditableTemplate = OrganizationTemplate;

function blankDept(): OrganizationTemplateDepartment {
  return {
    key: `dept_${Math.random().toString(36).slice(2, 8)}`,
    color: "#6366f1",
    name: { en: "", ar: "" },
  };
}

function blankPosition(): OrganizationTemplatePosition {
  return {
    key: `pos_${Math.random().toString(36).slice(2, 8)}`,
    title: { en: "", ar: "" },
    departmentKey: null,
    managerKey: null,
  };
}

function blankTemplate(): EditableTemplate {
  return {
    id: `template_${Math.random().toString(36).slice(2, 8)}`,
    icon: "building-2",
    name: { en: "New template", ar: "" },
    description: { en: "", ar: "" },
    departments: [],
    positions: [],
  };
}

export default function AdminTemplatesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: serverTemplates, isLoading } = useListOrganizationTemplates();
  const [templates, setTemplates] = useState<EditableTemplate[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (serverTemplates && templates === null) {
      const cloned = JSON.parse(JSON.stringify(serverTemplates)) as EditableTemplate[];
      setTemplates(cloned);
      if (!activeId && cloned.length > 0) setActiveId(cloned[0].id);
    }
  }, [serverTemplates, templates, activeId]);

  const updateMutation = useAdminUpdateOrganizationTemplates({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getListOrganizationTemplatesQueryKey(), data);
        toast({ title: t("adminTemplates.savedTitle"), description: t("adminTemplates.savedDescription") });
      },
      onError: (err) => {
        toast({
          title: t("adminTemplates.saveErrorTitle"),
          description: (err as Error)?.message || String(err),
          variant: "destructive",
        });
      },
    },
  });

  const resetMutation = useAdminResetOrganizationTemplates({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getListOrganizationTemplatesQueryKey(), data);
        const cloned = JSON.parse(JSON.stringify(data)) as EditableTemplate[];
        setTemplates(cloned);
        setActiveId(cloned[0]?.id ?? null);
        toast({ title: t("adminTemplates.resetTitle"), description: t("adminTemplates.resetDescription") });
      },
      onError: (err) => {
        toast({
          title: t("adminTemplates.resetErrorTitle"),
          description: (err as Error)?.message || String(err),
          variant: "destructive",
        });
      },
    },
  });

  const active = useMemo(
    () => templates?.find((tpl) => tpl.id === activeId) ?? null,
    [templates, activeId],
  );

  if (!user?.isSystemAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {t("adminTemplates.notAuthorized")}
        </div>
      </div>
    );
  }

  if (isLoading || templates === null) {
    return <div className="p-8 text-muted-foreground">{t("common.loading")}</div>;
  }

  function patchActive(patch: (tpl: EditableTemplate) => EditableTemplate) {
    if (!active) return;
    setTemplates((prev) => prev?.map((tpl) => (tpl.id === active.id ? patch(tpl) : tpl)) ?? prev);
  }

  function addTemplate() {
    const fresh = blankTemplate();
    setTemplates((prev) => (prev ? [...prev, fresh] : [fresh]));
    setActiveId(fresh.id);
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => {
      const next = (prev ?? []).filter((tpl) => tpl.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  function save() {
    if (!templates) return;
    updateMutation.mutate({ data: templates });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="admin-templates-page">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {t("adminTemplates.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("adminTemplates.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" data-testid="button-reset-templates">
                <RotateCcw className="h-4 w-4 me-2" />
                {t("adminTemplates.reset")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("adminTemplates.resetConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("adminTemplates.resetConfirmBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => resetMutation.mutate()}
                  data-testid="button-reset-confirm"
                >
                  {t("adminTemplates.reset")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            onClick={save}
            disabled={updateMutation.isPending}
            data-testid="button-save-templates"
          >
            <Save className="h-4 w-4 me-2" />
            {updateMutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={addTemplate}
            data-testid="button-add-template"
          >
            <Plus className="h-4 w-4 me-2" />
            {t("adminTemplates.addTemplate")}
          </Button>
          <div className="space-y-1">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setActiveId(tpl.id)}
                className={`w-full text-start rounded-md border px-3 py-2 text-sm hover:border-primary/50 transition-colors ${
                  tpl.id === activeId ? "border-primary bg-primary/5" : "border-border"
                }`}
                data-testid={`template-list-${tpl.id}`}
              >
                <div className="font-medium truncate">{tpl.name.en || tpl.id}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {tpl.departments.length} · {tpl.positions.length}
                </div>
              </button>
            ))}
            {templates.length === 0 && (
              <div className="text-xs text-muted-foreground px-1 py-4">
                {t("adminTemplates.empty")}
              </div>
            )}
          </div>
        </aside>

        {active ? (
          <section className="space-y-6">
            <div className="rounded-lg border bg-card p-4 space-y-4" data-testid="template-editor">
              <div className="flex justify-between items-start gap-3">
                <h2 className="font-semibold">{t("adminTemplates.metadata")}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTemplate(active.id)}
                  data-testid="button-delete-template"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("adminTemplates.id")}>
                  <Input
                    value={active.id}
                    onChange={(e) => {
                      const newId = e.target.value;
                      const oldId = active.id;
                      setTemplates((prev) =>
                        prev?.map((tpl) => (tpl.id === oldId ? { ...tpl, id: newId } : tpl)) ?? prev,
                      );
                      setActiveId(newId);
                    }}
                    data-testid="input-template-id"
                  />
                </Field>
                <Field label={t("adminTemplates.icon")}>
                  <Input
                    value={active.icon}
                    onChange={(e) => patchActive((tpl) => ({ ...tpl, icon: e.target.value }))}
                    data-testid="input-template-icon"
                  />
                </Field>
                <Field label={t("adminTemplates.nameEn")}>
                  <Input
                    value={active.name.en}
                    onChange={(e) =>
                      patchActive((tpl) => ({ ...tpl, name: { ...tpl.name, en: e.target.value } }))
                    }
                    data-testid="input-template-name-en"
                  />
                </Field>
                <Field label={t("adminTemplates.nameAr")}>
                  <Input
                    value={active.name.ar}
                    dir="rtl"
                    onChange={(e) =>
                      patchActive((tpl) => ({ ...tpl, name: { ...tpl.name, ar: e.target.value } }))
                    }
                    data-testid="input-template-name-ar"
                  />
                </Field>
                <Field label={t("adminTemplates.descriptionEn")}>
                  <Textarea
                    value={active.description.en}
                    onChange={(e) =>
                      patchActive((tpl) => ({
                        ...tpl,
                        description: { ...tpl.description, en: e.target.value },
                      }))
                    }
                    data-testid="input-template-description-en"
                  />
                </Field>
                <Field label={t("adminTemplates.descriptionAr")}>
                  <Textarea
                    value={active.description.ar}
                    dir="rtl"
                    onChange={(e) =>
                      patchActive((tpl) => ({
                        ...tpl,
                        description: { ...tpl.description, ar: e.target.value },
                      }))
                    }
                    data-testid="input-template-description-ar"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t("adminTemplates.departments")}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patchActive((tpl) => ({ ...tpl, departments: [...tpl.departments, blankDept()] }))
                  }
                  data-testid="button-add-department"
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t("common.add")}
                </Button>
              </div>
              {active.departments.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("adminTemplates.noDepartments")}</div>
              ) : (
                <div className="space-y-2">
                  {active.departments.map((dept, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_80px_40px] gap-2 items-center"
                      data-testid={`department-row-${idx}`}
                    >
                      <Input
                        placeholder={t("adminTemplates.key")}
                        value={dept.key}
                        onChange={(e) =>
                          patchActive((tpl) => {
                            const departments = [...tpl.departments];
                            departments[idx] = { ...dept, key: e.target.value };
                            return { ...tpl, departments };
                          })
                        }
                      />
                      <Input
                        placeholder={t("adminTemplates.nameEn")}
                        value={dept.name.en}
                        onChange={(e) =>
                          patchActive((tpl) => {
                            const departments = [...tpl.departments];
                            departments[idx] = {
                              ...dept,
                              name: { ...dept.name, en: e.target.value },
                            };
                            return { ...tpl, departments };
                          })
                        }
                      />
                      <Input
                        placeholder={t("adminTemplates.nameAr")}
                        value={dept.name.ar}
                        dir="rtl"
                        onChange={(e) =>
                          patchActive((tpl) => {
                            const departments = [...tpl.departments];
                            departments[idx] = {
                              ...dept,
                              name: { ...dept.name, ar: e.target.value },
                            };
                            return { ...tpl, departments };
                          })
                        }
                      />
                      <Input
                        type="color"
                        value={dept.color}
                        onChange={(e) =>
                          patchActive((tpl) => {
                            const departments = [...tpl.departments];
                            departments[idx] = { ...dept, color: e.target.value };
                            return { ...tpl, departments };
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          patchActive((tpl) => ({
                            ...tpl,
                            departments: tpl.departments.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t("adminTemplates.positions")}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patchActive((tpl) => ({ ...tpl, positions: [...tpl.positions, blankPosition()] }))
                  }
                  data-testid="button-add-position"
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t("common.add")}
                </Button>
              </div>
              {active.positions.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("adminTemplates.noPositions")}</div>
              ) : (
                <div className="space-y-2">
                  {active.positions.map((pos, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_40px] gap-2 items-center"
                      data-testid={`position-row-${idx}`}
                    >
                      <Input
                        placeholder={t("adminTemplates.key")}
                        value={pos.key}
                        onChange={(e) =>
                          patchActive((tpl) => {
                            const positions = [...tpl.positions];
                            positions[idx] = { ...pos, key: e.target.value };
                            return { ...tpl, positions };
                          })
                        }
                      />
                      <Input
                        placeholder={t("adminTemplates.titleEn")}
                        value={pos.title.en}
                        onChange={(e) =>
                          patchActive((tpl) => {
                            const positions = [...tpl.positions];
                            positions[idx] = {
                              ...pos,
                              title: { ...pos.title, en: e.target.value },
                            };
                            return { ...tpl, positions };
                          })
                        }
                      />
                      <Input
                        placeholder={t("adminTemplates.titleAr")}
                        value={pos.title.ar}
                        dir="rtl"
                        onChange={(e) =>
                          patchActive((tpl) => {
                            const positions = [...tpl.positions];
                            positions[idx] = {
                              ...pos,
                              title: { ...pos.title, ar: e.target.value },
                            };
                            return { ...tpl, positions };
                          })
                        }
                      />
                      <Select
                        value={pos.departmentKey ?? "__none"}
                        onValueChange={(value) =>
                          patchActive((tpl) => {
                            const positions = [...tpl.positions];
                            positions[idx] = {
                              ...pos,
                              departmentKey: value === "__none" ? null : value,
                            };
                            return { ...tpl, positions };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("adminTemplates.department")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">{t("adminTemplates.none")}</SelectItem>
                          {active.departments.map((d) => (
                            <SelectItem key={d.key} value={d.key}>
                              {d.name.en || d.key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={pos.managerKey ?? "__none"}
                        onValueChange={(value) =>
                          patchActive((tpl) => {
                            const positions = [...tpl.positions];
                            positions[idx] = {
                              ...pos,
                              managerKey: value === "__none" ? null : value,
                            };
                            return { ...tpl, positions };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("adminTemplates.manager")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">{t("adminTemplates.none")}</SelectItem>
                          {active.positions
                            .filter((p) => p.key !== pos.key)
                            .map((p) => (
                              <SelectItem key={p.key} value={p.key}>
                                {p.title.en || p.key}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          patchActive((tpl) => ({
                            ...tpl,
                            positions: tpl.positions.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="text-sm text-muted-foreground p-6">{t("adminTemplates.selectTemplate")}</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
