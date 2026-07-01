import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Star, AlertTriangle } from "lucide-react";
import type { Employee } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Readiness = "ready_now" | "1_year" | "2_years";

interface SuccessorRecord {
  id: number;
  successorEmployeeId: number;
  successorFirstName: string;
  successorLastName: string;
  successorTitle: string;
  readiness: Readiness;
  notes: string;
  position: number;
}

interface DraftSuccessor {
  successorEmployeeId: number | null;
  readiness: Readiness;
  notes: string;
}

interface SuccessionPanelProps {
  orgId: number;
  employee: Employee;
  allEmployees: Employee[];
  canEdit: boolean;
  onCriticalRoleUpdated?: (isCritical: boolean) => void;
}

export function SuccessionPanel({
  orgId,
  employee,
  allEmployees,
  canEdit,
  onCriticalRoleUpdated,
}: SuccessionPanelProps) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<DraftSuccessor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCritical, setSavingCritical] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isCritical, setIsCritical] = useState<boolean>(!!employee.isCriticalRole);

  useEffect(() => {
    setIsCritical(!!employee.isCriticalRole);
  }, [employee.id, employee.isCriticalRole]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/organizations/${orgId}/employees/${employee.id}/successors`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SuccessorRecord[]) => {
        const list: DraftSuccessor[] = (data || []).map((s) => ({
          successorEmployeeId: s.successorEmployeeId,
          readiness: s.readiness,
          notes: s.notes,
        }));
        setDrafts(list);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orgId, employee.id]);

  const candidates = useMemo(() => {
    return allEmployees.filter(
      (e) => e.id !== employee.id && e.isActive !== false && !e.isOpenPosition,
    );
  }, [allEmployees, employee.id]);

  const usedIds = new Set(
    drafts.map((d) => d.successorEmployeeId).filter((x): x is number => x !== null),
  );

  const addRow = () => {
    if (drafts.length >= 3) return;
    setDrafts((prev) => [
      ...prev,
      { successorEmployeeId: null, readiness: "1_year", notes: "" },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<DraftSuccessor>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeRow = (idx: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        successors: drafts
          .filter((d) => d.successorEmployeeId !== null)
          .map((d) => ({
            successorEmployeeId: d.successorEmployeeId,
            readiness: d.readiness,
            notes: d.notes,
          })),
      };
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/employees/${employee.id}/successors`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data: SuccessorRecord[] = await res.json();
      setDrafts(
        (data || []).map((s) => ({
          successorEmployeeId: s.successorEmployeeId,
          readiness: s.readiness,
          notes: s.notes,
        })),
      );
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCritical = async (next: boolean) => {
    setSavingCritical(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/employees/${employee.id}/critical-role`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCriticalRole: next }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setIsCritical(next);
      onCriticalRoleUpdated?.(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingCritical(false);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-border" data-testid="succession-panel">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-foreground flex items-center gap-1.5">
          <Star className="h-4 w-4 text-amber-500" />
          {t("succession.panelTitle")}
        </h4>
      </div>

      <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 border border-border rounded-md mb-4">
        <div className="text-sm">
          <p className="font-medium text-foreground">{t("succession.criticalRole")}</p>
          <p className="text-xs text-muted-foreground">{t("succession.criticalRoleHint")}</p>
        </div>
        <Switch
          checked={isCritical}
          disabled={!canEdit || savingCritical}
          onCheckedChange={toggleCritical}
          data-testid="switch-critical-role"
          aria-label={t("succession.criticalRole")}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {drafts.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                {t("succession.noneYet")}
              </p>
            )}
            {drafts.map((d, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-md p-3 space-y-2"
                data-testid={`successor-row-${idx}`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-[10px]">
                    {t("succession.successorN", { n: idx + 1 })}
                  </Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeRow(idx)}
                      data-testid={`button-remove-successor-${idx}`}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    {t("succession.candidate")}
                  </Label>
                  <Select
                    value={d.successorEmployeeId ? String(d.successorEmployeeId) : ""}
                    onValueChange={(v) => updateRow(idx, { successorEmployeeId: Number(v) })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger
                      className="h-8 mt-1 text-sm"
                      data-testid={`select-successor-${idx}`}
                    >
                      <SelectValue placeholder={t("succession.selectCandidate")} />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates
                        .filter(
                          (c) =>
                            !usedIds.has(c.id) || c.id === d.successorEmployeeId,
                        )
                        .map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.firstName} {c.lastName}
                            {c.title ? ` — ${c.title}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    {t("succession.readiness")}
                  </Label>
                  <Select
                    value={d.readiness}
                    onValueChange={(v) =>
                      updateRow(idx, { readiness: v as Readiness })
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger
                      className="h-8 mt-1 text-sm"
                      data-testid={`select-readiness-${idx}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ready_now">
                        {t("succession.readinessOpts.ready_now")}
                      </SelectItem>
                      <SelectItem value="1_year">
                        {t("succession.readinessOpts.1_year")}
                      </SelectItem>
                      <SelectItem value="2_years">
                        {t("succession.readinessOpts.2_years")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    {t("succession.notes")}
                  </Label>
                  <Textarea
                    value={d.notes}
                    onChange={(e) => updateRow(idx, { notes: e.target.value })}
                    rows={2}
                    className="text-sm mt-1"
                    placeholder={t("succession.notesPlaceholder")}
                    disabled={!canEdit}
                    data-testid={`input-notes-${idx}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 mt-3">
              {drafts.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  data-testid="button-add-successor"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("succession.addSuccessor")}
                </Button>
              )}
              <Button
                size="sm"
                onClick={save}
                disabled={
                  saving ||
                  drafts.some((d) => d.successorEmployeeId === null) ||
                  drafts.length > 3
                }
                data-testid="button-save-successors"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t("common.save")
                )}
              </Button>
              {savedAt && (
                <span className="text-xs text-emerald-600">{t("succession.saved")}</span>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
