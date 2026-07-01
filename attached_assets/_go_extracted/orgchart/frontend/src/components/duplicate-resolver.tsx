import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  UserPlus,
  Merge as MergeIcon,
  SkipForward,
} from "lucide-react";
import type {
  DuplicateDetectionResult,
  DuplicateMatch,
  ImportDecision,
} from "@workspace/api-client-react";

export interface DuplicateCandidateInput {
  key: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
}

interface Props {
  candidates: DuplicateCandidateInput[];
  results: DuplicateDetectionResult[];
  onBack: () => void;
  onConfirm: (decisions: Record<string, ImportDecision>) => void;
  submitting?: boolean;
  submitError?: string | null;
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

interface RowState {
  action: "skip" | "create" | "merge";
  mergeIntoId?: number;
  fields: Record<FieldName, boolean>;
}

function defaultFieldsForCandidate(
  cand: DuplicateCandidateInput,
): Record<FieldName, boolean> {
  // Default: only mark non-empty candidate fields as "apply on merge", so the
  // initial picker state mirrors what would actually change.
  const out: Record<FieldName, boolean> = {
    firstName: false,
    lastName: false,
    title: false,
    email: false,
    phone: false,
    department: false,
  };
  for (const f of MERGEABLE_FIELDS) {
    if ((cand[f] ?? "").toString().trim() !== "") {
      out[f] = true;
    }
  }
  return out;
}

function defaultDecisionFor(
  cand: DuplicateCandidateInput,
  matches: DuplicateMatch[],
): RowState {
  const exactEmail = matches.find((m) => m.reason === "email");
  if (exactEmail) {
    return {
      action: "merge",
      mergeIntoId: exactEmail.employee.id,
      fields: defaultFieldsForCandidate(cand),
    };
  }
  // Soft matches default to skip — the admin needs to opt in to a merge.
  return {
    action: "skip",
    mergeIntoId: matches[0]?.employee.id,
    fields: defaultFieldsForCandidate(cand),
  };
}

export function DuplicateResolver({
  candidates,
  results,
  onBack,
  onConfirm,
  submitting,
  submitError,
}: Props) {
  const { t } = useTranslation();

  // Index results and candidates by key for fast lookup.
  const candByKey = useMemo(() => {
    const m = new Map<string, DuplicateCandidateInput>();
    for (const c of candidates) m.set(c.key, c);
    return m;
  }, [candidates]);

  const conflicting = useMemo(
    () => results.filter((r) => r.matches.length > 0 && candByKey.has(r.key)),
    [results, candByKey],
  );

  const [state, setState] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const r of conflicting) {
      const cand = candByKey.get(r.key);
      if (!cand) continue;
      init[r.key] = defaultDecisionFor(cand, r.matches);
    }
    return init;
  });

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const toggleField = (key: string, field: FieldName) => {
    setState((prev) => {
      const cur = prev[key];
      return {
        ...prev,
        [key]: {
          ...cur,
          fields: { ...cur.fields, [field]: !cur.fields[field] },
        },
      };
    });
  };

  // Bulk: merge every candidate that has an exact-email match into the
  // matching employee using the candidate's non-empty fields.
  const bulkMergeExactEmail = () => {
    setState((prev) => {
      const next = { ...prev };
      for (const r of conflicting) {
        const exact = r.matches.find((m) => m.reason === "email");
        const cand = candByKey.get(r.key);
        if (!exact || !cand) continue;
        next[r.key] = {
          action: "merge",
          mergeIntoId: exact.employee.id,
          fields: defaultFieldsForCandidate(cand),
        };
      }
      return next;
    });
  };

  const bulkSkipAll = () => {
    setState((prev) => {
      const next = { ...prev };
      for (const r of conflicting) {
        next[r.key] = { ...next[r.key], action: "skip" };
      }
      return next;
    });
  };

  const bulkCreateAll = () => {
    setState((prev) => {
      const next = { ...prev };
      for (const r of conflicting) {
        next[r.key] = { ...next[r.key], action: "create" };
      }
      return next;
    });
  };

  const counts = useMemo(() => {
    let skip = 0;
    let create = 0;
    let merge = 0;
    for (const r of conflicting) {
      const s = state[r.key]?.action ?? "skip";
      if (s === "skip") skip++;
      else if (s === "create") create++;
      else if (s === "merge") merge++;
    }
    return { skip, create, merge };
  }, [conflicting, state]);

  const handleConfirm = () => {
    const decisions: Record<string, ImportDecision> = {};
    for (const r of conflicting) {
      const s = state[r.key];
      if (!s) continue;
      if (s.action === "skip") {
        decisions[r.key] = { action: "skip" };
      } else if (s.action === "create") {
        decisions[r.key] = { action: "create" };
      } else if (s.action === "merge" && s.mergeIntoId) {
        const fields = MERGEABLE_FIELDS.filter((f) => s.fields[f]);
        decisions[r.key] = {
          action: "merge",
          mergeIntoId: s.mergeIntoId,
          fields,
        };
      }
    }
    onConfirm(decisions);
  };

  const reasonLabel = (reason: string) =>
    t(`duplicateImport.reason.${reason}`, { defaultValue: reason });

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {t("duplicateImport.title", { count: conflicting.length })}
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
            {t("duplicateImport.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {t("duplicateImport.bulkLabel")}:
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={bulkMergeExactEmail}
          data-testid="button-bulk-merge-email"
        >
          <MergeIcon className="h-3 w-3 me-1" />
          {t("duplicateImport.bulkMergeEmail")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={bulkSkipAll}
          data-testid="button-bulk-skip"
        >
          <SkipForward className="h-3 w-3 me-1" />
          {t("duplicateImport.bulkSkip")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={bulkCreateAll}
          data-testid="button-bulk-create"
        >
          <UserPlus className="h-3 w-3 me-1" />
          {t("duplicateImport.bulkCreate")}
        </Button>
        <span className="ms-auto text-muted-foreground">
          {t("duplicateImport.counts", {
            merge: counts.merge,
            skip: counts.skip,
            create: counts.create,
          })}
        </span>
      </div>

      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {conflicting.map((r) => {
          const cand = candByKey.get(r.key);
          if (!cand) return null;
          const row = state[r.key];
          if (!row) return null;
          const target =
            r.matches.find((m) => m.employee.id === row.mergeIntoId) ??
            r.matches[0];
          return (
            <div
              key={r.key}
              className="border border-border rounded-lg p-3 space-y-3"
              data-testid={`duplicate-row-${r.key}`}
            >
              {/* Side-by-side incoming + best match */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-2 text-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    {t("duplicateImport.incoming")}
                  </p>
                  <p className="font-medium text-sm mt-1">
                    {[cand.firstName, cand.lastName].filter(Boolean).join(" ") ||
                      "—"}
                  </p>
                  {cand.title && (
                    <p className="text-muted-foreground">{cand.title}</p>
                  )}
                  {cand.email && (
                    <p className="text-muted-foreground">{cand.email}</p>
                  )}
                  {cand.phone && (
                    <p className="text-muted-foreground">{cand.phone}</p>
                  )}
                  {cand.department && (
                    <p className="text-muted-foreground">{cand.department}</p>
                  )}
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      {t("duplicateImport.existing")}
                    </p>
                    {target && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-300">
                        {reasonLabel(target.reason)}{" "}
                        {target.score < 1 && (
                          <span className="opacity-70">
                            ({Math.round(target.score * 100)}%)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {target && (
                    <>
                      <p className="font-medium text-sm mt-1">
                        {[target.employee.firstName, target.employee.lastName]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                      {target.employee.title && (
                        <p className="text-muted-foreground">
                          {target.employee.title}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        {target.employee.email}
                      </p>
                      {target.employee.phone && (
                        <p className="text-muted-foreground">
                          {target.employee.phone}
                        </p>
                      )}
                      {target.employee.department && (
                        <p className="text-muted-foreground">
                          {target.employee.department}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* When more than one match exists, let the admin pick which one. */}
              {r.matches.length > 1 && (
                <div className="text-xs">
                  <label className="text-muted-foreground me-2">
                    {t("duplicateImport.matchPickerLabel")}
                  </label>
                  <select
                    className="border rounded-md bg-background px-2 py-1"
                    value={row.mergeIntoId ?? ""}
                    onChange={(e) =>
                      updateRow(r.key, {
                        mergeIntoId: Number(e.target.value),
                      })
                    }
                    data-testid={`select-match-${r.key}`}
                  >
                    {r.matches.map((m) => (
                      <option key={m.employee.id} value={m.employee.id}>
                        {m.employee.firstName} {m.employee.lastName} —{" "}
                        {m.employee.email} ({reasonLabel(m.reason)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action picker */}
              <div className="flex flex-wrap gap-2 text-xs">
                {(["skip", "create", "merge"] as const).map((a) => {
                  const active = row.action === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => updateRow(r.key, { action: a })}
                      data-testid={`action-${a}-${r.key}`}
                      className={`px-3 py-1.5 rounded-md border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {a === "skip" && (
                        <SkipForward className="h-3 w-3 inline me-1" />
                      )}
                      {a === "create" && (
                        <UserPlus className="h-3 w-3 inline me-1" />
                      )}
                      {a === "merge" && (
                        <MergeIcon className="h-3 w-3 inline me-1" />
                      )}
                      {t(`duplicateImport.action.${a}`)}
                    </button>
                  );
                })}
              </div>

              {/* Per-field merge picker */}
              {row.action === "merge" && target && (
                <div className="bg-muted/30 rounded-md p-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t("duplicateImport.fieldsToApply")}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {MERGEABLE_FIELDS.map((f) => {
                      const candVal = (cand[f] ?? "").toString().trim();
                      const isEmpty = candVal === "";
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
                            disabled={isEmpty}
                            checked={!isEmpty && row.fields[f]}
                            onChange={() => toggleField(r.key, f)}
                            data-testid={`field-${f}-${r.key}`}
                          />
                          <span className="font-medium">
                            {t(`duplicateImport.field.${f}`)}
                          </span>
                          {!isEmpty && (
                            <span className="text-muted-foreground truncate">
                              ← {candVal}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {submitError && (
        <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <p>{submitError}</p>
        </div>
      )}

      <div className="flex justify-between gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
          {t("common.back", { defaultValue: "Back" })}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={submitting}
          data-testid="button-confirm-duplicates"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
              {t("duplicateImport.applying")}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 me-2" />
              {t("duplicateImport.confirmAndImport")}
              <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
