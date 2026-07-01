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
  useGetEntraImportStatus,
  useGetEntraImportPreview,
  useGetEntraImportGroupsPreview,
  useImportFromEntra,
  useDetectImportDuplicates,
  useGetEntraSyncSettings,
  useUpdateEntraSyncSettings,
  useRunEntraSyncNow,
  getGetEntraImportStatusQueryKey,
  getGetEntraImportPreviewQueryKey,
  getGetEntraSyncSettingsQueryKey,
  getGetEntraImportGroupsPreviewQueryKey,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getGetOrgDashboardQueryKey,
  getGetOrgChartQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  type EntraUser,
  type EntraGroup,
  type EntraImportReport,
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

type Step = "connect" | "select" | "groups" | "duplicates" | "results";

export function EntraImportWizard({ orgId, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("connect");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [useGroupOwners, setUseGroupOwners] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [report, setReport] = useState<EntraImportReport | null>(null);
  const [dupCandidates, setDupCandidates] = useState<DuplicateCandidateInput[]>([]);
  const [dupResults, setDupResults] = useState<DuplicateDetectionResult[]>([]);
  const [dupSubmitError, setDupSubmitError] = useState<string | null>(null);
  const detectMutation = useDetectImportDuplicates();

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const statusQuery = useGetEntraImportStatus(orgId, {
    query: { enabled: open, queryKey: getGetEntraImportStatusQueryKey(orgId) },
  });
  const connected = !!statusQuery.data?.connected;

  const previewQuery = useGetEntraImportPreview(orgId, {
    query: {
      enabled: open && connected && step !== "results",
      queryKey: getGetEntraImportPreviewQueryKey(orgId),
    },
  });
  const users = previewQuery.data?.users ?? [];

  const groupsQuery = useGetEntraImportGroupsPreview(orgId, {
    query: {
      enabled: open && connected && step === "groups",
      queryKey: getGetEntraImportGroupsPreviewQueryKey(orgId),
    },
  });
  const groups = groupsQuery.data?.groups ?? [];

  useEffect(() => {
    if (!open) return;
    if (connected && step === "connect") setStep("select");
  }, [open, connected, step]);

  useEffect(() => {
    if (!open) {
      setStep("connect");
      setSelected(new Set());
      setSelectedGroups(new Set());
      setSearch("");
      setGroupSearch("");
      setUseGroupOwners(false);
      setReport(null);
      setDupCandidates([]);
      setDupResults([]);
      setDupSubmitError(null);
    }
  }, [open]);

  const syncSettingsQuery = useGetEntraSyncSettings(orgId, {
    query: {
      enabled: open && connected,
      queryKey: getGetEntraSyncSettingsQueryKey(orgId),
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

  const updateSyncMutation = useUpdateEntraSyncSettings({
    mutation: {
      onSuccess: () => {
        setSyncSavedAt(Date.now());
        qc.invalidateQueries({ queryKey: getGetEntraSyncSettingsQueryKey(orgId) });
      },
    },
  });

  const runSyncMutation = useRunEntraSyncNow({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEntraSyncSettingsQueryKey(orgId) });
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
        // Auto-link the calling user as the service account on first save
        // when no service account is set yet, so enabling sync "just works".
        setServiceUserToCurrent: !syncSettings?.serviceUserId,
      },
    });
  };

  const importMutation = useImportFromEntra({
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
    return users.filter((u: EntraUser) => {
      return (
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.mail ?? "").toLowerCase().includes(q) ||
        (u.userPrincipalName ?? "").toLowerCase().includes(q) ||
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
    const res = await fetch(`${apiBase}/auth/microsoft/connect-entra`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.authorizeUrl) {
      window.location.href = data.authorizeUrl;
    }
  };

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g: EntraGroup) => {
      return (
        (g.displayName ?? "").toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [groups, groupSearch]);

  const allGroupsFilteredSelected =
    filteredGroups.length > 0 &&
    filteredGroups.every((g) => selectedGroups.has(g.id));

  const toggleAllGroups = () => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (allGroupsFilteredSelected) {
        for (const g of filteredGroups) next.delete(g.id);
      } else {
        for (const g of filteredGroups) next.add(g.id);
      }
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build candidate list from currently-selected Entra users so the
  // detector can score them against existing employees.
  const buildCandidates = (): DuplicateCandidateInput[] => {
    const out: DuplicateCandidateInput[] = [];
    for (const u of users as EntraUser[]) {
      if (!selected.has(u.id)) continue;
      const email = (u.mail ?? u.userPrincipalName ?? "").trim().toLowerCase();
      if (!email) continue;
      const display = (u.displayName ?? "").trim();
      const parts = display.split(/\s+/);
      out.push({
        key: u.id,
        firstName: u.givenName?.trim() || parts[0] || "",
        lastName: u.surname?.trim() || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
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
        groupIds: Array.from(selectedGroups),
        useGroupOwnersAsSecondaryManagers: useGroupOwners,
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
      setDupSubmitError((e as Error)?.message || t("entraImport.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            {t("entraImport.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 my-3 text-xs flex-wrap">
          {(["connect", "select", "groups", "duplicates", "results"] as Step[]).map((s, idx, arr) => {
            const order: Record<Step, number> = {
              connect: 0,
              select: 1,
              groups: 2,
              duplicates: 3,
              results: 4,
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
                <span
                  className={
                    active ? "font-medium" : "text-muted-foreground"
                  }
                >
                  {t(`entraImport.step.${s}`)}
                </span>
                {idx < arr.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
                )}
              </div>
            );
          })}
        </div>

        {connected && syncSettings && step !== "results" && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20" data-testid="entra-sync-panel">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">{t("entraImport.sync.title")}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {syncSettings.lastSyncStatus === "success" && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("entraImport.sync.statusSuccess")}
                  </span>
                )}
                {syncSettings.lastSyncStatus === "failure" && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    {t("entraImport.sync.statusFailure")}
                  </span>
                )}
                {syncSettings.lastSyncStatus === "never" && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {t("entraImport.sync.statusNever")}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("entraImport.sync.intro")}</p>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                className="mt-0.5"
                data-testid="checkbox-entra-sync-enabled"
              />
              <div className="text-sm">
                <p className="font-medium">{t("entraImport.sync.enableLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("entraImport.sync.enableHint")}</p>
              </div>
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">
                  {t("entraImport.sync.cadenceLabel")}
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
                  data-testid="input-entra-sync-cadence"
                />
                <p className="text-[11px] text-muted-foreground mt-1">{t("entraImport.sync.cadenceHint")}</p>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">{t("entraImport.sync.lastSync")}:</span>{" "}
                  {syncSettings.lastSyncAt
                    ? new Date(syncSettings.lastSyncAt).toLocaleString()
                    : t("entraImport.sync.neverSynced")}
                </p>
                {syncSettings.nextSyncAt && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{t("entraImport.sync.nextSync")}:</span>{" "}
                    {new Date(syncSettings.nextSyncAt).toLocaleString()}
                  </p>
                )}
                {syncSettings.lastSyncAt && (
                  <p className="text-muted-foreground">
                    {t("entraImport.sync.lastResult", {
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
                data-testid="checkbox-entra-sync-update"
              />
              <div className="text-sm">
                <p className="font-medium">{t("entraImport.sync.updateExistingLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("entraImport.sync.updateExistingHint")}</p>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncDeactivateMissing}
                onChange={(e) => setSyncDeactivateMissing(e.target.checked)}
                className="mt-0.5"
                data-testid="checkbox-entra-sync-deactivate"
              />
              <div className="text-sm">
                <p className="font-medium">{t("entraImport.sync.deactivateMissingLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("entraImport.sync.deactivateMissingHint")}</p>
              </div>
            </label>

            <div className="text-xs text-muted-foreground">
              {syncSettings.serviceUserId ? (
                <>
                  {t("entraImport.sync.linkedAs")}:{" "}
                  <span className="font-medium text-foreground">
                    {syncSettings.serviceUserName || syncSettings.serviceUserEmail}
                  </span>
                </>
              ) : (
                t("entraImport.sync.serviceAccount")
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
                data-testid="button-entra-sync-run"
              >
                {runSyncMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 me-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 me-2" />
                )}
                {t("entraImport.sync.runNow")}
              </Button>
              <Button
                size="sm"
                onClick={saveSync}
                disabled={updateSyncMutation.isPending}
                data-testid="button-entra-sync-save"
              >
                {updateSyncMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 me-2 animate-spin" />
                )}
                {updateSyncMutation.isPending
                  ? t("entraImport.sync.saving")
                  : syncSavedAt && Date.now() - syncSavedAt < 3000
                    ? t("entraImport.sync.saved")
                    : t("entraImport.sync.save")}
              </Button>
            </div>
          </div>
        )}

        {step === "connect" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("entraImport.connectIntro")}
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
              <p className="font-medium">{t("entraImport.requiredScopes")}</p>
              <p className="text-muted-foreground">
                User.Read.All, Directory.Read.All
              </p>
            </div>
            <Button
              onClick={startConnect}
              disabled={statusQuery.isLoading}
              data-testid="button-entra-connect"
            >
              <Cloud className="h-4 w-4 me-2" />
              {t("entraImport.connectButton")}
            </Button>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-3">
            {previewQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("entraImport.loadingUsers")}
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
                      placeholder={t("entraImport.searchPlaceholder")}
                      className="ps-9"
                      data-testid="input-entra-search"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("entraImport.selectedCount", {
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
                      data-testid="checkbox-entra-select-all"
                    />
                    <span>{t("entraImport.col.name")}</span>
                    <span>{t("entraImport.col.title")}</span>
                    <span>{t("entraImport.col.department")}</span>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto divide-y divide-border">
                    {filteredUsers.map((u) => {
                      const checked = selected.has(u.id);
                      return (
                        <label
                          key={u.id}
                          className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 items-center px-3 py-2 text-sm hover:bg-muted/30 cursor-pointer"
                          data-testid={`row-entra-user-${u.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(u.id)}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {u.displayName || "—"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.mail || u.userPrincipalName || ""}
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
                        {t("entraImport.noUsers")}
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
                    data-testid="checkbox-entra-update-existing"
                  />
                  <div className="text-sm">
                    <p className="font-medium">
                      {t("entraImport.updateExistingTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("entraImport.updateExistingHint")}
                    </p>
                  </div>
                </label>

                {importMutation.error && (
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <p>{(importMutation.error as Error).message}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={() => setStep("groups")}
                    disabled={selected.size === 0}
                    data-testid="button-entra-next-groups"
                  >
                    {t("entraImport.next")}
                    <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === "groups" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("entraImport.groupsIntro")}
            </p>
            {groupsQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("entraImport.loadingGroups")}
              </div>
            )}
            {groupsQuery.error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <p>{(groupsQuery.error as Error).message}</p>
              </div>
            )}
            {!groupsQuery.isLoading && !groupsQuery.error && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder={t("entraImport.groupsSearchPlaceholder")}
                      className="ps-9"
                      data-testid="input-entra-group-search"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("entraImport.groupsSelectedCount", {
                      selected: selectedGroups.size,
                      total: groups.length,
                    })}
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 text-xs font-medium grid grid-cols-[28px_1fr_120px_120px] gap-2">
                    <input
                      type="checkbox"
                      checked={allGroupsFilteredSelected}
                      onChange={toggleAllGroups}
                      data-testid="checkbox-entra-groups-select-all"
                    />
                    <span>{t("entraImport.col.groupName")}</span>
                    <span>{t("entraImport.col.members")}</span>
                    <span>{t("entraImport.col.type")}</span>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto divide-y divide-border">
                    {filteredGroups.map((g) => {
                      const checked = selectedGroups.has(g.id);
                      const groupType = g.mailEnabled
                        ? t("entraImport.groupType.m365")
                        : g.securityEnabled
                          ? t("entraImport.groupType.security")
                          : "—";
                      return (
                        <label
                          key={g.id}
                          className="grid grid-cols-[28px_1fr_120px_120px] gap-2 items-center px-3 py-2 text-sm hover:bg-muted/30 cursor-pointer"
                          data-testid={`row-entra-group-${g.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroup(g.id)}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {g.displayName || "—"}
                            </p>
                            {g.description && (
                              <p className="truncate text-xs text-muted-foreground">
                                {g.description}
                              </p>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {g.memberCount ?? g.memberIds.length}
                          </span>
                          <span className="text-muted-foreground">
                            {groupType}
                          </span>
                        </label>
                      );
                    })}
                    {filteredGroups.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {t("entraImport.noGroups")}
                      </div>
                    )}
                  </div>
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={useGroupOwners}
                    onChange={(e) => setUseGroupOwners(e.target.checked)}
                    disabled={selectedGroups.size === 0}
                    className="mt-0.5"
                    data-testid="checkbox-entra-group-owners"
                  />
                  <div className="text-sm">
                    <p className="font-medium">
                      {t("entraImport.useGroupOwnersTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("entraImport.useGroupOwnersHint")}
                    </p>
                  </div>
                </label>

                {importMutation.error && (
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <p>{(importMutation.error as Error).message}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep("select")}
                  >
                    {t("entraImport.back")}
                  </Button>
                  <Button
                    onClick={submit}
                    disabled={selected.size === 0 || importMutation.isPending}
                    data-testid="button-entra-import"
                  >
                    {importMutation.isPending && (
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    )}
                    {t("entraImport.import", { count: selected.size })}
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
              setStep(selectedGroups.size > 0 ? "groups" : "select");
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
              <p className="font-medium">{t("entraImport.complete")}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("entraImport.summary", {
                added: report.added.length,
                updated: report.updated.length,
                skipped: report.skipped.length,
                failed: report.failed.length,
              })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("entraImport.added")}
                </p>
                <p className="text-lg font-semibold">{report.added.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("entraImport.updatedCount")}
                </p>
                <p className="text-lg font-semibold">
                  {report.updated.length}
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("entraImport.skippedCount")}
                </p>
                <p className="text-lg font-semibold">
                  {report.skipped.length}
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("entraImport.failed")}
                </p>
                <p className="text-lg font-semibold">{report.failed.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {t("entraImport.deactivated")}
                </p>
                <p className="text-lg font-semibold">
                  {report.deactivated?.length ?? 0}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("entraImport.deptsCreated")}: {report.departmentsCreated} •{" "}
              {t("entraImport.managersLinked")}: {report.managersLinked} •{" "}
              {t("entraImport.groupsImportedCount")}:{" "}
              {report.groupsImported ?? 0} •{" "}
              {t("entraImport.secondaryManagersLinked")}:{" "}
              {report.secondaryManagersLinked ?? 0}
            </p>
            {(report.skipped.length > 0 || report.failed.length > 0) && (
              <div className="border border-border rounded-lg p-3 max-h-[30vh] overflow-y-auto text-xs space-y-1">
                <p className="font-medium mb-2">{t("entraImport.issues")}</p>
                {[...report.skipped, ...report.failed].map((r, i) => (
                  <div
                    key={`${r.entraId}-${i}`}
                    className="flex items-start gap-2"
                  >
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
                {t("entraImport.close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
