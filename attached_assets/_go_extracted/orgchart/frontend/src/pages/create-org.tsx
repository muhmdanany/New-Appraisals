import { useState } from "react";
import { ChartTreeNode } from "@/components/chart-tree-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  useCreateOrganization,
  useCreateOrganizationFromTemplate,
  useListOrganizationTemplates,
  getListOrganizationsQueryKey,
  type OrganizationTemplate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/lib/org-context";
import { useTranslation } from "react-i18next";
import { Building, Rocket, Stethoscope, Store, GraduationCap, Building2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  description: z.string().optional(),
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  stethoscope: Stethoscope,
  store: Store,
  "graduation-cap": GraduationCap,
  "building-2": Building2,
};

function pickLocalized(s: { en: string; ar: string }, lang: string): string {
  return lang === "ar" && s.ar ? s.ar : s.en;
}

type TemplatePosition = OrganizationTemplate["positions"][number];
type TemplateDept = OrganizationTemplate["departments"][number];

interface PreviewNode {
  pos: TemplatePosition;
  dept: TemplateDept | undefined;
  children: PreviewNode[];
}

function buildPreviewTree(
  template: OrganizationTemplate,
): PreviewNode | null {
  const deptByKey = new Map(template.departments.map((d) => [d.key, d]));
  const byParent = new Map<string | null, TemplatePosition[]>();
  for (const p of template.positions) {
    const k = p.managerKey ?? null;
    const arr = byParent.get(k) ?? [];
    arr.push(p);
    byParent.set(k, arr);
  }
  const root = template.positions.find((p) => !p.managerKey);
  if (!root) return null;
  const make = (pos: TemplatePosition): PreviewNode => ({
    pos,
    dept: pos.departmentKey ? deptByKey.get(pos.departmentKey) : undefined,
    children: (byParent.get(pos.key) ?? []).map(make),
  });
  return make(root);
}

function TemplatePreview({
  template,
  lang,
}: {
  template: OrganizationTemplate;
  lang: string;
}) {
  const { t } = useTranslation();
  const tree = buildPreviewTree(template);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1.5">
          {t("createOrg.template.departments")} ({template.departments.length})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {template.departments.map((d) => (
            <span
              key={d.key}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
              {pickLocalized(d.name, lang)}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1.5">
          {t("createOrg.template.positions")} ({template.positions.length})
        </div>
        <div
          className="rounded-md border bg-muted/30 p-3 max-h-72 overflow-auto"
          data-testid="template-preview-chart"
        >
          <div className="flex justify-center min-w-full">
            {tree ? (
              <ChartTreeNode<PreviewNode>
                node={tree}
                getChildren={(n) => n.children}
                getKey={(n) => n.pos.key}
                connectorStyle="angled"
                animationsEnabled={false}
                connectorHeight={28}
                childGap={12}
                renderCard={(n) => (
                  <div
                    data-testid={`template-preview-node-${n.pos.key}`}
                    className="relative rounded-md border bg-card px-2 py-1 text-[11px] leading-tight shadow-sm w-[120px] flex-shrink-0 overflow-hidden"
                    style={
                      n.dept
                        ? {
                            borderInlineStartWidth: 3,
                            borderInlineStartColor: n.dept.color,
                          }
                        : undefined
                    }
                  >
                    <div className="font-medium truncate text-foreground">
                      {pickLocalized(n.pos.title, lang)}
                    </div>
                    {n.dept && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: n.dept.color }}
                        />
                        <span className="text-[10px] text-muted-foreground truncate">
                          {pickLocalized(n.dept.name, lang)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateOrg() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { setSelectedOrgId } = useOrg();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";

  const [tab, setTab] = useState<"template" | "blank">("blank");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateOrgName, setTemplateOrgName] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  const { data: templates, isLoading: loadingTemplates } = useListOrganizationTemplates();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      industry: "",
      description: "",
    },
  });

  const onCreated = (data: { id: number }) => {
    queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
    setSelectedOrgId(data.id);
    setLocation("/");
  };

  const createOrg = useCreateOrganization({
    mutation: { onSuccess: onCreated },
  });
  const createFromTemplate = useCreateOrganizationFromTemplate({
    mutation: { onSuccess: onCreated },
  });

  function onBlankSubmit(values: z.infer<typeof formSchema>) {
    createOrg.mutate({ data: values });
  }

  function onTemplateSubmit() {
    setTemplateError(null);
    if (!selectedTemplateId) {
      setTemplateError(t("createOrg.template.pickFirst"));
      return;
    }
    if (templateOrgName.trim().length < 2) {
      setTemplateError(t("createOrg.nameMinLength"));
      return;
    }
    createFromTemplate.mutate({
      data: {
        templateId: selectedTemplateId,
        orgName: templateOrgName.trim(),
        language: lang,
      },
    });
  }

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-3xl w-full bg-card border border-border rounded-xl shadow-lg p-8">
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 text-foreground">{t("createOrg.welcome")}</h1>
        <p className="text-center text-muted-foreground mb-8">{t("createOrg.subtitle")}</p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "template" | "blank")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="template" data-testid="tab-template">
              {t("createOrg.template.tab")}
            </TabsTrigger>
            <TabsTrigger value="blank" data-testid="tab-blank">
              {t("createOrg.template.blankTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-6">
            {loadingTemplates ? (
              <div className="text-center text-muted-foreground py-8">{t("common.loading")}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {templates?.map((tpl) => {
                    const Icon = ICONS[tpl.icon] ?? Building;
                    const isSelected = tpl.id === selectedTemplateId;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        data-testid={`template-card-${tpl.id}`}
                        className={cn(
                          "relative text-start rounded-lg border p-3 hover:border-primary/60 transition-colors",
                          isSelected && "border-primary ring-2 ring-primary/30 bg-primary/5",
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 end-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <Icon className="h-6 w-6 text-primary mb-2" />
                        <div className="font-medium text-sm">{pickLocalized(tpl.name, lang)}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {pickLocalized(tpl.description, lang)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-2">
                          {tpl.departments.length} {t("createOrg.template.depts")} ·{" "}
                          {tpl.positions.length} {t("createOrg.template.pos")}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedTemplate && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4" data-testid="template-preview">
                    <div className="text-sm font-medium">
                      {t("createOrg.template.previewTitle", {
                        name: pickLocalized(selectedTemplate.name, lang),
                      })}
                    </div>
                    <TemplatePreview template={selectedTemplate} lang={lang} />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("createOrg.orgName")}</label>
                  <Input
                    value={templateOrgName}
                    onChange={(e) => setTemplateOrgName(e.target.value)}
                    placeholder={t("createOrg.orgNamePlaceholder")}
                    data-testid="input-template-org-name"
                  />
                </div>
                {templateError && (
                  <div className="text-sm text-destructive">{templateError}</div>
                )}
                <Button
                  type="button"
                  onClick={onTemplateSubmit}
                  disabled={createFromTemplate.isPending}
                  className="w-full"
                  data-testid="button-create-from-template"
                >
                  {createFromTemplate.isPending
                    ? t("createOrg.creating")
                    : t("createOrg.template.createButton")}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="blank">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onBlankSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("createOrg.orgName")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("createOrg.orgNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("createOrg.industry")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("createOrg.industryPlaceholder")} {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("createOrg.description")}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t("createOrg.descriptionPlaceholder")} {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createOrg.isPending}>
                  {createOrg.isPending ? t("createOrg.creating") : t("createOrg.createButton")}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
