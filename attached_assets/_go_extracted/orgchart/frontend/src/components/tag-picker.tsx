import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTags,
  useCreateTag,
  useGetEmployeeTags,
  useSetEmployeeTags,
  getListTagsQueryKey,
  getGetEmployeeTagsQueryKey,
  getListEmployeesQueryKey,
  getGetOrgChartQueryKey,
  type TagSummary,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Search, Tag as TagIcon, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface TagPickerProps {
  orgId: number;
  employeeId: number;
}

export function TagPicker({ orgId, employeeId }: TagPickerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEditEmployees = hasPermission("employees", "edit");
  const canCreateTags = hasPermission("organizations", "edit");

  const { data: library } = useListTags(orgId, {
    query: { enabled: !!orgId, queryKey: getListTagsQueryKey(orgId) },
  });
  const { data: assigned } = useGetEmployeeTags(orgId, employeeId, {
    query: {
      enabled: !!orgId && !!employeeId,
      queryKey: getGetEmployeeTagsQueryKey(orgId, employeeId),
    },
  });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingIds, setPendingIds] = useState<number[] | null>(null);

  const selectedIds = useMemo<number[]>(() => {
    if (pendingIds !== null) return pendingIds;
    return (assigned ?? []).map((t) => t.id);
  }, [assigned, pendingIds]);

  const selectedTags: TagSummary[] = useMemo(() => {
    const lib = library ?? [];
    return selectedIds
      .map((id) => {
        const fromLib = lib.find((l) => l.id === id);
        if (fromLib) return { id: fromLib.id, name: fromLib.name, color: fromLib.color };
        const fromAssigned = (assigned ?? []).find((a) => a.id === id);
        return fromAssigned ?? null;
      })
      .filter((t): t is TagSummary => t !== null);
  }, [selectedIds, library, assigned]);

  const setMutation = useSetEmployeeTags({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetEmployeeTagsQueryKey(orgId, employeeId),
        });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(orgId) });
        queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(orgId) });
        queryClient.invalidateQueries({ queryKey: getListTagsQueryKey(orgId) });
        setPendingIds(null);
      },
    },
  });
  const createMutation = useCreateTag({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListTagsQueryKey(orgId) });
        const next = [...selectedIds, created.id];
        setPendingIds(next);
        setMutation.mutate({ orgId, id: employeeId, data: { tagIds: next } });
        setQuery("");
      },
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lib = library ?? [];
    if (!q) return lib;
    return lib.filter((l) => l.name.toLowerCase().includes(q));
  }, [library, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (library ?? []).some((l) => l.name.toLowerCase() === q);
  }, [library, query]);

  const toggle = (tagId: number) => {
    if (!canEditEmployees) return;
    const has = selectedIds.includes(tagId);
    const next = has ? selectedIds.filter((i) => i !== tagId) : [...selectedIds, tagId];
    setPendingIds(next);
    setMutation.mutate({ orgId, id: employeeId, data: { tagIds: next } });
  };

  const handleCreate = () => {
    const name = query.trim();
    if (!name || !canCreateTags) return;
    createMutation.mutate({
      orgId,
      data: { name, color: "#64748b", description: "" },
    });
  };

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <div className="space-y-2" data-testid="tag-picker">
      <Label className="flex items-center gap-1.5">
        <TagIcon className="h-3.5 w-3.5" />
        {t("tags.label")}
      </Label>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {selectedTags.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("tags.noneAssigned")}</span>
        ) : (
          selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="h-6 ps-2 pe-1 gap-1"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
              data-testid={`tag-chip-${tag.id}`}
            >
              <span className="truncate max-w-[140px]">{tag.name}</span>
              {canEditEmployees && (
                <button
                  type="button"
                  onClick={() => toggle(tag.id)}
                  className="hover:bg-black/10 rounded-sm p-0.5"
                  aria-label={t("tags.remove", { name: tag.name })}
                  data-testid={`tag-chip-remove-${tag.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))
        )}
      </div>
      {canEditEmployees && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              data-testid="tag-picker-trigger"
            >
              <Plus className="h-3.5 w-3.5 me-1" />
              {t("tags.addOrManage")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="px-2 py-2 border-b">
              <div className="relative">
                <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("tags.searchOrCreate")}
                  className="h-8 ps-7 text-sm"
                  data-testid="tag-picker-search"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  {t("tags.empty")}
                </div>
              ) : (
                filtered.map((tag) => {
                  const checked = selectedIds.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
                      data-testid={`tag-picker-option-${tag.id}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(tag.id)} />
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate flex-1">{tag.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            {canCreateTags && query.trim() && !exactMatch && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs justify-start"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  data-testid="tag-picker-create"
                >
                  <Plus className="h-3 w-3 me-1.5" />
                  {t("tags.createNamed", { name: query.trim() })}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
