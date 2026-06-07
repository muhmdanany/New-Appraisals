import { useState, useEffect } from "react";
import {
  Mail,
  Edit2,
  ArrowRightLeft,
  Trash2,
  Plus,
  Users,
  Pencil,
  StickyNote,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { countryCodeToFlag } from "@/lib/countries";
import { resolvePhotoUrl } from "@/lib/photo-url";
import type { OrgChartNode, TFn } from "@/lib/org-chart/types";
import {
  useListEmployeePersonalNotes,
  useCreateEmployeePersonalNote,
  useUpdateEmployeePersonalNote,
  useDeleteEmployeePersonalNote,
  getListEmployeePersonalNotesQueryKey,
  type PersonalNote,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface EmployeeDetailDialogProps {
  selectedNode: OrgChartNode | null;
  isEditOpen: boolean;
  selectedNodeSecondary: Array<{ managerId: number; firstName: string; lastName: string | null }> | undefined;
  orgId: number | null;
  language: string;
  onClose: () => void;
  onFillPosition: () => void;
  onEdit: (node: OrgChartNode) => void;
  onAddOpenPosition: (node: OrgChartNode) => void;
  onMakeRoot: (id: number) => void;
  onRemoveFromChart: (id: number) => void;
  t: TFn;
}

export function EmployeeDetailDialog({
  selectedNode,
  isEditOpen,
  selectedNodeSecondary,
  orgId,
  language,
  onClose,
  onFillPosition,
  onEdit,
  onAddOpenPosition,
  onMakeRoot,
  onRemoveFromChart,
  t,
}: EmployeeDetailDialogProps) {
  if (!selectedNode || isEditOpen) return null;
  return (
    <Dialog open={!!selectedNode} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={resolvePhotoUrl(selectedNode.avatarUrl)} />
              <AvatarFallback
                style={{
                  backgroundColor: selectedNode.departmentColor ? `${selectedNode.departmentColor}20` : undefined,
                  color: selectedNode.departmentColor || undefined,
                }}
              >
                {selectedNode.firstName[0]}{selectedNode.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p>
                {selectedNode.nationality && <span className="mr-1">{countryCodeToFlag(selectedNode.nationality)}</span>}
                {selectedNode.firstName} {selectedNode.lastName}
              </p>
              <p className="text-sm font-normal text-muted-foreground">{selectedNode.title}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="details" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" data-testid="tab-employee-details">
              {t("orgChart.detailsTab", { defaultValue: "Details" })}
            </TabsTrigger>
            <TabsTrigger value="personalNotes" data-testid="tab-personal-notes">
              <StickyNote className="h-3.5 w-3.5 me-1.5" />
              {t("personalNotes.tab")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4 mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${selectedNode.email}`} className="text-primary hover:underline">{selectedNode.email}</a>
            </div>
            {selectedNode.departmentName && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: selectedNode.departmentColor ? `${selectedNode.departmentColor}15` : undefined,
                    color: selectedNode.departmentColor || undefined,
                  }}
                >
                  {selectedNode.departmentName}
                </Badge>
                {selectedNode.directReports > 0 && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {t("orgChart.directReports", { count: selectedNode.directReports })}
                  </span>
                )}
              </div>
            )}
            {selectedNodeSecondary && selectedNodeSecondary.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-500" />
                  {t("secondaryManagers.label")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNodeSecondary.map((s) => (
                    <Badge
                      key={s.managerId}
                      variant="outline"
                      className="border-amber-400 bg-amber-50 text-amber-900"
                    >
                      {s.firstName} {s.lastName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {selectedNode.isOpenPosition ? (
                <Button size="sm" onClick={onFillPosition} data-testid="button-fill-position">
                  <Users className="h-4 w-4 me-1" />
                  {t("orgChart.openPositions.fillPosition")}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" onClick={() => onEdit(selectedNode)}>
                      <Edit2 className="h-4 w-4 me-1" />
                      {t("orgChart.editBtn")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("tooltips.editEmployee")}</TooltipContent>
                </Tooltip>
              )}
              {!selectedNode.isOpenPosition && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddOpenPosition(selectedNode)}
                  data-testid="button-add-open-position-from-node"
                >
                  <Plus className="h-4 w-4 me-1" />
                  {t("orgChart.openPositions.addOpenPosition")}
                </Button>
              )}
              {selectedNode.managerId && (
                <Button variant="outline" size="sm" onClick={() => onMakeRoot(selectedNode.id)}>
                  <ArrowRightLeft className="h-4 w-4 me-1" />
                  {t("orgChart.removeManager")}
                </Button>
              )}
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="ms-auto">
                        <Trash2 className="h-4 w-4 me-1" />
                        {t("orgChart.deleteBtn")}
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("tooltips.deleteEmployee")}</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("confirmDialog.removeFromChartDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onRemoveFromChart(selectedNode.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("orgChart.deleteBtn")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>
          <TabsContent value="personalNotes" className="mt-3">
            <PersonalNotesPanel
              orgId={orgId}
              employeeId={selectedNode.id}
              language={language}
              t={t}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface PersonalNotesPanelProps {
  orgId: number | null;
  employeeId: number;
  language: string;
  t: TFn;
}

function PersonalNotesPanel({ orgId, employeeId, language, t }: PersonalNotesPanelProps) {
  const queryClient = useQueryClient();
  const enabled = !!orgId;
  const queryKey = enabled
    ? getListEmployeePersonalNotesQueryKey(orgId!, employeeId)
    : [];

  const { data, isLoading, error } = useListEmployeePersonalNotes(
    orgId ?? 0,
    employeeId,
    {
      query: { enabled, queryKey },
    },
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/organizations", orgId, "employees", employeeId, "personal-notes"],
      exact: false,
    });

  const createNote = useCreateEmployeePersonalNote({
    mutation: { onSuccess: () => invalidate() },
  });
  const updateNote = useUpdateEmployeePersonalNote({
    mutation: { onSuccess: () => invalidate() },
  });
  const deleteNote = useDeleteEmployeePersonalNote({
    mutation: { onSuccess: () => invalidate() },
  });

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setEditingId(null);
    setEditingBody("");
    setErrorMsg(null);
  }, [employeeId]);

  const submitNew = async () => {
    const body = draft.trim();
    if (!body) {
      setErrorMsg(t("personalNotes.bodyRequired"));
      return;
    }
    setErrorMsg(null);
    try {
      await createNote.mutateAsync({ orgId: orgId!, id: employeeId, data: { body } });
      setDraft("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("personalNotes.saveError"));
    }
  };

  const submitEdit = async (note: PersonalNote) => {
    const body = editingBody.trim();
    if (!body) {
      setErrorMsg(t("personalNotes.bodyRequired"));
      return;
    }
    setErrorMsg(null);
    try {
      await updateNote.mutateAsync({
        orgId: orgId!,
        id: employeeId,
        noteId: note.id,
        data: { body },
      });
      setEditingId(null);
      setEditingBody("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("personalNotes.saveError"));
    }
  };

  const removeNote = async (note: PersonalNote) => {
    if (!window.confirm(t("personalNotes.deleteConfirm"))) return;
    setErrorMsg(null);
    try {
      await deleteNote.mutateAsync({ orgId: orgId!, id: employeeId, noteId: note.id });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("personalNotes.deleteError"));
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString(language, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return s;
    }
  };

  const notes = data ?? [];
  const isSaving = createNote.isPending || updateNote.isPending;

  return (
    <div className="space-y-3" data-testid="personal-notes-panel">
      <p className="text-xs text-muted-foreground">{t("personalNotes.privacyHint")}</p>

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("personalNotes.placeholder")}
          rows={3}
          maxLength={5000}
          data-testid="input-personal-note-body"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={submitNew}
            disabled={isSaving || !draft.trim()}
            data-testid="button-save-personal-note"
          >
            <Plus className="h-4 w-4 me-1" />
            {createNote.isPending ? t("personalNotes.saving") : t("personalNotes.add")}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-destructive" role="alert">{errorMsg}</p>
      )}

      <div className="border-t pt-3 space-y-2 max-h-72 overflow-y-auto">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("personalNotes.loading")}</p>
        )}
        {error && !isLoading && (
          <p className="text-sm text-destructive">{t("personalNotes.loadError")}</p>
        )}
        {!isLoading && !error && notes.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("personalNotes.empty")}</p>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className="rounded-md border bg-muted/30 p-2.5 space-y-1.5"
            data-testid={`personal-note-${n.id}`}
          >
            {editingId === n.id ? (
              <>
                <Textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  data-testid={`input-edit-personal-note-${n.id}`}
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditingId(null); setEditingBody(""); }}
                  >
                    {t("personalNotes.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => submitEdit(n)}
                    disabled={isSaving}
                    data-testid={`button-save-edit-personal-note-${n.id}`}
                  >
                    {updateNote.isPending ? t("personalNotes.saving") : t("personalNotes.save")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDate(n.updatedAt)}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => { setEditingId(n.id); setEditingBody(n.body); setErrorMsg(null); }}
                      data-testid={`button-edit-personal-note-${n.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => removeNote(n)}
                      data-testid={`button-delete-personal-note-${n.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
