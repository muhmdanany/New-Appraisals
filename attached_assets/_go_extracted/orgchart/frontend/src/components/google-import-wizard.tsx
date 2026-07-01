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
  Cloud,
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
  useGetGoogleImportStatus,
  useGetGoogleImportPreview,
  useImportFromGoogle,
  useDetectImportDuplicates,
  useGetGoogleSyncSettings,
  useUpdateGoogleSyncSettings,
  useRunGoogleSyncNow,
  getGetGoogleImportStatusQueryKey,
  getGetGoogleImportPreviewQueryKey,
  getGetGoogleSyncSettingsQueryKey,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getGetOrgDashboardQueryKey,
  getGetOrgChartQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  type GoogleUser,
  type GoogleImportReport,
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

type Step = "connect" | "select" | "duplicates" | "results";

export function GoogleImportWizard({ orgId, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("connect");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [report, setReport] = useState<GoogleImportReport | null>(null);
  const [dupCandidates, setDupCandidates] = useState<DuplicateCandidateInput[]>([]);
  const [dupResults, setDupResults] = useState<DuplicateDetectionResult[]>([]);
  const [dupSubmitError, setDupSubmitError] = useState<string | null>(null);
  const detectMutation = useDetectImportDuplicates();

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const statusQuery = useGetGoogleImportStatus(orgId, {
    query: { enabled: open, queryKey: getGetGoogleImportStatusQueryKey(orgId) },
  });
  const connected = !!statusQuery.data?.connected;

  const previewQuery = useGetGoogleImportPreview(orgId, {
    query: {
      enabled: open && connected && step !== "results",
      queryKey: getGetGoogleImportPreviewQueryKey(orgId),
    },
  });
  const users = previewQuery.data?.users ?? [];

  useEffect(() => {
    if (!open) return;
    if (connected && step === "connect") setStep("select");
  }, [open, connected, step]);

  useEffect(() => {
    if (!open) {
      setStep("connect");
      setSelected(new Set());
      setSearch("");
      setReport(null);
      setDupCandidates([]);
      setDupResults([]);
      setDupSubmitError(null);
    }
  }, [open]);

  const syncSettingsQuery = useGetGoogleSyncSettings(orgId, {
    query: {
      enabled: open && connected,
      queryKey: getGetGoogleSyncSettingsQueryKey(orgId),
    },
  });
  const syncSettings = syncSettingsQuery.data;
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncCadence, setSyncCadence] = useState(24);
  const [syncUpdateExisting, setSyncUpdateExisting] = useState(true);
  const [syncDeactivateMissing, setSyncDeactivateMissing] = useState(true);
  const [syncSavedAt, setSyncSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!syncSettings) return;
    setSyncEnabled(syncSettings.enabled);
    setSyncCadence(syncSettings.cadenceHours);
    setSyncUpdateExisting(syncSettings.updateExisting);
    setSyncDeactivateMissing(syncSettings.deactivateMissing);
  }, [syncSettings]);

  const updateSyncMutation = useUpdateGoogleSyncSettings({
    mutation: {
      onSuccess: () => {
        setSyncSavedAt(Date.now());
        qc.invalidateQueries({ queryKey: getGetGoogleSyncSettingsQueryKey(orgId) });
      },
    },
  });

  const runSyncMutation = useRunGoogleSyncNow({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGoogleSyncSettingsQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getListEmployeesQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetOrgChartQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey(orgId) });
        qc.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(orgId) });
      },
    },
  });

  const saveSync = () => {
    updateSyncMutation.mutate({
      orgId,
      data: {
        enabled: syncEnabled,
        cadenceHours: syncCadence,
        updateExisting: syncUpdateExisting,
        deactivateMissing: syncDeactivateMissing,
        setServiceUserToCurrent: !syncSettings?.serviceUserId,
      },
    });
  };

  const importMutation = useImportFromGoogle({
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

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u: GoogleUser) => {
      return (
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.primaryEmail ?? "").toLowerCase().includes(q) ||
        (u.jobTitle ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selected.has(u.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const u of filteredUsers) next.delete(u.id);
      } else {
        for (const u of filteredUsers) next.add(u.id);
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

  const startConnect = async () => {
    const res = await fetch(`${apiBase}/auth/google/connect-workspace`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.authorizeUrl) {
      window.location.href = data.authorizeUrl;
    }
  };

  const buildCandidates = (): DuplicateCandidateInput[] => {
    const out: DuplicateCandidateInput[] = [];
    for (const u of users as GoogleUser[]) {
      if (!selected.has(u.id)) continue;
      const email = (u.primaryEmail ?? "").trim().toLowerCase();
      if (!email) continue;
      const display = (u.displayName ?? "").trim();
      const parts = display.split(/\s+/);
      out.push({
        key: u.id,
        firstName: u.givenName?.trim() || parts[0] || "",
        lastName: u.familyName?.trim() || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
        email,
        phone: u.mobilePhone?.trim() || "",
        title: u.jobTitle?.trim() || "",
        department: u.department?.trim() || "",
      });
    }
    return out;
  };

  const runImport = (decisions: Record<string, ImportDecision>) => {
    importMutation.mutate({
      orgId,
      data: {
        userIds: Array.from(selected),
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
      setDupSubmitError((e as Error)?.message || t("googleImport.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            {t("googleImport.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 my-3 text-xs flex-wrap">
          {(["connect", "select", "duplicates", "results"] as Step[]).map((s, idx, arr) => {
            const order: Record<Step, number> = {
              connect: 0,
              select: 1,
              duplicates: 2,
              results: 3,
            };
            const active = step === s;
            const done = order[step] > order[s];
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
                  {t(`googleImport.step.${s}`)}
                </span>
                {idx < arr.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
                )}
              </div>
            );
          })}
        </div>

        {connected && syncSettings && step !== "results" && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20" data-testid="google-sync-panel">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">{t("googleImport.sync.title")}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {syncSettings.lastSyncStatus === "success" && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("googleImport.sync.statusSuccess")}
                  </span>
                )}
                {syncSettings.lastSyncStatus === "failure" && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    {t("googleImport.sync.statusFailure")}
                  </span>
                )}
                {syncSettings.lastSyncStatus === "never" && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {t("googleImport.sync.statusNever")}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("googleImport.sync.intro")}</p>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                className="mt-0.5"
                data-testid="checkbox-google-sync-enabled"
              />
              <div className="text-sm">
                <p className="font-medium">{t("googleImport.sync.enableLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("googleImport.sync.enableHint")}</p>
              </div>
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">
                  {t("googleImport.sync.cadenceLabel")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={syncCadence}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) setSyncCadence(Math.min(168, Math.max(1, v)));
                  }}
                  data-testid="input-google-sync-cadence"
                />
                <p className="text-[11px] text-muted-foreground mt-1">{t("googleImport.sync.cadenceHint")}</p>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">{t("googleImport.sync.lastSync")}:</span>{" "}
                  {syncSettings.lastSyncAt
                    ? new Date(syncSettings.lastSyncAt).toLocaleString()
                    : t("googleImport.sync.neverSynced")}
                </p>
                {syncSettings.nextSyncAt && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{t("googleImport.sync.nextSync")}:</span>{" "}
                    {new Date(syncSettings.nextSyncAt).toLocaleString()}
                  </p>
                )}
                {syncSettings.lastSyncAt && (
                  <p className="text-muted-foreground">
                    {t("googleImport.sync.lastResult", {
                      added: syncSettings.lastAdded,
                      updated: syncSettings.lastUpdated,
                      deactivated: syncSettings.lastDeactivated,
                      failed: syncSettings.lastFailed,
                    })}
                  </p>
                )}
                {syncSettings.lastSyncStatus === "failure" && syncSettings.lastSyncMessage && (
                  <p className="text-destructive">{syncSettings.lastSyncMessage}</p>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncUpdateExisting}
                onChange={(e) => setSyncUpdateExisting(e.target.checked)}
                className="mt-0.5"
                data-testid="checkbox-google-sync-update"
              />
              <div className="text-sm">
                <p className="font-medium">{t("googleImport.sync.updateExistingLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("googleImport.sync.updateExistingHint")}</p>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncDeactivateMissing}
                onChange={(e) => setSyncDeactivateMissing(e.target.checked)}
                className="mt-0.5"
                data-testid="checkbox-google-sync-deactivate"
              />
              <div className="text-sm">
                <p className="font-medium">{t("googleImport.sync.deactivateMissingLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("googleImport.sync.deactivateMissingHint")}</p>
              </div>
            </label>

            <div className="text-xs text-muted-foreground">
              {syncSettings.serviceUserId ? (
                <>
                  {t("googleImport.sync.linkedAs")}:{" "}
                  <span className="font-medium text-foreground">
                    {syncSettings.serviceUserName || syncSettings.serviceUserEmail}
                  </span>
                </>
              ) : (
                t("googleImport.sync.serviceAccount")
              )}
            </div>

            {updateSyncMutation.error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-md text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                <p>{(updateSyncMutation.error as Error).message}</p>
              </div>
            )}
            {runSyncMutation.error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-md text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                <p>{(runSyncMutation.error as Error).message}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSyncMutation.mutate({ orgId })}
                disabled={runSyncMutation.isPending}
                data-testid="button-google-sync-run"
              >
                {runSyncMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 me-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 me-2" />
                )}
                {t("googleImport.sync.runNow")}
              </Button>
              <Button
                size="sm"
                onClick={saveSync}
                disabled={updateSyncMutation.isPending}
                data-testid="button-google-sync-save"
              >
                {updateSyncMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 me-2 animate-spin" />
                )}
                {updateSyncMutation.isPending
                  ? t("googleImport.sync.saving")
                  : syncSavedAt && Date.now() - syncSavedAt < 3000
                    ? t("googleImport.sync.saved")
                    : t("googleImport.sync.save")}
              </Button>
            </div>
          </div>
        )}

        {step === "connect" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("googleImport.connectIntro")}</p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
              <p className="font-medium">{t("googleImport.requiredScopes")}</p>
              <p className="text-muted-foreground">
                openid · email · profile · admin.directory.user.readonly
              </p>
            </div>
            <Button
              onClick={startConnect}
              disabled={statusQuery.isLoading}
              data-testid="button-google-connect"
            >
              <Cloud className="h-4 w-4 me-2" />
              {t("googleImport.connectButton")}
            </Button>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-3">
            {previewQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("googleImport.loadingUsers")}
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
                      placeholder={t("googleImport.searchPlaceholder")}
                      className="ps-9"
                      data-testid="input-google-search"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("googleImport.selectedCount", {
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
                      data-testid="checkbox-google-select-all"
                    />
                    <span>{t("googleImport.col.name")}</span>
                    <span>{t("googleImport.col.title")}</span>
                    <span>{t("googleImport.col.department")}</span>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto divide-y divide-border">
                    {filteredUsers.map((u) => {
                      const checked = selected.has(u.id);
                      return (
                        <label
                          key={u.id}
                          className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 items-center px-3 py-2 text-sm hover:bg-muted/30 cursor-pointer"
                          data-testid={`row-google-user-${u.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(u.id)}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.displayName || "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.primaryEmail || ""}
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
                        {t("googleImport.noUsers")}
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
                    data-testid="checkbox-google-update-existing"
                  />
                  <div className="text-sm">
                    <p className="font-medium">{t("googleImport.updateExistingTitle")}</p>
                    <p className="text-xs text-muted-foreground">{t("googleImport.updateExistingHint")}</p>
                  </div>
                </label>

                {importMutation.error && (
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <p>{(importMutation.error as Error).message}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={submit}
                    disabled={selected.size === 0 || importMutation.isPending}
                    data-testid="button-google-import"
                  >
                    {importMutation.isPending && (
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    )}
                    {t("googleImport.import", { count: selected.size })}
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
              (importMutation.error ? (importMutation.error as Error).message : null)
            }
          />
        )}

        {step === "results" && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">{t("googleImport.complete")}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("googleImport.summary", {
                added: report.added.length,
                updated: report.updated.length,
                skipped: report.skipped.length,
                failed: report.failed.length,
              })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("googleImport.added")}</p>
                <p className="text-lg font-semibold">{report.added.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("googleImport.updatedCount")}</p>
                <p className="text-lg font-semibold">{report.updated.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("googleImport.skippedCount")}</p>
                <p className="text-lg font-semibold">{report.skipped.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("googleImport.failed")}</p>
                <p className="text-lg font-semibold">{report.failed.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("googleImport.deactivated")}</p>
                <p className="text-lg font-semibold">{report.deactivated?.length ?? 0}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("googleImport.deptsCreated")}: {report.departmentsCreated} •{" "}
              {t("googleImport.managersLinked")}: {report.managersLinked}
            </p>
            {(report.skipped.length > 0 || report.failed.length > 0) && (
              <div className="border border-border rounded-lg p-3 max-h-[30vh] overflow-y-auto text-xs space-y-1">
                <p className="font-medium mb-2">{t("googleImport.issues")}</p>
                {[...report.skipped, ...report.failed].map((r, i) => (
                  <div key={`${r.googleId}-${i}`} className="flex items-start gap-2">
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
              <Button onClick={() => onOpenChange(false)}>{t("googleImport.close")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
