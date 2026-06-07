import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Database,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  RefreshCw,
  XCircle,
  Clock,
} from "lucide-react";
import {
  useGetHrisSettings,
  useUpdateHrisSettings,
  useTestHrisConnection,
  useGetHrisImportPreview,
  useImportFromHris,
  useRunHrisSyncNow,
  useDetectImportDuplicates,
  getGetHrisSettingsQueryKey,
  getGetHrisImportPreviewQueryKey,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getGetOrgDashboardQueryKey,
  getGetOrgChartQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  type HrisUser,
  type HrisImportReport,
  type HrisSettingsUpdate,
  type HrisSettingsUpdateProvider,
  type DuplicateDetectionResult,
  type ImportDecision,
} from "@workspace/api-client-react";
import {
  DuplicateResolver,
  type DuplicateCandidateInput,
} from "./duplicate-resolver";

interface Props {
  orgId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "settings" | "select" | "duplicates" | "results";
type Provider = "" | "bamboohr" | "workday";

export function HrisImportWizard({ orgId, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("settings");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [report, setReport] = useState<HrisImportReport | null>(null);
  const [dupCandidates, setDupCandidates] = useState<DuplicateCandidateInput[]>([]);
  const [dupResults, setDupResults] = useState<DuplicateDetectionResult[]>([]);
  const [dupSubmitError, setDupSubmitError] = useState<string | null>(null);
  const detectMutation = useDetectImportDuplicates();

  const [provider, setProvider] = useState<Provider>("");
  const [subdomain, setSubdomain] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [settingsSavedAt, setSettingsSavedAt] = useState<number | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncCadence, setSyncCadence] = useState(24);
  const [syncUpdateExisting, setSyncUpdateExisting] = useState(true);
  const [syncDeactivateMissing, setSyncDeactivateMissing] = useState(true);

  const settingsQuery = useGetHrisSettings(orgId, {
    query: { enabled: open, queryKey: getGetHrisSettingsQueryKey(orgId) },
  });
  const settings = settingsQuery.data;

  useEffect(() => {
    if (!settings) return;
    setProvider((settings.provider || "") as Provider);
    setSubdomain(settings.subdomain || "");
    setReportUrl(settings.reportUrl || "");
    setUsername(settings.username || "");
    setSyncEnabled(settings.syncEnabled);
    setSyncCadence(settings.cadenceHours || 24);
    setSyncUpdateExisting(settings.updateExisting);
    setSyncDeactivateMissing(settings.deactivateMissing);
    setFieldMapping({ ...(settings.fieldMapping ?? {}) });
  }, [settings]);

  const MAPPING_FIELDS = [
    "externalId",
    "firstName",
    "lastName",
    "email",
    "jobTitle",
    "department",
    "phone",
    "location",
    "managerExternalId",
    "isActive",
  ] as const;

  const DEFAULT_MAPPING: Record<Provider, Record<string, string>> = {
    "": {},
    bamboohr: {
      externalId: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "workEmail",
      jobTitle: "jobTitle",
      department: "department",
      phone: "workPhone",
      location: "location",
      managerExternalId: "supervisorEId",
      isActive: "status",
    },
    workday: {
      externalId: "Employee_ID",
      firstName: "First_Name",
      lastName: "Last_Name",
      email: "Email",
      jobTitle: "Job_Title",
      department: "Department",
      phone: "Phone",
      location: "Location",
      managerExternalId: "Manager_ID",
      isActive: "Status",
    },
  };

  const mappingFor = (key: string) =>
    fieldMapping[key] ?? DEFAULT_MAPPING[provider]?.[key] ?? "";

  const configured =
    !!settings &&
    !!settings.provider &&
    settings.hasCredentials &&
    ((settings.provider === "bamboohr" && !!settings.subdomain) ||
      (settings.provider === "workday" && !!settings.reportUrl && !!settings.username));

  const previewQuery = useGetHrisImportPreview(orgId, {
    query: {
      enabled: open && configured && step === "select",
      queryKey: getGetHrisImportPreviewQueryKey(orgId),
    },
  });
  const users: HrisUser[] = previewQuery.data?.users ?? [];

  useEffect(() => {
    if (!open) {
      setStep("settings");
      setSelected(new Set());
      setSearch("");
      setReport(null);
      setDupCandidates([]);
      setDupResults([]);
      setDupSubmitError(null);
      setSecret("");
      setSettingsSavedAt(null);
    }
  }, [open]);

  const updateSettingsMutation = useUpdateHrisSettings({
    mutation: {
      onSuccess: () => {
        setSettingsSavedAt(Date.now());
        setSecret("");
        qc.invalidateQueries({ queryKey: getGetHrisSettingsQueryKey(orgId) });
      },
    },
  });

  const testMutation = useTestHrisConnection();

  const runSyncMutation = useRunHrisSyncNow({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetHrisSettingsQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getListEmployeesQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetOrgChartQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(orgId) });
      },
    },
  });

  const importMutation = useImportFromHris({
    mutation: {
      onSuccess: (data) => {
        setReport(data);
        qc.invalidateQueries({ queryKey: getListEmployeesQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetOrgChartQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(orgId) });
        setStep("results");
      },
    },
  });

  const buildSettingsPayload = (extras?: Partial<HrisSettingsUpdate>): HrisSettingsUpdate => {
    const data: HrisSettingsUpdate = {
      provider: provider as HrisSettingsUpdateProvider,
      subdomain,
      reportUrl,
      username,
      syncEnabled,
      cadenceHours: syncCadence,
      updateExisting: syncUpdateExisting,
      deactivateMissing: syncDeactivateMissing,
      fieldMapping,
      ...extras,
    };
    if (secret) {
      if (provider === "bamboohr") data.apiToken = secret;
      else if (provider === "workday") data.password = secret;
    }
    return data;
  };

  const saveSettings = () => {
    updateSettingsMutation.mutate({ orgId, data: buildSettingsPayload() });
  };

  const testConnection = async () => {
    // Save current credentials/config first so the test uses them.
    await updateSettingsMutation.mutateAsync({ orgId, data: buildSettingsPayload() });
    testMutation.mutate({ orgId });
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
      return (
        name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.jobTitle ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selected.has(u.externalId));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const u of filteredUsers) next.delete(u.externalId);
      } else {
        for (const u of filteredUsers) next.add(u.externalId);
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildCandidates = (): DuplicateCandidateInput[] => {
    const out: DuplicateCandidateInput[] = [];
    for (const u of users) {
      if (!selected.has(u.externalId)) continue;
      const email = (u.email ?? "").trim().toLowerCase();
      if (!email) continue;
      out.push({
        key: u.externalId,
        firstName: (u.firstName ?? "").trim(),
        lastName: (u.lastName ?? "").trim(),
        email,
        phone: (u.phone ?? "").trim(),
        title: (u.jobTitle ?? "").trim(),
        department: (u.department ?? "").trim(),
      });
    }
    return out;
  };

  const runImport = (decisions: Record<string, ImportDecision>) => {
    importMutation.mutate({
      orgId,
      data: {
        externalIds: Array.from(selected),
        updateExisting,
        decisions: Object.keys(decisions).length > 0 ? decisions : undefined,
      },
    });
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setDupSubmitError(null);
    const candidates = buildCandidates();
    if (candidates.length === 0) {
      runImport({});
      return;
    }
    try {
      const res = await detectMutation.mutateAsync({ orgId, data: { candidates } });
      const conflicting = res.results.filter((r) => r.matches.length > 0);
      if (conflicting.length === 0) {
        runImport({});
        return;
      }
      setDupCandidates(candidates);
      setDupResults(res.results);
      setStep("duplicates");
    } catch (e) {
      setDupSubmitError((e as Error)?.message || t("hrisImport.error"));
    }
  };

  const stepOrder: Record<Step, number> = {
    settings: 0,
    select: 1,
    duplicates: 2,
    results: 3,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            {t("hrisImport.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 my-3 text-xs flex-wrap">
          {(["settings", "select", "duplicates", "results"] as Step[]).map((s, idx, arr) => {
            const active = step === s;
            const done = stepOrder[step] > stepOrder[s];
            return (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-semibold ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className={active ? "font-medium" : "text-muted-foreground"}>
                  {t(`hrisImport.step.${s}`)}
                </span>
                {idx < arr.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
                )}
              </div>
            );
          })}
        </div>

        {step === "settings" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("hrisImport.connectIntro")}</p>

            <div>
              <label className="text-xs font-medium block mb-1">
                {t("hrisImport.providerLabel")}
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-hris-provider"
              >
                <option value="">{t("hrisImport.providerNone")}</option>
                <option value="bamboohr">BambooHR</option>
                <option value="workday">Workday</option>
              </select>
            </div>

            {provider === "bamboohr" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("hrisImport.subdomainLabel")}
                  </label>
                  <Input
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="acme"
                    data-testid="input-hris-subdomain"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t("hrisImport.subdomainHint")}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("hrisImport.apiTokenLabel")}
                  </label>
                  <Input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={
                      settings?.hasCredentials
                        ? t("hrisImport.secretKeepHint")
                        : ""
                    }
                    data-testid="input-hris-token"
                  />
                </div>
              </div>
            )}

            {provider === "workday" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1">
                    {t("hrisImport.reportUrlLabel")}
                  </label>
                  <Input
                    value={reportUrl}
                    onChange={(e) => setReportUrl(e.target.value)}
                    placeholder="https://wd5-impl-services1.workday.com/ccx/service/customreport2/.../json"
                    data-testid="input-hris-report-url"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t("hrisImport.reportUrlHint")}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">
                      {t("hrisImport.usernameLabel")}
                    </label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      data-testid="input-hris-username"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">
                      {t("hrisImport.passwordLabel")}
                    </label>
                    <Input
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder={
                        settings?.hasCredentials
                          ? t("hrisImport.secretKeepHint")
                          : ""
                      }
                      data-testid="input-hris-password"
                    />
                  </div>
                </div>
              </div>
            )}

            {testMutation.data && (
              <div
                className={`flex items-start gap-2 px-3 py-2 rounded-md text-xs ${
                  testMutation.data.ok
                    ? "bg-green-500/10 text-green-700"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {testMutation.data.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                )}
                <p>
                  {testMutation.data.ok
                    ? t("hrisImport.testOk", { count: testMutation.data.count ?? 0 })
                    : testMutation.data.message ?? t("hrisImport.testFail")}
                </p>
              </div>
            )}
            {(testMutation.error || updateSettingsMutation.error) && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-md text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                <p>
                  {(
                    (testMutation.error as Error) ||
                    (updateSettingsMutation.error as Error)
                  ).message}
                </p>
              </div>
            )}

            {provider && (
              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <p className="font-medium text-sm">{t("hrisImport.sync.title")}</p>
                </div>
                <p className="text-xs text-muted-foreground">{t("hrisImport.sync.intro")}</p>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncEnabled}
                    onChange={(e) => setSyncEnabled(e.target.checked)}
                    className="mt-0.5"
                    data-testid="checkbox-hris-sync-enabled"
                  />
                  <div className="text-sm">
                    <p className="font-medium">{t("hrisImport.sync.enableLabel")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("hrisImport.sync.enableHint")}
                    </p>
                  </div>
                </label>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">
                      {t("hrisImport.sync.cadenceLabel")}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={syncCadence}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v))
                          setSyncCadence(Math.min(168, Math.max(1, v)));
                      }}
                      data-testid="input-hris-sync-cadence"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t("hrisImport.sync.cadenceHint")}
                    </p>
                  </div>
                  <div className="text-xs space-y-1">
                    {settings?.lastSyncStatus === "success" && (
                      <p className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("hrisImport.sync.statusSuccess")}
                      </p>
                    )}
                    {settings?.lastSyncStatus === "failure" && (
                      <p className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-3.5 w-3.5" />
                        {t("hrisImport.sync.statusFailure")}
                      </p>
                    )}
                    {settings?.lastSyncStatus === "never" && (
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {t("hrisImport.sync.statusNever")}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t("hrisImport.sync.lastSync")}:
                      </span>{" "}
                      {settings?.lastSyncAt
                        ? new Date(settings.lastSyncAt).toLocaleString()
                        : t("hrisImport.sync.neverSynced")}
                    </p>
                    {settings?.nextSyncAt && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {t("hrisImport.sync.nextSync")}:
                        </span>{" "}
                        {new Date(settings.nextSyncAt).toLocaleString()}
                      </p>
                    )}
                    {settings?.lastSyncAt && (
                      <p className="text-muted-foreground">
                        {t("hrisImport.sync.lastResult", {
                          added: settings.lastAdded,
                          updated: settings.lastUpdated,
                          deactivated: settings.lastDeactivated,
                          failed: settings.lastFailed,
                        })}
                      </p>
                    )}
                    {settings?.lastSyncStatus === "failure" && settings.lastSyncMessage && (
                      <p className="text-destructive">{settings.lastSyncMessage}</p>
                    )}
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncUpdateExisting}
                    onChange={(e) => setSyncUpdateExisting(e.target.checked)}
                    className="mt-0.5"
                    data-testid="checkbox-hris-sync-update"
                  />
                  <div className="text-sm">
                    <p className="font-medium">
                      {t("hrisImport.sync.updateExistingLabel")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("hrisImport.sync.updateExistingHint")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncDeactivateMissing}
                    onChange={(e) => setSyncDeactivateMissing(e.target.checked)}
                    className="mt-0.5"
                    data-testid="checkbox-hris-sync-deactivate"
                  />
                  <div className="text-sm">
                    <p className="font-medium">
                      {t("hrisImport.sync.deactivateMissingLabel")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("hrisImport.sync.deactivateMissingHint")}
                    </p>
                  </div>
                </label>

                {runSyncMutation.error && (
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-md text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                    <p>{(runSyncMutation.error as Error).message}</p>
                  </div>
                )}
              </div>
            )}

            {provider && (
              <div className="border rounded-md p-3 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowMapping((v) => !v)}
                  className="flex items-center justify-between w-full text-sm font-medium"
                  data-testid="button-hris-mapping-toggle"
                >
                  <span>{t("hrisImport.mapping.title")}</span>
                  <span className="text-xs text-muted-foreground">
                    {showMapping
                      ? t("hrisImport.mapping.hide")
                      : t("hrisImport.mapping.show")}
                  </span>
                </button>
                {showMapping && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t("hrisImport.mapping.help")}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MAPPING_FIELDS.map((key) => (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-xs font-medium">
                            {t(`hrisImport.mapping.fields.${key}` as never)}
                          </label>
                          <input
                            type="text"
                            value={mappingFor(key)}
                            placeholder={
                              DEFAULT_MAPPING[provider]?.[key] ?? ""
                            }
                            onChange={(e) =>
                              setFieldMapping((m) => ({
                                ...m,
                                [key]: e.target.value,
                              }))
                            }
                            className="border rounded-md px-2 py-1 text-sm"
                            data-testid={`input-hris-mapping-${key}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setFieldMapping({
                            ...(DEFAULT_MAPPING[provider] ?? {}),
                          })
                        }
                        data-testid="button-hris-mapping-reset"
                      >
                        {t("hrisImport.mapping.reset")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={
                  !provider ||
                  testMutation.isPending ||
                  updateSettingsMutation.isPending
                }
                data-testid="button-hris-test"
              >
                {testMutation.isPending && (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                )}
                {t("hrisImport.testConnection")}
              </Button>
              {configured && (
                <Button
                  variant="outline"
                  onClick={() => runSyncMutation.mutate({ orgId })}
                  disabled={runSyncMutation.isPending}
                  data-testid="button-hris-sync-run"
                >
                  {runSyncMutation.isPending ? (
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 me-2" />
                  )}
                  {t("hrisImport.sync.runNow")}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={saveSettings}
                disabled={!provider || updateSettingsMutation.isPending}
                data-testid="button-hris-settings-save"
              >
                {updateSettingsMutation.isPending && (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                )}
                {updateSettingsMutation.isPending
                  ? t("hrisImport.sync.saving")
                  : settingsSavedAt && Date.now() - settingsSavedAt < 3000
                    ? t("hrisImport.sync.saved")
                    : t("hrisImport.sync.save")}
              </Button>
              <Button
                onClick={() => setStep("select")}
                disabled={!configured}
                data-testid="button-hris-next"
              >
                {t("hrisImport.next")}
                <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-3">
            {previewQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("hrisImport.loadingUsers")}
              </div>
            )}
            {previewQuery.error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <p>{(previewQuery.error as Error).message}</p>
              </div>
            )}
            {!previewQuery.isLoading && !previewQuery.error && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("hrisImport.searchPlaceholder")}
                      className="ps-9"
                      data-testid="input-hris-search"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("hrisImport.selectedCount", {
                      selected: selected.size,
                      total: users.length,
                    })}
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 text-xs font-medium grid grid-cols-[28px_1fr_1fr_1fr] gap-2">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      data-testid="checkbox-hris-select-all"
                    />
                    <span>{t("hrisImport.col.name")}</span>
                    <span>{t("hrisImport.col.title")}</span>
                    <span>{t("hrisImport.col.department")}</span>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto divide-y divide-border">
                    {filteredUsers.map((u) => {
                      const checked = selected.has(u.externalId);
                      const name =
                        `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "—";
                      return (
                        <label
                          key={u.externalId}
                          className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 items-center px-3 py-2 text-sm hover:bg-muted/30 cursor-pointer"
                          data-testid={`row-hris-user-${u.externalId}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(u.externalId)}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.email || ""}
                            </p>
                          </div>
                          <span className="truncate text-muted-foreground">
                            {u.jobTitle || "—"}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {u.department || "—"}
                          </span>
                        </label>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {t("hrisImport.noUsers")}
                      </div>
                    )}
                  </div>
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="mt-0.5"
                    data-testid="checkbox-hris-update-existing"
                  />
                  <div className="text-sm">
                    <p className="font-medium">{t("hrisImport.updateExistingTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("hrisImport.updateExistingHint")}
                    </p>
                  </div>
                </label>

                {(importMutation.error || dupSubmitError) && (
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <p>
                      {dupSubmitError ||
                        (importMutation.error as Error).message}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStep("settings")}>
                    {t("hrisImport.back")}
                  </Button>
                  <Button
                    onClick={submit}
                    disabled={
                      selected.size === 0 ||
                      importMutation.isPending ||
                      detectMutation.isPending
                    }
                    data-testid="button-hris-import"
                  >
                    {(importMutation.isPending || detectMutation.isPending) && (
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    )}
                    {t("hrisImport.import", { count: selected.size })}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === "duplicates" && (
          <DuplicateResolver
            candidates={dupCandidates}
            results={dupResults}
            onBack={() => {
              setStep("select");
              setDupSubmitError(null);
            }}
            onConfirm={(decisions) => runImport(decisions)}
            submitting={importMutation.isPending}
            submitError={
              dupSubmitError ||
              (importMutation.error
                ? (importMutation.error as Error).message
                : null)
            }
          />
        )}

        {step === "results" && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">{t("hrisImport.complete")}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("hrisImport.summary", {
                added: report.added.length,
                updated: report.updated.length,
                skipped: report.skipped.length,
                failed: report.failed.length,
              })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("hrisImport.added")}</p>
                <p className="text-lg font-semibold">{report.added.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("hrisImport.updatedCount")}
                </p>
                <p className="text-lg font-semibold">{report.updated.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("hrisImport.skippedCount")}
                </p>
                <p className="text-lg font-semibold">{report.skipped.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("hrisImport.failed")}</p>
                <p className="text-lg font-semibold">{report.failed.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("hrisImport.deactivated")}
                </p>
                <p className="text-lg font-semibold">
                  {report.deactivated?.length ?? 0}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("hrisImport.deptsCreated")}: {report.departmentsCreated} •{" "}
              {t("hrisImport.managersLinked")}: {report.managersLinked}
            </p>
            {(report.skipped.length > 0 || report.failed.length > 0) && (
              <div className="border border-border rounded-lg p-3 max-h-[30vh] overflow-y-auto text-xs space-y-1">
                <p className="font-medium mb-2">{t("hrisImport.issues")}</p>
                {[...report.skipped, ...report.failed].map((r, i) => (
                  <div key={`${r.externalId}-${i}`} className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                    <span className="flex-1">
                      <span className="font-medium">{r.name || r.email}</span>
                      {r.reason && (
                        <span className="text-muted-foreground"> — {r.reason}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                {t("hrisImport.close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
