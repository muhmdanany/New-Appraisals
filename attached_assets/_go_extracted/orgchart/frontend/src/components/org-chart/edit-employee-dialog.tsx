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
import { CountryPicker } from "@/components/country-picker";
import { SecondaryManagersField } from "@/components/secondary-managers-field";
import type { Dispatch, SetStateAction } from "react";
import type { Employee } from "@workspace/api-client-react";
import type { EditFormData, OrgChartNode, TFn } from "@/lib/org-chart/types";
import { JobDescriptionField } from "./job-description-field";
import { TagPicker } from "@/components/tag-picker";

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: EditFormData;
  setEditForm: Dispatch<SetStateAction<EditFormData>>;
  selectedNode: OrgChartNode | null;
  selectedOrgId: number | null | undefined;
  administrations: Array<{ id: number; name: string }> | undefined;
  departments: Array<{ id: number; name: string; administrationId?: number | null }> | undefined;
  employees: Employee[] | undefined;
  onSubmit: () => void;
  isSaving: boolean;
  t: TFn;
}

export function EditEmployeeDialog({
  open,
  onOpenChange,
  editForm,
  setEditForm,
  selectedNode,
  selectedOrgId,
  administrations,
  departments,
  employees,
  onSubmit,
  isSaving,
  t,
}: EditEmployeeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("orgChart.editEmployee")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Label>{t("orgChart.firstName")}</Label>
            <Input value={editForm.firstName} onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <Label>{t("orgChart.lastName")}</Label>
            <Input value={editForm.lastName} onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>{t("orgChart.jobTitle")}</Label>
            <Input value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>{t("orgChart.emailLabel")}</Label>
            <Input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>{t("orgChart.phone")}</Label>
            <Input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>{t("orgChart.location")}</Label>
            <Input value={editForm.location} onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>{t("employees.nationality")}</Label>
            <CountryPicker
              value={editForm.nationality}
              onChange={(code) => setEditForm(f => ({ ...f, nationality: code }))}
              placeholder={t("employees.selectNationality")}
              searchPlaceholder={t("employees.searchCountry")}
              noResultsText={t("employees.noCountryFound")}
            />
          </div>
          <div className="col-span-2">
            <Label>{t("administrations.administration")}</Label>
            <Select
              value={editForm.administrationId ? String(editForm.administrationId) : "none"}
              onValueChange={(v) => setEditForm(f => ({ ...f, administrationId: v === "none" ? null : parseInt(v, 10) }))}
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
          <div className="col-span-2">
            <Label>{t("orgChart.department")}</Label>
            <Select
              value={editForm.departmentId ? String(editForm.departmentId) : "none"}
              onValueChange={(v) => setEditForm(f => ({ ...f, departmentId: v === "none" ? null : parseInt(v, 10) }))}
            >
              <SelectTrigger><SelectValue placeholder={t("orgChart.selectDepartment")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("orgChart.noDepartment")}</SelectItem>
                {(editForm.administrationId ? departments?.filter(d => d.administrationId === editForm.administrationId) : departments)?.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{t("orgChart.manager")}</Label>
            <Select
              value={editForm.managerId ? String(editForm.managerId) : "none"}
              onValueChange={(v) => setEditForm(f => ({ ...f, managerId: v === "none" ? null : parseInt(v, 10) }))}
            >
              <SelectTrigger><SelectValue placeholder={t("orgChart.selectManager")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("orgChart.noManager")}</SelectItem>
                {employees
                  ?.filter((e) => selectedNode && e.id !== selectedNode.id)
                  .map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.firstName} {e.lastName} — {e.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {selectedNode && selectedOrgId && (
            <div className="col-span-2">
              <SecondaryManagersField
                orgId={selectedOrgId}
                employeeId={selectedNode.id}
                primaryManagerId={editForm.managerId}
                employees={employees}
              />
            </div>
          )}
          {selectedNode && selectedOrgId && (
            <div className="col-span-2">
              <TagPicker orgId={selectedOrgId} employeeId={selectedNode.id} />
            </div>
          )}
          <div className="col-span-2">
            <JobDescriptionField
              orgId={selectedOrgId}
              title={editForm.title}
              departmentName={
                editForm.departmentId != null
                  ? departments?.find((d) => d.id === editForm.departmentId)?.name ?? null
                  : null
              }
              value={editForm.jobDescription}
              onChange={(v) => setEditForm((f) => ({ ...f, jobDescription: v }))}
              t={t}
            />
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("orgChart.cancelBtn")}</Button>
            <Button onClick={onSubmit} disabled={isSaving}>
              {isSaving ? t("orgChart.savingChanges") : t("orgChart.saveChanges")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
