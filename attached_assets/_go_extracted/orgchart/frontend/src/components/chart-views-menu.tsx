import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Save, Pencil, Trash2, Check, X, Share2, Lock, User as UserIcon, Link2, Activity } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListChartViews,
  useCreateChartView,
  useUpdateChartView,
  useDeleteChartView,
  useRecordChartViewApplied,
  getListChartViewsQueryKey,
  type ChartView,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useToast } from "@/hooks/use-toast";

export interface ChartViewPayload {
  chartScope?: "full" | number | null;
  filter?: {
    departmentIds: number[];
    administrationIds: number[];
    nationalities: string[];
    titles: string[];
    tagIds: number[];
    tagsMode: "any" | "all";
  };
  connectorStyle?: "straight" | "angled" | "curved";
  zoom?: number;
  pan?: { x: number; y: number };
  focusedEmployeeId?: number | null;
  collapsed?: number[];
}

interface ChartViewsMenuProps {
  orgId: number | null;
  canShare: boolean;
  capturePayload: () => ChartViewPayload;
  onApply: (view: ChartView, payload: ChartViewPayload) => void;
  activeViewId?: number | null;
  onClearActive?: () => void;
}

function formatRelative(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-sec, "second");
  const min = Math.floor(sec / 60);
  if (min < 60) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-min, "minute");
  const hr = Math.floor(min / 60);
  if (hr < 24) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-hr, "hour");
  const day = Math.floor(hr / 24);
  if (day < 30) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-day, "day");
  const mon = Math.floor(day / 30);
  if (mon < 12) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-mon, "month");
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-Math.floor(mon / 12), "year");
}

function buildChartViewUrl(viewId: number): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/?view=${viewId}`;
}

export function ChartViewsMenu({
  orgId,
  canShare,
  capturePayload,
  onApply,
  activeViewId = null,
  onClearActive,
}: ChartViewsMenuProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const enabled = orgId != null;

  const { data: views = [] } = useListChartViews(orgId ?? 0, {
    query: {
      enabled,
      queryKey: getListChartViewsQueryKey(orgId ?? 0),
    },
  });

  const [listOpen, setListOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [shareOnSave, setShareOnSave] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ChartView | null>(null);

  const invalidate = () => {
    if (!enabled) return;
    queryClient.invalidateQueries({
      queryKey: getListChartViewsQueryKey(orgId),
    });
  };

  const createMutation = useCreateChartView({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("orgChart.chartViews.createdToast") });
        setSaveOpen(false);
        setName("");
        setShareOnSave(false);
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        toast({
          variant: "destructive",
          title:
            status === 409
              ? t("orgChart.chartViews.duplicateName")
              : status === 403
                ? t("orgChart.chartViews.shareForbidden")
                : t("orgChart.chartViews.saveFailed"),
        });
      },
    },
  });

  const updateMutation = useUpdateChartView({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditingId(null);
        setEditingName("");
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        toast({
          variant: "destructive",
          title:
            status === 409
              ? t("orgChart.chartViews.duplicateName")
              : status === 403
                ? t("orgChart.chartViews.shareForbidden")
                : t("orgChart.chartViews.updateFailed"),
        });
      },
    },
  });

  const recordApplyMutation = useRecordChartViewApplied({
    mutation: {
      onSuccess: () => {
        invalidate();
      },
    },
  });

  const deleteMutation = useDeleteChartView({
    mutation: {
      onSuccess: (_data, variables) => {
        invalidate();
        toast({ title: t("orgChart.chartViews.deletedToast") });
        if (variables?.id === activeViewId) onClearActive?.();
        setPendingDelete(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: t("orgChart.chartViews.deleteFailed") });
      },
    },
  });

  if (!enabled) return null;

  const handleSaveNew = () => {
    const trimmed = name.trim();
    if (!trimmed || !orgId) return;
    const payload = capturePayload();
    createMutation.mutate({
      orgId,
      data: {
        name: trimmed,
        payload: payload as unknown as { [k: string]: unknown },
        isShared: shareOnSave && canShare,
      },
    });
  };

  const handleApply = (view: ChartView) => {
    onApply(view, (view.payload ?? {}) as ChartViewPayload);
    setListOpen(false);
    if (orgId) {
      recordApplyMutation.mutate({ orgId, id: view.id });
    }
  };

  const handleRename = (view: ChartView) => {
    if (!orgId) return;
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === view.name) {
      setEditingId(null);
      setEditingName("");
      return;
    }
    updateMutation.mutate({ orgId, id: view.id, data: { name: trimmed } });
  };

  const handleOverwrite = (view: ChartView) => {
    if (!orgId) return;
    const payload = capturePayload();
    updateMutation.mutate({
      orgId,
      id: view.id,
      data: { payload: payload as unknown as { [k: string]: unknown } },
    });
    toast({ title: t("orgChart.chartViews.updatedToast") });
  };

  const handleCopyLink = async (view: ChartView) => {
    const url = buildChartViewUrl(view.id);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: t("orgChart.chartViews.linkCopied") });
    } catch {
      toast({ variant: "destructive", title: t("orgChart.chartViews.linkCopyFailed") });
    }
  };

  const handleToggleShare = (view: ChartView) => {
    if (!orgId || !canShare) return;
    updateMutation.mutate({
      orgId,
      id: view.id,
      data: { isShared: !view.isShared },
    });
  };

  const ownViews = views.filter((v) => v.isOwner);
  const sharedViews = views.filter((v) => !v.isOwner);

  const activeView = views.find((v) => v.id === activeViewId) ?? null;

  const renderRow = (view: ChartView) => {
    const isEditing = editingId === view.id;
    const isActive = view.id === activeViewId;
    return (
      <div
        key={view.id}
        className={`px-2 py-2 hover:bg-muted/50 group border-b last:border-b-0 ${isActive ? "bg-primary/5 border-s-2 border-s-primary" : ""}`}
        data-testid={`chart-view-${view.id}`}
        data-active={isActive ? "true" : "false"}
      >
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename(view);
                if (e.key === "Escape") {
                  setEditingId(null);
                  setEditingName("");
                }
              }}
              autoFocus
              className="h-7 text-sm"
              data-testid={`chart-view-edit-input-${view.id}`}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => handleRename(view)}
              disabled={updateMutation.isPending}
              data-testid={`chart-view-edit-save-${view.id}`}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setEditingId(null);
                setEditingName("");
              }}
              data-testid={`chart-view-edit-cancel-${view.id}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-1">
              <button
                type="button"
                onClick={() => handleApply(view)}
                className="flex-1 min-w-0 text-start px-2 py-1 rounded hover:bg-muted"
                data-testid={`chart-view-apply-${view.id}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium flex-1">{view.name}</span>
                  {isActive && (
                    <Badge
                      variant="default"
                      className="h-4 px-1.5 text-[9px] flex-shrink-0"
                      data-testid={`chart-view-active-badge-${view.id}`}
                    >
                      {t("orgChart.chartViews.active")}
                    </Badge>
                  )}
                  {view.isShared ? (
                    <Share2 className="h-3 w-3 text-primary flex-shrink-0" aria-label={t("orgChart.chartViews.shared")} />
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-label={t("orgChart.chartViews.private")} />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                  <UserIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{view.ownerName || t("orgChart.chartViews.unknownAuthor")}</span>
                  <span aria-hidden>·</span>
                  <span className="flex-shrink-0">{formatRelative(String(view.updatedAt), i18n.language)}</span>
                </div>
                {view.isShared && (
                  <div
                    className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate"
                    data-testid={`chart-view-usage-${view.id}`}
                  >
                    <Activity className="h-3 w-3 flex-shrink-0" />
                    {view.lastAppliedAt ? (
                      <span
                        className="truncate"
                        data-testid={`chart-view-last-applied-${view.id}`}
                      >
                        {t("orgChart.chartViews.lastUsed", {
                          when: formatRelative(String(view.lastAppliedAt), i18n.language),
                        })}
                      </span>
                    ) : (
                      <span
                        className="truncate"
                        data-testid={`chart-view-last-applied-${view.id}`}
                      >
                        {t("orgChart.chartViews.neverUsed")}
                      </span>
                    )}
                    {view.isOwner && (
                      <>
                        <span aria-hidden>·</span>
                        <span
                          className="flex-shrink-0"
                          data-testid={`chart-view-applied-count-${view.id}`}
                        >
                          {t("orgChart.chartViews.appliedCount", { count: view.appliedCount })}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </button>
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleCopyLink(view)}
                  title={t("orgChart.chartViews.copyLinkTooltip")}
                  data-testid={`chart-view-copy-link-${view.id}`}
                >
                  <Link2 className="h-3 w-3" />
                </Button>
              </div>
              {view.isOwner && (
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleOverwrite(view)}
                    title={t("orgChart.chartViews.overwriteTooltip")}
                    data-testid={`chart-view-overwrite-${view.id}`}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditingId(view.id);
                      setEditingName(view.name);
                    }}
                    data-testid={`chart-view-edit-${view.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(view)}
                    data-testid={`chart-view-delete-${view.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            {view.isOwner && canShare && (
              <div className="flex items-center justify-between mt-1 ps-2 pe-1">
                <Label
                  htmlFor={`chart-view-share-${view.id}`}
                  className="text-[11px] text-muted-foreground cursor-pointer"
                >
                  {t("orgChart.chartViews.shareWithOrg")}
                </Label>
                <Switch
                  id={`chart-view-share-${view.id}`}
                  checked={view.isShared}
                  onCheckedChange={() => handleToggleShare(view)}
                  disabled={updateMutation.isPending}
                  data-testid={`chart-view-share-toggle-${view.id}`}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Popover open={listOpen} onOpenChange={setListOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activeView ? "default" : "outline"}
            size="sm"
            data-testid="button-chart-views"
            data-active-view-id={activeView?.id ?? ""}
          >
            <Eye className="h-4 w-4 me-1" />
            <span className="truncate max-w-[140px]">
              {activeView ? activeView.name : t("orgChart.chartViews.label")}
            </span>
            {!activeView && views.length > 0 && (
              <Badge
                variant="secondary"
                className="ms-2 h-5 min-w-5 px-1.5 rounded-full text-[10px]"
                data-testid="chart-views-count"
              >
                {views.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end" data-testid="chart-views-popover">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">{t("orgChart.chartViews.title")}</span>
            <Button
              size="sm"
              variant="default"
              className="h-7"
              onClick={() => {
                setSaveOpen(true);
                setListOpen(false);
              }}
              data-testid="button-chart-views-save-current"
            >
              <Save className="h-3.5 w-3.5 me-1" />
              {t("orgChart.chartViews.saveCurrent")}
            </Button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {views.length === 0 ? (
              <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                {t("orgChart.chartViews.emptyState")}
              </div>
            ) : (
              <>
                {ownViews.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                      {t("orgChart.chartViews.yourViews")}
                    </div>
                    {ownViews.map(renderRow)}
                  </div>
                )}
                {sharedViews.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                      {t("orgChart.chartViews.sharedViews")}
                    </div>
                    {sharedViews.map(renderRow)}
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={saveOpen}
        onOpenChange={(o) => {
          setSaveOpen(o);
          if (!o) {
            setName("");
            setShareOnSave(false);
          }
        }}
      >
        <DialogContent data-testid="chart-views-save-dialog">
          <DialogHeader>
            <DialogTitle>{t("orgChart.chartViews.saveDialogTitle")}</DialogTitle>
            <DialogDescription>{t("orgChart.chartViews.saveDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="chart-view-name">{t("orgChart.chartViews.namePlaceholder")}</Label>
              <Input
                id="chart-view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNew();
                }}
                maxLength={100}
                autoFocus
                placeholder={t("orgChart.chartViews.exampleName")}
                data-testid="chart-views-name-input"
              />
            </div>
            {canShare && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label htmlFor="chart-view-share-new" className="cursor-pointer">
                    {t("orgChart.chartViews.shareWithOrg")}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t("orgChart.chartViews.shareDescription")}
                  </p>
                </div>
                <Switch
                  id="chart-view-share-new"
                  checked={shareOnSave}
                  onCheckedChange={setShareOnSave}
                  data-testid="chart-views-share-new-toggle"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)} data-testid="chart-views-save-cancel">
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleSaveNew}
              disabled={!name.trim() || createMutation.isPending}
              data-testid="chart-views-save-confirm"
            >
              {t("orgChart.chartViews.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent data-testid="chart-views-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orgChart.chartViews.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orgChart.chartViews.deleteConfirm", { name: pendingDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="chart-views-delete-cancel">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete && orgId) {
                  deleteMutation.mutate({ orgId, id: pendingDelete.id });
                }
              }}
              data-testid="chart-views-delete-confirm"
            >
              {t("orgChart.chartViews.deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
