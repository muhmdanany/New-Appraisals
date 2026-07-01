import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, GitCompareArrows, Trash2, RotateCcw, Plus, ArrowLeft, Columns2 } from "lucide-react";
import { SnapshotVisualCompare } from "@/components/snapshot-visual-compare";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Snapshot {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  createdBy: number | null;
  createdByName: string | null;
  employeesCount: number;
  departmentsCount: number;
  administrationsCount: number;
  isAuto: boolean;
  createdAt: string;
}

interface SnapEmployee {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
}

interface FieldChange {
  name: string;
  from: unknown;
  to: unknown;
}

interface ChangedEmployee {
  id: number;
  name: string;
  fields: FieldChange[];
}

interface CompareResult {
  added: SnapEmployee[];
  removed: SnapEmployee[];
  changed: ChangedEmployee[];
  baseLabel: string;
  compareLabel: string;
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "∅";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export default function SnapshotsPage() {
  const { t } = useTranslation();
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const canView = hasPermission("snapshots", "view");
  const canCreate = hasPermission("snapshots", "create");
  const canDelete = hasPermission("snapshots", "delete");
  const canRestore = hasPermission("snapshots", "edit");

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePreview, setRestorePreview] = useState<CompareResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [compareBase, setCompareBase] = useState<Snapshot | null>(null);
  const [compareWith, setCompareWith] = useState<string>("current");
  const [compareData, setCompareData] = useState<CompareResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [visualCompareBase, setVisualCompareBase] = useState<Snapshot | null>(null);
  const [visualCompareWith, setVisualCompareWith] = useState<string>("current");

  // Focus deep-link support (e.g. from the Cmd+K palette navigating to
  // /snapshots?focus=<id>). When the snapshot exists in the loaded list we
  // scroll the row into view and apply a brief highlight so the user can
  // tell which one matched.
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("focus");
    if (!raw) return;
    const id = parseInt(raw, 10);
    if (!Number.isNaN(id)) setFocusedId(id);
  }, []);
  useEffect(() => {
    if (focusedId === null || isLoading) return;
    if (!snapshots.some((s) => s.id === focusedId)) return;
    const row = rowRefs.current.get(focusedId);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    const handle = window.setTimeout(() => setFocusedId(null), 2000);
    return () => window.clearTimeout(handle);
  }, [focusedId, snapshots, isLoading]);

  const reload = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/organizations/${selectedOrgId}/snapshots`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Snapshot[];
      setSnapshots(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canView) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, canView]);

  const handleCreate = async () => {
    if (!selectedOrgId || !createName.trim()) return;
    setIsSaving(true);
    try {
      const r = await fetch(`${API_BASE}/organizations/${selectedOrgId}/snapshots`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrgId || !deleteTarget) return;
    try {
      await fetch(`${API_BASE}/organizations/${selectedOrgId}/snapshots/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const closeRestoreDialog = () => {
    if (isRestoring) return;
    setRestoreTarget(null);
    setRestorePreview(null);
    setPreviewError(null);
  };

  const handleRestore = async () => {
    if (!selectedOrgId || !restoreTarget) return;
    setIsRestoring(true);
    try {
      const r = await fetch(
        `${API_BASE}/organizations/${selectedOrgId}/snapshots/${restoreTarget.id}/restore`,
        { method: "POST", credentials: "include" },
      );
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `HTTP ${r.status}`);
      }
      setRestoreTarget(null);
      setRestorePreview(null);
      setPreviewError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    if (!restoreTarget || !selectedOrgId) return;
    let cancelled = false;
    setIsLoadingPreview(true);
    setPreviewError(null);
    setRestorePreview(null);
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE}/organizations/${selectedOrgId}/snapshots/${restoreTarget.id}/compare`,
          { credentials: "include" },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as CompareResult;
        if (!cancelled) setRestorePreview(data);
      } catch (e) {
        if (!cancelled) setPreviewError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreTarget, selectedOrgId]);

  const runCompare = async (base: Snapshot, otherId: string) => {
    if (!selectedOrgId) return;
    setIsComparing(true);
    setCompareData(null);
    try {
      const url = new URL(
        `${API_BASE}/organizations/${selectedOrgId}/snapshots/${base.id}/compare`,
        window.location.origin,
      );
      if (otherId !== "current") url.searchParams.set("compareId", otherId);
      const r = await fetch(url.toString(), { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCompareData((await r.json()) as CompareResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsComparing(false);
    }
  };

  const formatDateTime = (s: string) => {
    try {
      return new Date(s).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return s;
    }
  };

  const otherSnapshotOptions = useMemo(() => {
    if (!compareBase) return [];
    return snapshots.filter((s) => s.id !== compareBase.id);
  }, [compareBase, snapshots]);

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  if (!canView) {
    return (
      <div className="p-8 text-muted-foreground">
        {t("snapshots.subtitle")}
      </div>
    );
  }

  // Visual side-by-side compare view
  if (visualCompareBase && selectedOrgId) {
    return (
      <SnapshotVisualCompare
        orgId={selectedOrgId}
        baseSnapshot={{ id: visualCompareBase.id, name: visualCompareBase.name }}
        initialCompareWith={visualCompareWith}
        otherSnapshots={snapshots
          .filter((s) => s.id !== visualCompareBase.id)
          .map((s) => ({ id: s.id, name: s.name }))}
        onBack={() => setVisualCompareBase(null)}
      />
    );
  }

  // Compare detail view
  if (compareBase) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="p-6 pb-0 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCompareBase(null);
                setCompareData(null);
              }}
              data-testid="button-compare-back"
            >
              <ArrowLeft className="h-4 w-4 me-1" />
              {t("common.cancel")}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t("snapshots.compareTitle")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {compareBase.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("snapshots.compareWith")}</Label>
            <Select
              value={compareWith}
              onValueChange={(v) => {
                setCompareWith(v);
                runCompare(compareBase, v);
              }}
            >
              <SelectTrigger className="h-9 w-[220px]" data-testid="select-compare-with">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">{t("snapshots.currentChart")}</SelectItem>
                {otherSnapshotOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVisualCompareWith(compareWith);
                setVisualCompareBase(compareBase);
              }}
              data-testid="button-open-visual-compare"
            >
              <Columns2 className="h-4 w-4 me-1" />
              {t("snapshots.visual.button")}
            </Button>
          </div>
        </div>

        <div className="p-6">
          {isComparing ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : compareData ? (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                {compareData.baseLabel} → {compareData.compareLabel}
              </div>

              <DiffSection
                title={t("snapshots.added")}
                count={compareData.added.length}
                tone="green"
                emptyText={t("snapshots.noAdded")}
                testId="diff-added"
              >
                {compareData.added.map((e) => (
                  <TableRow key={e.id} data-testid={`diff-added-${e.id}`}>
                    <TableCell className="font-medium">
                      {e.firstName} {e.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.title}</TableCell>
                    <TableCell className="text-muted-foreground">{e.email}</TableCell>
                  </TableRow>
                ))}
              </DiffSection>

              <DiffSection
                title={t("snapshots.removed")}
                count={compareData.removed.length}
                tone="red"
                emptyText={t("snapshots.noRemoved")}
                testId="diff-removed"
              >
                {compareData.removed.map((e) => (
                  <TableRow key={e.id} data-testid={`diff-removed-${e.id}`}>
                    <TableCell className="font-medium">
                      {e.firstName} {e.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.title}</TableCell>
                    <TableCell className="text-muted-foreground">{e.email}</TableCell>
                  </TableRow>
                ))}
              </DiffSection>

              <ChangedSection changed={compareData.changed} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t("snapshots.empty")}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-2xl font-bold text-foreground"
              data-testid="text-page-title"
            >
              {t("snapshots.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("snapshots.subtitle")}
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} data-testid="button-create-snapshot">
              <Plus className="h-4 w-4 me-1" />
              {t("snapshots.save")}
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl shadow-sm">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-destructive">{error}</div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Camera className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg font-medium">{t("snapshots.empty")}</p>
              <p className="text-sm mt-1">{t("snapshots.emptyDesc")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("snapshots.name")}</TableHead>
                  <TableHead>{t("snapshots.counts")}</TableHead>
                  <TableHead>{t("snapshots.createdBy")}</TableHead>
                  <TableHead>{t("snapshots.createdAt")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((s) => (
                  <TableRow
                    key={s.id}
                    data-testid={`snapshot-row-${s.id}`}
                    ref={(el) => {
                      if (el) rowRefs.current.set(s.id, el);
                      else rowRefs.current.delete(s.id);
                    }}
                    className={
                      focusedId === s.id
                        ? "bg-primary/10 transition-colors"
                        : "transition-colors"
                    }>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {s.isAuto && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-200"
                            data-testid={`badge-auto-${s.id}`}
                          >
                            {t("snapshots.autoBadge")}
                          </Badge>
                        )}
                      </div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {s.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {t("snapshots.peopleCount", { count: s.employeesCount })}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {t("snapshots.deptCount", { count: s.departmentsCount })}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.createdByName || (
                        <span className="text-muted-foreground">{t("audit.system")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(s.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCompareBase(s);
                            setCompareWith("current");
                            runCompare(s, "current");
                          }}
                          data-testid={`button-compare-${s.id}`}
                        >
                          <GitCompareArrows className="h-4 w-4 me-1" />
                          {t("snapshots.compare")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setVisualCompareWith("current");
                            setVisualCompareBase(s);
                          }}
                          data-testid={`button-visual-compare-${s.id}`}
                        >
                          <Columns2 className="h-4 w-4 me-1" />
                          {t("snapshots.visual.button")}
                        </Button>
                        {canRestore && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRestoreTarget(s)}
                            data-testid={`button-restore-${s.id}`}
                          >
                            <RotateCcw className="h-4 w-4 me-1" />
                            {t("snapshots.restore")}
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(s)}
                            data-testid={`button-delete-${s.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("snapshots.save")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="snap-name">{t("snapshots.name")}</Label>
              <Input
                id="snap-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Q4 2025 Pre-reorg"
                data-testid="input-snapshot-name"
              />
            </div>
            <div>
              <Label htmlFor="snap-desc">{t("common.description")}</Label>
              <Textarea
                id="snap-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                rows={3}
                data-testid="input-snapshot-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !createName.trim()}
              data-testid="button-confirm-snapshot"
            >
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("snapshots.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              data-testid="button-confirm-delete-snapshot"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!restoreTarget}
        onOpenChange={(o) => {
          if (!o) closeRestoreDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("snapshots.confirmRestore")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("snapshots.restoreWarning", { name: restoreTarget?.name ?? "" })}
            </p>

            <div className="border-t pt-4">
              <div className="text-sm font-semibold mb-3">
                {t("snapshots.restorePreviewTitle")}
              </div>
              {isLoadingPreview ? (
                <div className="space-y-2" data-testid="restore-preview-loading">
                  <div className="text-xs text-muted-foreground mb-2">
                    {t("snapshots.restorePreviewLoading")}
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : previewError ? (
                <div
                  className="text-sm text-destructive"
                  data-testid="restore-preview-error"
                >
                  {t("snapshots.restorePreviewError")}
                </div>
              ) : restorePreview ? (
                <RestorePreview data={restorePreview} />
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRestoreDialog}
              disabled={isRestoring}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleRestore}
              disabled={isRestoring}
              data-testid="button-confirm-restore-snapshot"
            >
              {isRestoring ? t("common.saving") : t("snapshots.restore")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiffSection({
  title,
  count,
  tone,
  emptyText,
  testId,
  children,
}: {
  title: string;
  count: number;
  tone: "green" | "red";
  emptyText: string;
  testId: string;
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-red-50 text-red-700 border-red-200";
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden" data-testid={testId}>
      <div className={`flex items-center justify-between px-4 py-2 border-b ${toneClasses}`}>
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="outline" className="text-xs bg-white">
          {count}
        </Badge>
      </div>
      {count === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">{emptyText}</div>
      ) : (
        <Table>
          <TableBody>{children}</TableBody>
        </Table>
      )}
    </div>
  );
}

function ChangedSection({ changed }: { changed: ChangedEmployee[] }) {
  const { t } = useTranslation();
  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden"
      data-testid="diff-changed"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b bg-amber-50 text-amber-800 border-amber-200">
        <span className="text-sm font-semibold">{t("snapshots.changed")}</span>
        <Badge variant="outline" className="text-xs bg-white">
          {changed.length}
        </Badge>
      </div>
      {changed.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          {t("snapshots.noChanged")}
        </div>
      ) : (
        <div className="divide-y">
          {changed.map((c) => (
            <div key={c.id} className="px-4 py-3" data-testid={`diff-changed-${c.id}`}>
              <div className="font-medium text-sm mb-1">{c.name}</div>
              <div className="flex flex-col gap-0.5">
                {c.fields.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs flex-wrap">
                    <span className="font-medium text-muted-foreground">
                      {t(`snapshots.field.${f.name}`, { defaultValue: f.name })}:
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through max-w-[200px] truncate">
                      {formatValue(f.from)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 max-w-[200px] truncate">
                      {formatValue(f.to)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RestorePreview({ data }: { data: CompareResult }) {
  const { t } = useTranslation();
  const PREVIEW_LIMIT = 5;

  const willRemove = data.added;
  const willRestore = data.removed;
  const willRevert = data.changed;

  const totalChanges =
    willRemove.length + willRestore.length + willRevert.length;

  if (totalChanges === 0) {
    return (
      <div
        className="text-sm text-muted-foreground text-center py-4"
        data-testid="restore-preview-no-changes"
      >
        {t("snapshots.restoreNoChanges")}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="restore-preview">
      <PreviewBlock
        title={t("snapshots.willBeRemoved")}
        count={willRemove.length}
        tone="red"
        testId="restore-preview-remove"
        items={willRemove.slice(0, PREVIEW_LIMIT).map((e) => ({
          id: e.id,
          primary: `${e.firstName} ${e.lastName}`,
          secondary: e.title,
        }))}
        moreCount={Math.max(0, willRemove.length - PREVIEW_LIMIT)}
      />
      <PreviewBlock
        title={t("snapshots.willBeRestored")}
        count={willRestore.length}
        tone="green"
        testId="restore-preview-restore"
        items={willRestore.slice(0, PREVIEW_LIMIT).map((e) => ({
          id: e.id,
          primary: `${e.firstName} ${e.lastName}`,
          secondary: e.title,
        }))}
        moreCount={Math.max(0, willRestore.length - PREVIEW_LIMIT)}
      />
      <PreviewBlock
        title={t("snapshots.willBeReverted")}
        count={willRevert.length}
        tone="amber"
        testId="restore-preview-revert"
        items={willRevert.slice(0, PREVIEW_LIMIT).map((c) => {
          const fieldNames = c.fields
            .map((f) =>
              t(`snapshots.field.${f.name}`, { defaultValue: f.name }),
            )
            .join(", ");
          return {
            id: c.id,
            primary: c.name,
            secondary: fieldNames,
          };
        })}
        moreCount={Math.max(0, willRevert.length - PREVIEW_LIMIT)}
      />
    </div>
  );
}

function PreviewBlock({
  title,
  count,
  tone,
  items,
  moreCount,
  testId,
}: {
  title: string;
  count: number;
  tone: "red" | "green" | "amber";
  items: { id: number; primary: string; secondary: string }[];
  moreCount: number;
  testId: string;
}) {
  const { t } = useTranslation();
  if (count === 0) return null;
  const headerClass =
    tone === "red"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "green"
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <div
      className="border border-border rounded-md overflow-hidden"
      data-testid={testId}
    >
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b ${headerClass}`}
      >
        <span className="text-xs font-semibold">{title}</span>
        <Badge variant="outline" className="text-xs bg-white">
          {count}
        </Badge>
      </div>
      <ul className="divide-y">
        {items.map((it) => (
          <li
            key={it.id}
            className="px-3 py-1.5 text-xs flex items-baseline gap-2"
            data-testid={`${testId}-item-${it.id}`}
          >
            <span className="font-medium truncate">{it.primary}</span>
            {it.secondary && (
              <span className="text-muted-foreground truncate">
                {it.secondary}
              </span>
            )}
          </li>
        ))}
        {moreCount > 0 && (
          <li className="px-3 py-1.5 text-xs text-muted-foreground italic">
            {t("snapshots.moreItems", { count: moreCount })}
          </li>
        )}
      </ul>
    </div>
  );
}
