import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFindExistingDuplicates,
  useMergeExistingEmployees,
  getFindExistingDuplicatesQueryKey,
  getListEmployeesQueryKey,
  getGetOrgDashboardQueryKey,
  getGetOrgChartQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  type ExistingDuplicatePair,
  type DuplicateMatchEmployee,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Loader2,
  Merge as MergeIcon,
  RefreshCw,
  SkipForward,
} from "lucide-react";

interface Props {
  orgId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MERGEABLE_FIELDS = [
  "firstName",
  "lastName",
  "title",
  "email",
  "phone",
  "department",
] as const;

type FieldName = (typeof MERGEABLE_FIELDS)[number];

interface PairState {
  // direction "AtoB" => B is the kept record (winner), A is removed (loser)
  direction: "AtoB" | "BtoA";
  fields: Record<FieldName, boolean>;
  status: "pending" | "merging" | "merged" | "skipped" | "error";
  error?: string;
}

const pairKey = (p: ExistingDuplicatePair) =>
  `pair-${Math.min(p.a.id, p.b.id)}-${Math.max(p.a.id, p.b.id)}`;

const fieldVal = (e: DuplicateMatchEmployee, f: FieldName): string => {
  switch (f) {
    case "firstName":
      return e.firstName ?? "";
    case "lastName":
      return e.lastName ?? "";
    case "title":
      return e.title ?? "";
    case "email":
      return e.email ?? "";
    case "phone":
      return e.phone ?? "";
    case "department":
      return e.department ?? "";
  }
};

// Default field selection: pre-check every field where the loser has a
// non-empty value that differs from the winner — same logic as the import
// resolver so the picker mirrors what would actually change.
function defaultFieldsFor(
  loser: DuplicateMatchEmployee,
  winner: DuplicateMatchEmployee,
): Record<FieldName, boolean> {
  const out: Record<FieldName, boolean> = {
    firstName: false,
    lastName: false,
    title: false,
    email: false,
    phone: false,
    department: false,
  };
  for (const f of MERGEABLE_FIELDS) {
    const lv = fieldVal(loser, f).trim();
    const wv = fieldVal(winner, f).trim();
    if (lv !== "" && lv !== wv) out[f] = true;
  }
  return out;
}

export function FindDuplicatesDialog({ orgId, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useFindExistingDuplicates(
    orgId!,
    {
      query: {
        enabled: !!orgId && open,
        queryKey: getFindExistingDuplicatesQueryKey(orgId!),
      },
    },
  );

  const pairs = useMemo<ExistingDuplicatePair[]>(
    () => data?.pairs ?? [],
    [data],
  );

  // Per-pair UI state. Re-initialize whenever the pair set changes (e.g.
  // after a successful merge invalidates the query and we get fresh data).
  const [state, setState] = useState<Record<string, PairState>>({});
  useEffect(() => {
    setState((prev) => {
      const next: Record<string, PairState> = {};
      for (const p of pairs) {
        const k = pairKey(p);
        if (prev[k]) {
          next[k] = prev[k];
          continue;
        }
        // Default: keep the lower-id record (typically the older one).
        const direction: "AtoB" | "BtoA" = p.a.id < p.b.id ? "BtoA" : "AtoB";
        const winner = direction === "AtoB" ? p.b : p.a;
        const loser = direction === "AtoB" ? p.a : p.b;
        next[k] = {
          direction,
          fields: defaultFieldsFor(loser, winner),
          status: "pending",
        };
      }
      return next;
    });
  }, [pairs]);

  const mergeMutation = useMergeExistingEmployees();

  const invalidateAfterMerge = () => {
    if (!orgId) return;
    queryClient.invalidateQueries({
      queryKey: getFindExistingDuplicatesQueryKey(orgId),
    });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(orgId) });
    queryClient.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(orgId) });
    queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(orgId) });
    queryClient.invalidateQueries({
      queryKey: getGetRecentActivityQueryKey(orgId),
    });
    queryClient.invalidateQueries({
      queryKey: getGetDepartmentStatsQueryKey(orgId),
    });
  };

  const swap = (key: string) => {
    setState((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      const pair = pairs.find((p) => pairKey(p) === key);
      if (!pair) return prev;
      const direction = cur.direction === "AtoB" ? "BtoA" : "AtoB";
      const winner = direction === "AtoB" ? pair.b : pair.a;
      const loser = direction === "AtoB" ? pair.a : pair.b;
      return {
        ...prev,
        [key]: {
          ...cur,
          direction,
          fields: defaultFieldsFor(loser, winner),
        },
      };
    });
  };

  const toggleField = (key: string, f: FieldName) => {
    setState((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      return {
        ...prev,
        [key]: { ...cur, fields: { ...cur.fields, [f]: !cur.fields[f] } },
      };
    });
  };

  const skipPair = (key: string) => {
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: "skipped" },
    }));
  };

  const mergePair = async (pair: ExistingDuplicatePair) => {
    if (!orgId) return;
    const key = pairKey(pair);
    const cur = state[key];
    if (!cur) return;
    const winner = cur.direction === "AtoB" ? pair.b : pair.a;
    const loser = cur.direction === "AtoB" ? pair.a : pair.b;
    const fields = MERGEABLE_FIELDS.filter((f) => cur.fields[f]);
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: "merging", error: undefined },
    }));
    try {
      await mergeMutation.mutateAsync({
        orgId,
        id: loser.id,
        data: { mergeIntoId: winner.id, fields },
      });
      setState((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: "merged" },
      }));
      invalidateAfterMerge();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: "error", error: message },
      }));
    }
  };

  // Map backend reason codes to the existing duplicateImport.reason.* keys
  // so we share copy with the import flow.
  const reasonLabel = (reason: string) => {
    const key =
      reason === "name_in_department"
        ? "name_dept"
        : reason === "name_similarity"
          ? "name_similar"
          : reason;
    return t(`duplicateImport.reason.${key}`, { defaultValue: reason });
  };

  const visiblePairs = pairs.filter(
    (p) => state[pairKey(p)]?.status !== "merged",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("existingDuplicates.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("existingDuplicates.loading")}
            </div>
          ) : visiblePairs.length === 0 ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4 text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("existingDuplicates.none")}
            </div>
          ) : (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    {t("existingDuplicates.pairCount", {
                      count: visiblePairs.length,
                    })}
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    {t("existingDuplicates.intro")}
                  </p>
                </div>
              </div>

              {visiblePairs.map((pair) => {
                const key = pairKey(pair);
                const cur = state[key];
                if (!cur) return null;
                const winner = cur.direction === "AtoB" ? pair.b : pair.a;
                const loser = cur.direction === "AtoB" ? pair.a : pair.b;
                const isSkipped = cur.status === "skipped";
                return (
                  <div
                    key={key}
                    className={`border border-border rounded-lg p-3 space-y-3 ${
                      isSkipped ? "opacity-60" : ""
                    }`}
                    data-testid={`existing-dup-${key}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {reasonLabel(pair.reason)}{" "}
                        {pair.score < 1 && (
                          <span className="opacity-70">
                            ({Math.round(pair.score * 100)}%)
                          </span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => swap(key)}
                        disabled={cur.status === "merging" || isSkipped}
                        data-testid={`swap-${key}`}
                      >
                        <ArrowLeftRight className="h-3 w-3 me-1" />
                        {t("existingDuplicates.swap")}
                      </Button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <EmployeeCard
                        employee={winner}
                        kind="keep"
                        label={t("existingDuplicates.keep")}
                      />
                      <EmployeeCard
                        employee={loser}
                        kind="discard"
                        label={t("existingDuplicates.discard")}
                      />
                    </div>

                    {!isSkipped && (
                      <div className="bg-muted/30 rounded-md p-2 space-y-1">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {t("existingDuplicates.fieldsToCopy")}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                          {MERGEABLE_FIELDS.map((f) => {
                            const lv = fieldVal(loser, f).trim();
                            const wv = fieldVal(winner, f).trim();
                            const isEmpty = lv === "" || lv === wv;
                            return (
                              <label
                                key={f}
                                className={`flex items-center gap-1.5 text-xs ${
                                  isEmpty
                                    ? "opacity-40 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={
                                    isEmpty || cur.status === "merging"
                                  }
                                  checked={!isEmpty && cur.fields[f]}
                                  onChange={() => toggleField(key, f)}
                                  data-testid={`existing-field-${f}-${key}`}
                                />
                                <span className="font-medium">
                                  {t(`duplicateImport.field.${f}`)}
                                </span>
                                {!isEmpty && (
                                  <span className="text-muted-foreground truncate">
                                    ← {lv}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {cur.status === "error" && cur.error && (
                      <div className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">
                        {t("existingDuplicates.mergeError", {
                          message: cur.error,
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => skipPair(key)}
                        disabled={cur.status === "merging" || isSkipped}
                        data-testid={`skip-${key}`}
                      >
                        <SkipForward className="h-3 w-3 me-1" />
                        {t("existingDuplicates.skip")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => mergePair(pair)}
                        disabled={cur.status === "merging" || isSkipped}
                        data-testid={`merge-${key}`}
                      >
                        {cur.status === "merging" ? (
                          <>
                            <Loader2 className="h-3 w-3 me-1 animate-spin" />
                            {t("existingDuplicates.merging")}
                          </>
                        ) : (
                          <>
                            <MergeIcon className="h-3 w-3 me-1" />
                            {t("existingDuplicates.merge")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-rescan-duplicates"
          >
            <RefreshCw
              className={`h-4 w-4 me-2 ${isFetching ? "animate-spin" : ""}`}
            />
            {t("existingDuplicates.refresh")}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-duplicates"
          >
            {t("existingDuplicates.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeCard({
  employee,
  kind,
  label,
}: {
  employee: DuplicateMatchEmployee;
  kind: "keep" | "discard";
  label: string;
}) {
  const styles =
    kind === "keep"
      ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900"
      : "border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900";
  const labelStyles =
    kind === "keep"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-rose-700 dark:text-rose-300";
  return (
    <div className={`rounded-md border p-2 text-xs ${styles}`}>
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide ${labelStyles}`}
      >
        {label}
      </p>
      <p className="font-medium text-sm mt-1">
        {[employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
          "—"}
      </p>
      {employee.title && (
        <p className="text-muted-foreground">{employee.title}</p>
      )}
      {employee.email && (
        <p className="text-muted-foreground">{employee.email}</p>
      )}
      {employee.phone && (
        <p className="text-muted-foreground">{employee.phone}</p>
      )}
      {employee.department && (
        <p className="text-muted-foreground">{employee.department}</p>
      )}
    </div>
  );
}
