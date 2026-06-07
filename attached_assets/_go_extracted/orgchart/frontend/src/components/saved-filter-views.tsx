import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkPlus, Check, Pencil, Trash2, Save, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSavedFilterViews,
  useCreateSavedFilterView,
  useUpdateSavedFilterView,
  useDeleteSavedFilterView,
  getListSavedFilterViewsQueryKey,
  type SavedFilterView,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { OrgChartFilter } from "@/hooks/use-org-chart-filter";

interface SavedFilterViewsProps {
  orgId: number | null;
  chartScope: string | null;
  filter: OrgChartFilter;
  onApply: (next: OrgChartFilter) => void;
}

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function SavedFilterViews({ orgId, chartScope, filter, onApply }: SavedFilterViewsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const enabled = orgId != null && chartScope != null;
  const params = chartScope != null ? { chartScope } : undefined;

  const { data: views = [] } = useListSavedFilterViews(
    orgId ?? 0,
    params,
    {
      query: {
        enabled,
        queryKey: getListSavedFilterViewsQueryKey(orgId ?? 0, params),
      },
    },
  );

  const [listOpen, setListOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SavedFilterView | null>(null);

  const invalidate = () => {
    if (!enabled) return;
    queryClient.invalidateQueries({
      queryKey: getListSavedFilterViewsQueryKey(orgId, params),
    });
  };

  const createMutation = useCreateSavedFilterView({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("orgChart.savedViews.createdToast") });
        setSaveOpen(false);
        setName("");
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        toast({
          variant: "destructive",
          title: status === 409
            ? t("orgChart.savedViews.duplicateName")
            : t("orgChart.savedViews.saveFailed"),
        });
      },
    },
  });

  const updateMutation = useUpdateSavedFilterView({
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
          title: status === 409
            ? t("orgChart.savedViews.duplicateName")
            : t("orgChart.savedViews.updateFailed"),
        });
      },
    },
  });

  const deleteMutation = useDeleteSavedFilterView({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("orgChart.savedViews.deletedToast") });
        setPendingDelete(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: t("orgChart.savedViews.deleteFailed") });
      },
    },
  });

  const filterIsEmpty = filter.departmentIds.length === 0 && filter.administrationIds.length === 0;

  const matchingView = useMemo(() => {
    return views.find(
      (v) =>
        sameIds(v.departmentIds, filter.departmentIds) &&
        sameIds(v.administrationIds, filter.administrationIds),
    ) ?? null;
  }, [views, filter]);

  if (!enabled) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || filterIsEmpty) return;
    createMutation.mutate({
      orgId,
      data: {
        chartScope,
        name: trimmed,
        departmentIds: filter.departmentIds,
        administrationIds: filter.administrationIds,
      },
    });
  };

  const handleApply = (view: SavedFilterView) => {
    onApply({
      departmentIds: [...view.departmentIds],
      administrationIds: [...view.administrationIds],
      nationalities: [],
      titles: [],
      tagIds: [],
      tagsMode: "any",
    });
    setListOpen(false);
  };

  const handleRename = (view: SavedFilterView) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === view.name) {
      setEditingId(null);
      setEditingName("");
      return;
    }
    updateMutation.mutate({
      orgId,
      id: view.id,
      data: { name: trimmed },
    });
  };

  const handleOverwrite = (view: SavedFilterView) => {
    updateMutation.mutate({
      orgId,
      id: view.id,
      data: {
        departmentIds: filter.departmentIds,
        administrationIds: filter.administrationIds,
      },
    });
    toast({ title: t("orgChart.savedViews.updatedToast") });
  };

  return (
    <>
      <Popover open={listOpen} onOpenChange={setListOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            data-testid="saved-views-trigger"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span className="ms-1.5">{t("orgChart.savedViews.label")}</span>
            {views.length > 0 && (
              <Badge
                variant="secondary"
                className="ms-2 h-5 min-w-5 px-1.5 rounded-full text-[10px]"
                data-testid="saved-views-count"
              >
                {views.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start" data-testid="saved-views-popover">
          <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
            {t("orgChart.savedViews.title")}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {views.length === 0 ? (
              <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                {t("orgChart.savedViews.emptyState")}
              </div>
            ) : (
              views.map((view) => {
                const isMatch = matchingView?.id === view.id;
                const isEditing = editingId === view.id;
                return (
                  <div
                    key={view.id}
                    className="px-2 py-1.5 hover:bg-muted/50 group"
                    data-testid={`saved-view-${view.id}`}
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
                          data-testid={`saved-view-edit-input-${view.id}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleRename(view)}
                          disabled={updateMutation.isPending}
                          data-testid={`saved-view-edit-save-${view.id}`}
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
                          data-testid={`saved-view-edit-cancel-${view.id}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleApply(view)}
                          className="flex-1 min-w-0 flex items-center gap-2 text-start text-sm px-2 py-1 rounded hover:bg-muted"
                          data-testid={`saved-view-apply-${view.id}`}
                        >
                          {isMatch ? (
                            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate flex-1">{view.name}</span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {view.departmentIds.length + view.administrationIds.length}
                          </span>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => handleOverwrite(view)}
                          disabled={filterIsEmpty || updateMutation.isPending}
                          title={t("orgChart.savedViews.overwriteTooltip")}
                          data-testid={`saved-view-overwrite-${view.id}`}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => {
                            setEditingId(view.id);
                            setEditingName(view.name);
                          }}
                          data-testid={`saved-view-edit-${view.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(view)}
                          data-testid={`saved-view-delete-${view.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={saveOpen} onOpenChange={(o) => { setSaveOpen(o); if (!o) setName(""); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={filterIsEmpty}
            data-testid="saved-views-save-trigger"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span className="ms-1.5">{t("orgChart.savedViews.saveAs")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start" data-testid="saved-views-save-popover">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("orgChart.savedViews.namePlaceholder")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              maxLength={100}
              autoFocus
              placeholder={t("orgChart.savedViews.exampleName")}
              data-testid="saved-views-name-input"
            />
            <div className="text-[11px] text-muted-foreground">
              {t("orgChart.savedViews.summary", {
                depts: filter.departmentIds.length,
                admins: filter.administrationIds.length,
              })}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSaveOpen(false); setName(""); }}
                data-testid="saved-views-save-cancel"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!name.trim() || createMutation.isPending}
                data-testid="saved-views-save-confirm"
              >
                {t("orgChart.savedViews.save")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent data-testid="saved-views-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orgChart.savedViews.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orgChart.savedViews.deleteConfirm", { name: pendingDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="saved-views-delete-cancel">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  deleteMutation.mutate({ orgId, id: pendingDelete.id });
                }
              }}
              data-testid="saved-views-delete-confirm"
            >
              {t("orgChart.savedViews.deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
