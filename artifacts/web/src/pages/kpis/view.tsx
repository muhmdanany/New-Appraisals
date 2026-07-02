import { useState } from "react";
import { useParams } from "wouter";
import { useTranslation } from "@/lib/i18n";
import {
  useGetKpiSet,
  getGetKpiSetQueryKey,
  useSaveKpiSet,
  useListJobs,
  useGenerateKpis,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { FormDialog, TextAreaField, useCanManage } from "@/components/form-fields";

const numOrUndef = (s: string) => (s.trim() === "" ? undefined : Number(s));

type KpiRow = { name: string; description: string; target: string; measure: string; frequency: string; weight: string };
type GroupRow = { competencyName: string; compType: string; kpis: KpiRow[] };
const emptyKpi: KpiRow = { name: "", description: "", target: "", measure: "", frequency: "", weight: "" };
const emptyGroup: GroupRow = { competencyName: "", compType: "", kpis: [{ ...emptyKpi }] };

export default function JobKpis() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const { data: kpiSet, isLoading } = useGetKpiSet(jobId!, {
    query: { enabled: !!jobId, queryKey: getGetKpiSetQueryKey(jobId!) },
  });
  const { data: jobs } = useListJobs();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = useCanManage();
  const save = useSaveKpiSet();
  const generate = useGenerateKpis();

  const jobName = jobs?.find((j) => j.id === jobId)?.name;

  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [groups, setGroups] = useState<GroupRow[]>([{ ...emptyGroup }]);

  const handleGenerate = () => {
    generate.mutate(
      { jobId: jobId! },
      {
        onSuccess: () => {
          toast({ title: t("kpis.aiGenerated") });
          qc.invalidateQueries({ queryKey: getGetKpiSetQueryKey(jobId!) });
        },
        onError: () => toast({ title: t("kpis.aiFailed"), variant: "destructive" }),
      },
    );
  };

  const openEditor = () => {
    setSummary(kpiSet?.summary ?? "");
    setGroups(
      kpiSet?.groups && kpiSet.groups.length
        ? kpiSet.groups.map((g) => ({
            competencyName: g.competencyName,
            compType: g.compType ?? "",
            kpis: g.kpis.length
              ? g.kpis.map((k) => ({
                  name: k.name,
                  description: k.description ?? "",
                  target: k.target ?? "",
                  measure: k.measure ?? "",
                  frequency: k.frequency ?? "",
                  weight: k.weight != null ? String(k.weight) : "",
                }))
              : [{ ...emptyKpi }],
          }))
        : [{ ...emptyGroup }],
    );
    setOpen(true);
  };

  const setGroup = (gi: number, patch: Partial<GroupRow>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setKpi = (gi: number, ki: number, patch: Partial<KpiRow>) =>
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi ? { ...g, kpis: g.kpis.map((k, j) => (j === ki ? { ...k, ...patch } : k)) } : g,
      ),
    );

  const submit = () => {
    const cleanGroups = groups
      .filter((g) => g.competencyName.trim())
      .map((g) => ({
        competencyName: g.competencyName,
        compType: g.compType || undefined,
        kpis: g.kpis
          .filter((k) => k.name.trim())
          .map((k) => ({
            name: k.name,
            description: k.description || undefined,
            target: k.target || undefined,
            measure: k.measure || undefined,
            frequency: k.frequency || undefined,
            weight: numOrUndef(k.weight),
          })),
      }));
    if (cleanGroups.length === 0) {
      toast({ title: t("kpis.addGroupFirst"), variant: "destructive" });
      return;
    }
    save.mutate(
      { jobId: jobId!, data: { summary: summary || undefined, groups: cleanGroups } },
      {
        onSuccess: () => {
          toast({ title: t("kpis.saved") });
          setOpen(false);
          qc.invalidateQueries({ queryKey: getGetKpiSetQueryKey(jobId!) });
        },
        onError: () => toast({ title: t("common.genericError"), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("kpis.title")}{jobName ? ` - ${jobName}` : ""}</h1>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerate} disabled={generate.isPending}>
              <Sparkles className="w-4 h-4 ml-2" />
              {generate.isPending ? t("kpis.generating") : t("common.aiGenerate")}
            </Button>
            <Button onClick={openEditor}>
              <Pencil className="w-4 h-4 ml-2" />
              {kpiSet?.groups?.length ? t("kpis.editKpis") : t("kpis.addKpis")}
            </Button>
          </div>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("kpis.indicators")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !kpiSet?.groups?.length ? (
            <p className="text-muted-foreground">{t("kpis.noKpisYet")}</p>
          ) : (
            <div className="space-y-8">
              {kpiSet.groups.map((group) => (
                <div key={group.id} className="space-y-4">
                  <h3 className="text-xl font-semibold bg-muted p-2 rounded">{group.competencyName}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{t("kpis.indicator")}</TableHead>
                        <TableHead className="text-right">{t("common.description")}</TableHead>
                        <TableHead className="text-right">{t("kpis.target")}</TableHead>
                        <TableHead className="text-right">{t("kpis.weight")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.kpis.map((kpi) => (
                        <TableRow key={kpi.id}>
                          <TableCell>{kpi.name}</TableCell>
                          <TableCell>{kpi.description}</TableCell>
                          <TableCell>{kpi.target}</TableCell>
                          <TableCell>{kpi.weight ? `${kpi.weight}%` : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t("kpis.editTitle")}
        onSubmit={submit}
        submitting={save.isPending}
        wide
      >
        <TextAreaField label={t("kpis.summary")} value={summary} onChange={setSummary} rows={2} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t("kpis.groups")}</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setGroups([...groups, { ...emptyGroup, kpis: [{ ...emptyKpi }] }])}>
              <Plus className="w-4 h-4 ml-1" /> {t("kpis.group")}
            </Button>
          </div>
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-md border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">{t("kpis.groupName")}</Label>
                  <Input value={g.competencyName} onChange={(e) => setGroup(gi, { competencyName: e.target.value })} />
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-xs">{t("kpis.kpiType")}</Label>
                  <Input value={g.compType} onChange={(e) => setGroup(gi, { compType: e.target.value })} />
                </div>
                {groups.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="mt-5" onClick={() => setGroups(groups.filter((_, i) => i !== gi))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="space-y-2 pr-2 border-r-2 border-border">
                {g.kpis.map((k, ki) => (
                  <div key={ki} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">{t("kpis.kpiName")}</Label>
                      <Input value={k.name} onChange={(e) => setKpi(gi, ki, { name: e.target.value })} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">{t("kpis.kpiTarget")}</Label>
                      <Input value={k.target} onChange={(e) => setKpi(gi, ki, { target: e.target.value })} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{t("kpis.frequency")}</Label>
                      <Input value={k.frequency} onChange={(e) => setKpi(gi, ki, { frequency: e.target.value })} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{t("kpis.weightPercent")}</Label>
                      <Input type="number" value={k.weight} onChange={(e) => setKpi(gi, ki, { weight: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      {g.kpis.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setGroup(gi, { kpis: g.kpis.filter((_, j) => j !== ki) })}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => setGroup(gi, { kpis: [...g.kpis, { ...emptyKpi }] })}>
                  <Plus className="w-4 h-4 ml-1" /> {t("kpis.addIndicator")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </FormDialog>
    </div>
  );
}
