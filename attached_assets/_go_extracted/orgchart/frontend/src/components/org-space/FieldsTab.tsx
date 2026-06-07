import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Star, ArrowUp, ArrowDown, Edit2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface CustomField {
  id: number;
  label: string;
  fieldType: string;
  appliesTo: string;
  isRequired: boolean;
  isStandard: boolean;
  isSensitive?: boolean;
  displayOrder: number;
  options?: string[] | null;
}

interface FieldsTabProps {
  orgId: number;
}

const DEFAULT_FORM = {
  label: "",
  fieldType: "text",
  appliesTo: "person",
  isRequired: false,
  isSensitive: false,
  optionsText: "",
};

export function FieldsTab({ orgId }: FieldsTabProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const canEdit = hasPermission("fields", "edit");

  const loadFields = () => {
    setIsLoading(true);
    fetch(`${API_BASE}/organizations/${orgId}/fields`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setFields(Array.isArray(data) ? data : []))
      .catch(() => setFields([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!orgId) return;
    loadFields();
  }, [orgId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    setIsDialogOpen(true);
  };

  const openEdit = (field: CustomField) => {
    setEditingId(field.id);
    setForm({
      label: field.label,
      fieldType: field.fieldType,
      appliesTo: field.appliesTo,
      isRequired: field.isRequired,
      isSensitive: !!field.isSensitive,
      optionsText: Array.isArray(field.options) ? field.options.join("\n") : "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) return;
    const options =
      form.fieldType === "select"
        ? form.optionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const body = {
      label: form.label,
      fieldType: form.fieldType,
      appliesTo: form.appliesTo,
      isRequired: form.isRequired,
      isSensitive: form.isSensitive,
      options,
    };
    try {
      const url = editingId
        ? `${API_BASE}/organizations/${orgId}/fields/${editingId}`
        : `${API_BASE}/organizations/${orgId}/fields`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIsDialogOpen(false);
        setEditingId(null);
        setForm({ ...DEFAULT_FORM });
        loadFields();
        showToast("✓");
      }
    } catch {}
  };

  const handleDelete = async (field: CustomField) => {
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/fields/${field.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setFieldToDelete(null);
        loadFields();
        showToast(t("fields.deleteField") + " ✓");
      }
    } catch {}
  };

  const moveField = async (idx: number, dir: -1 | 1) => {
    const customFields = fields.filter((f) => !f.isStandard);
    const target = idx + dir;
    if (target < 0 || target >= customFields.length) return;
    const reordered = [...customFields];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setFields([
      ...fields.filter((f) => f.isStandard),
      ...reordered,
    ]);
    try {
      await fetch(`${API_BASE}/organizations/${orgId}/fields/reorder`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((f) => f.id) }),
      });
      loadFields();
    } catch {
      loadFields();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const customFields = fields.filter((f) => !f.isStandard);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{t("fields.subtitle")}</div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
              onClick={openCreate}
              data-testid="button-add-field"
            >
              <Plus className="h-4 w-4" />
              {t("fields.addField")}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fields.label")}</TableHead>
              <TableHead>{t("fields.appliesTo")}</TableHead>
              <TableHead>{t("fields.type")}</TableHead>
              <TableHead>{t("fields.isRequired")}</TableHead>
              <TableHead>{t("fields.additionalInfo")}</TableHead>
              {canEdit && <TableHead className="w-32"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => {
              const customIdx = customFields.findIndex((f) => f.id === field.id);
              return (
                <TableRow key={field.id} className="hover:bg-muted/50" data-testid={`row-field-${field.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {field.isStandard && (
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      )}
                      <span className="font-medium">{field.label}</span>
                      {field.isSensitive && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                          {t("fields.sensitive")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {field.appliesTo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize text-sm">
                    {field.fieldType}
                  </TableCell>
                  <TableCell>
                    {field.isRequired ? (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs border-0">
                        {t("fields.isRequired")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {field.isStandard ? t("fields.standard") : t("fields.custom")}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      {!field.isStandard && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={customIdx <= 0}
                            onClick={() => moveField(customIdx, -1)}
                            data-testid={`button-field-up-${field.id}`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={customIdx >= customFields.length - 1}
                            onClick={() => moveField(customIdx, 1)}
                            data-testid={`button-field-down-${field.id}`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(field)}
                            data-testid={`button-field-edit-${field.id}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setFieldToDelete(field)}
                            data-testid={`button-field-delete-${field.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="p-3 border-t border-border text-xs text-muted-foreground">
        {fields.length} {t("fields.title").toLowerCase()}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("fields.editField") : t("fields.addField")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("fields.label")}</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Field name..."
                className="mt-1"
                data-testid="input-field-label"
              />
            </div>
            <div>
              <Label>{t("fields.appliesTo")}</Label>
              <Select
                value={form.appliesTo}
                onValueChange={(v) => setForm((f) => ({ ...f, appliesTo: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">{t("fields.person")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("fields.type")}</Label>
              <Select
                value={form.fieldType}
                onValueChange={(v) => setForm((f) => ({ ...f, fieldType: v }))}
              >
                <SelectTrigger className="mt-1" data-testid="select-field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Yes/No</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.fieldType === "select" && (
              <div>
                <Label>{t("fields.optionsLabel")}</Label>
                <textarea
                  value={form.optionsText}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                  placeholder={t("fields.optionsPlaceholder")}
                  className="mt-1 w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="input-field-options"
                />
                <p className="text-xs text-muted-foreground mt-1">{t("fields.optionsHint")}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch
                id="isRequired"
                checked={form.isRequired}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isRequired: v }))}
              />
              <Label htmlFor="isRequired">{t("fields.isRequired")}</Label>
            </div>
            <div className="flex items-start gap-3">
              <Switch
                id="isSensitive"
                checked={form.isSensitive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isSensitive: v }))}
                data-testid="switch-field-sensitive"
              />
              <div className="flex-1">
                <Label htmlFor="isSensitive">{t("fields.sensitive")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("fields.sensitiveHint")}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleSave}
                disabled={!form.label.trim()}
                data-testid="button-save-field"
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!fieldToDelete} onOpenChange={(o) => { if (!o) setFieldToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("fields.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fieldToDelete && handleDelete(fieldToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirmDialog.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {toast && (
        <div className="fixed bottom-6 end-6 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
