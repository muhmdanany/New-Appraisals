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
import type { ChartFormData, TFn } from "@/lib/org-chart/types";

interface ChartFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ChartFormData;
  setForm: Dispatch<SetStateAction<ChartFormData>>;
  editing: boolean;
  departments: Array<{ id: number; name: string }> | undefined;
  employees: Array<{ id: number; firstName: string; lastName: string | null; title: string }> | undefined;
  onSubmit: () => void;
  isSaving: boolean;
  t: TFn;
}

export function ChartFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editing,
  departments,
  employees,
  onSubmit,
  isSaving,
  t,
}: ChartFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("orgChart.editChart") : t("orgChart.createChart")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>{t("orgChart.chartName")}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={t("orgChart.chartName")}
              data-testid="input-chart-name"
            />
          </div>
          <div>
            <Label>{t("orgChart.chartDescription")}</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t("orgChart.chartDescription")}
            />
          </div>
          <div>
            <Label>{t("orgChart.chartType")}</Label>
            <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v, rootEmployeeId: null, departmentId: null }))}>
              <SelectTrigger data-testid="select-chart-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">{t("orgChart.chartTypeCompany")}</SelectItem>
                <SelectItem value="department">{t("orgChart.chartTypeDepartment")}</SelectItem>
                <SelectItem value="management">{t("orgChart.chartTypeManagement")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.type === "department" && (
            <div>
              <Label>{t("orgChart.selectDepartmentForChart")}</Label>
              <Select
                value={form.departmentId ? String(form.departmentId) : "none"}
                onValueChange={(v) => setForm(f => ({ ...f, departmentId: v === "none" ? null : Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("orgChart.selectDepartmentForChart")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("orgChart.noDepartment")}</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.type === "management" && (
            <div>
              <Label>{t("orgChart.selectRootEmployee")}</Label>
              <Select
                value={form.rootEmployeeId ? String(form.rootEmployeeId) : "none"}
                onValueChange={(v) => setForm(f => ({ ...f, rootEmployeeId: v === "none" ? null : Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("orgChart.selectRootEmployee")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.firstName} {e.lastName} — {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("orgChart.cancelBtn")}</Button>
            <Button
              onClick={onSubmit}
              disabled={!form.name.trim() || isSaving}
              data-testid="button-save-chart"
            >
              {isSaving ? t("orgChart.savingChanges") : t("orgChart.saveChanges")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
