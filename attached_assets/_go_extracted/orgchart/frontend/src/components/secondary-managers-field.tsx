import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSecondaryManagers,
  useAddSecondaryManager,
  useRemoveSecondaryManager,
  getListSecondaryManagersQueryKey,
  getListAllSecondaryManagersQueryKey,
  getGetOrgChartQueryKey,
  type Employee,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Plus, AlertCircle } from "lucide-react";

interface Props {
  orgId: number;
  employeeId: number;
  primaryManagerId: number | null;
  employees: Employee[] | undefined;
}

export function SecondaryManagersField({
  orgId,
  employeeId,
  primaryManagerId,
  employees,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { data: existing } = useListSecondaryManagers(orgId, employeeId, {
    query: {
      enabled: !!orgId && !!employeeId,
      queryKey: getListSecondaryManagersQueryKey(orgId, employeeId),
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListSecondaryManagersQueryKey(orgId, employeeId),
    });
    queryClient.invalidateQueries({
      queryKey: getListAllSecondaryManagersQueryKey(orgId),
    });
    queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(orgId) });
  };

  const addMutation = useAddSecondaryManager({
    mutation: {
      onSuccess: () => {
        setPicked("");
        setError(null);
        invalidate();
      },
      onError: (err: unknown) => {
        const msg =
          (err as { message?: string })?.message ??
          t("secondaryManagers.addFailed");
        setError(msg);
      },
    },
  });

  const removeMutation = useRemoveSecondaryManager({
    mutation: {
      onSuccess: () => invalidate(),
    },
  });

  const existingIds = new Set((existing ?? []).map((s) => s.managerId));
  const candidates = (employees ?? []).filter(
    (e) =>
      e.id !== employeeId &&
      e.id !== primaryManagerId &&
      !existingIds.has(e.id),
  );

  const handleAdd = () => {
    if (!picked) return;
    setError(null);
    addMutation.mutate({
      orgId,
      id: employeeId,
      data: { managerId: parseInt(picked, 10) },
    });
  };

  return (
    <div className="space-y-2" data-testid="secondary-managers-field">
      <Label className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-500" />
        {t("secondaryManagers.label")}
      </Label>
      <p className="text-xs text-muted-foreground">
        {t("secondaryManagers.help")}
      </p>

      {existing && existing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existing.map((s) => (
            <Badge
              key={s.managerId}
              variant="outline"
              className="border-amber-400 bg-amber-50 text-amber-900 gap-1 pr-1"
              data-testid={`chip-secondary-manager-${s.managerId}`}
            >
              <span>
                {s.firstName} {s.lastName}
              </span>
              <button
                type="button"
                aria-label={t("secondaryManagers.remove")}
                onClick={() =>
                  removeMutation.mutate({
                    orgId,
                    id: employeeId,
                    managerId: s.managerId,
                  })
                }
                className="rounded-sm hover:bg-amber-100 p-0.5"
                disabled={removeMutation.isPending}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Select value={picked} onValueChange={setPicked}>
          <SelectTrigger
            className="flex-1"
            data-testid="select-secondary-manager"
          >
            <SelectValue
              placeholder={t("secondaryManagers.selectPlaceholder")}
            />
          </SelectTrigger>
          <SelectContent>
            {candidates.length === 0 ? (
              <SelectItem value="__none__" disabled>
                {t("secondaryManagers.noOptions")}
              </SelectItem>
            ) : (
              candidates.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.firstName} {e.lastName} — {e.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!picked || addMutation.isPending}
          data-testid="button-add-secondary-manager"
        >
          <Plus className="h-4 w-4 me-1" />
          {t("secondaryManagers.add")}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
