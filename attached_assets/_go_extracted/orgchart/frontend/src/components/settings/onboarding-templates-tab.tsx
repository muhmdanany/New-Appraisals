import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type TemplateTask = {
  id?: number;
  title: string;
  description: string;
  dueDayOffset: number;
  defaultAssigneeEmployeeId: number | null;
};

type Template = {
  id: number;
  name: string;
  isDefault: boolean;
  tasks: TemplateTask[];
};

type EmployeeLite = { id: number; firstName: string; lastName: string };

export function OnboardingTemplatesTab({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/organizations/${orgId}/onboarding/templates`, {
        credentials: "include",
      }).then((r) => r.json()),
      fetch(`${API_BASE}/organizations/${orgId}/employees`, {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([tplRes, empRes]) => {
        setTemplates(Array.isArray(tplRes?.templates) ? tplRes.templates : []);
        setEmployees(Array.isArray(empRes) ? empRes : []);
      })
      .catch(() => {
        setTemplates([]);
        setEmployees([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (orgId) load();
  }, [orgId]);

  const startNew = () => {
    setEditing({
      id: 0,
      name: "",
      isDefault: templates.length === 0,
      tasks: [],
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({
        title: t("onboarding.errors.nameRequired"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const url =
      editing.id > 0
        ? `${API_BASE}/organizations/${orgId}/onboarding/templates/${editing.id}`
        : `${API_BASE}/organizations/${orgId}/onboarding/templates`;
    const method = editing.id > 0 ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name.trim(),
          isDefault: editing.isDefault,
          tasks: editing.tasks
            .filter((tk) => tk.title.trim())
            .map((tk) => ({
              title: tk.title.trim(),
              description: tk.description,
              dueDayOffset: tk.dueDayOffset,
              defaultAssigneeEmployeeId: tk.defaultAssigneeEmployeeId,
            })),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      toast({ title: t("onboarding.toasts.saved") });
      setEditing(null);
      load();
    } catch {
      toast({
        title: t("onboarding.errors.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tpl: Template) => {
    if (!confirm(t("onboarding.confirmDeleteTemplate"))) return;
    const res = await fetch(
      `${API_BASE}/organizations/${orgId}/onboarding/templates/${tpl.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (res.ok) {
      toast({ title: t("onboarding.toasts.deleted") });
      load();
    }
  };

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {editing.id > 0
              ? t("onboarding.editTemplate")
              : t("onboarding.newTemplate")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("onboarding.templateName")}</Label>
            <Input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              data-testid="input-template-name"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>{t("onboarding.isDefault")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("onboarding.isDefaultHelp")}
              </p>
            </div>
            <Switch
              checked={editing.isDefault}
              onCheckedChange={(v) =>
                setEditing({ ...editing, isDefault: v })
              }
              data-testid="switch-template-default"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{t("onboarding.tasks")}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditing({
                    ...editing,
                    tasks: [
                      ...editing.tasks,
                      {
                        title: "",
                        description: "",
                        dueDayOffset: 0,
                        defaultAssigneeEmployeeId: null,
                      },
                    ],
                  })
                }
                data-testid="button-add-task"
              >
                <Plus className="h-3.5 w-3.5 me-1" />
                {t("onboarding.addTask")}
              </Button>
            </div>
            <div className="space-y-3">
              {editing.tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("onboarding.noTasksYet")}
                </p>
              )}
              {editing.tasks.map((tk, i) => (
                <div
                  key={i}
                  className="border rounded-lg p-3 space-y-2"
                  data-testid={`task-row-${i}`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-2" />
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder={t("onboarding.taskTitle")}
                        value={tk.title}
                        onChange={(e) => {
                          const next = [...editing.tasks];
                          next[i] = { ...tk, title: e.target.value };
                          setEditing({ ...editing, tasks: next });
                        }}
                      />
                      <Textarea
                        placeholder={t("onboarding.taskDescription")}
                        value={tk.description}
                        rows={2}
                        onChange={(e) => {
                          const next = [...editing.tasks];
                          next[i] = { ...tk, description: e.target.value };
                          setEditing({ ...editing, tasks: next });
                        }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">
                            {t("onboarding.dueDayOffset")}
                          </Label>
                          <Input
                            type="number"
                            value={tk.dueDayOffset}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              const next = [...editing.tasks];
                              next[i] = {
                                ...tk,
                                dueDayOffset: Number.isNaN(v) ? 0 : v,
                              };
                              setEditing({ ...editing, tasks: next });
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">
                            {t("onboarding.defaultAssignee")}
                          </Label>
                          <Select
                            value={
                              tk.defaultAssigneeEmployeeId == null
                                ? "none"
                                : String(tk.defaultAssigneeEmployeeId)
                            }
                            onValueChange={(v) => {
                              const next = [...editing.tasks];
                              next[i] = {
                                ...tk,
                                defaultAssigneeEmployeeId:
                                  v === "none" ? null : parseInt(v, 10),
                              };
                              setEditing({ ...editing, tasks: next });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {t("onboarding.noAssignee")}
                              </SelectItem>
                              {employees.map((e) => (
                                <SelectItem key={e.id} value={String(e.id)}>
                                  {e.firstName} {e.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const next = editing.tasks.filter((_, j) => j !== i);
                        setEditing({ ...editing, tasks: next });
                      }}
                      data-testid={`button-remove-task-${i}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              data-testid="button-save-template"
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">
            {t("onboarding.templatesTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("onboarding.templatesSubtitle")}
          </p>
        </div>
        <Button onClick={startNew} data-testid="button-new-template">
          <Plus className="h-4 w-4 me-1" />
          {t("onboarding.newTemplate")}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("onboarding.noTemplates")}
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between border rounded-lg p-3"
                data-testid={`template-row-${tpl.id}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tpl.name}</span>
                    {tpl.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {t("onboarding.defaultBadge")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("onboarding.taskCount", { count: tpl.tasks.length })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(tpl)}
                    data-testid={`button-edit-template-${tpl.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(tpl)}
                    data-testid={`button-delete-template-${tpl.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
