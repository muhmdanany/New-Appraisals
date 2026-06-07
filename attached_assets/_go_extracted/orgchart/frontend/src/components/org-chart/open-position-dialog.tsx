import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OpenPositionFormData, TFn } from "@/lib/org-chart/types";
import { JobDescriptionField } from "./job-description-field";

interface OpenPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: OpenPositionFormData;
  setForm: Dispatch<SetStateAction<OpenPositionFormData>>;
  administrations: Array<{ id: number; name: string }> | undefined;
  departments: Array<{ id: number; name: string; administrationId?: number | null }> | undefined;
  employees: Array<{ id: number; firstName: string; lastName: string | null; title: string; isOpenPosition?: boolean | null }> | undefined;
  orgId: number | null | undefined;
  onSubmit: () => void;
  isSaving: boolean;
  t: TFn;
}

export function OpenPositionDialog({
  open,
  onOpenChange,
  form,
  setForm,
  administrations,
  departments,
  employees,
  orgId,
  onSubmit,
  isSaving,
  t,
}: OpenPositionDialogProps) {
  const departmentName =
    form.departmentId != null
      ? departments?.find((d) => d.id === form.departmentId)?.name ?? null
      : null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("orgChart.openPositions.addOpenPosition")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>{t("orgChart.jobTitle")}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t("orgChart.jobTitle")}
              data-testid="input-open-position-title"
            />
          </div>
          <div>
            <Label>{t("administrations.administration")}</Label>
            <Select
              value={form.administrationId ? String(form.administrationId) : "none"}
              onValueChange={(v) => setForm(f => ({ ...f, administrationId: v === "none" ? null : parseInt(v, 10) }))}
            >
              <SelectTrigger><SelectValue placeholder={t("administrations.selectAdministration")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("administrations.noAdministration")}</SelectItem>
                {administrations?.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("orgChart.department")}</Label>
            <Select
              value={form.departmentId ? String(form.departmentId) : "none"}
              onValueChange={(v) => setForm(f => ({ ...f, departmentId: v === "none" ? null : parseInt(v, 10) }))}
            >
              <SelectTrigger><SelectValue placeholder={t("orgChart.selectDepartment")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("orgChart.noDepartment")}</SelectItem>
                {(form.administrationId ? departments?.filter(d => d.administrationId === form.administrationId) : departments)?.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("orgChart.manager")}</Label>
            <Select
              value={form.managerId ? String(form.managerId) : "none"}
              onValueChange={(v) => setForm(f => ({ ...f, managerId: v === "none" ? null : parseInt(v, 10) }))}
            >
              <SelectTrigger><SelectValue placeholder={t("orgChart.selectManager")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("orgChart.noManager")}</SelectItem>
                {employees?.filter(e => !e.isOpenPosition).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName} — {e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <JobDescriptionField
            orgId={orgId}
            title={form.title}
            departmentName={departmentName}
            value={form.jobDescription}
            onChange={(v) => setForm((f) => ({ ...f, jobDescription: v }))}
            t={t}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("orgChart.cancelBtn")}</Button>
            <Button
              onClick={onSubmit}
              disabled={!form.title.trim() || isSaving}
              data-testid="button-save-open-position"
            >
              {isSaving ? t("orgChart.savingChanges") : t("orgChart.openPositions.createOpenPosition")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
