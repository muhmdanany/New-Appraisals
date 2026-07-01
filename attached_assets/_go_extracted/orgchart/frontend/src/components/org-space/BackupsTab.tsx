import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DatabaseBackup, RotateCcw, Trash2, CheckCircle2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Backup {
  id: number;
  type: string;
  createdAt: string;
  chartCount: number;
  employeeCount: number;
  fieldCount: number;
}

interface BackupsTabProps {
  orgId: number;
}

export function BackupsTab({ orgId }: BackupsTabProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<Backup | null>(null);
  const [backupToRestore, setBackupToRestore] = useState<Backup | null>(null);
  const [monthlyEnabled, setMonthlyEnabled] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const canEdit = hasPermission("backups", "edit");

  const loadBackups = () => {
    setIsLoading(true);
    fetch(`${API_BASE}/organizations/${orgId}/backups`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setBackups(Array.isArray(data) ? data : []))
      .catch(() => setBackups([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!orgId) return;
    loadBackups();
  }, [orgId]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/backups`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      });
      if (res.ok) {
        loadBackups();
        showToast(t("backups.backupCreated"));
      } else {
        showToast("Failed to create backup", "error");
      }
    } catch {
      showToast("Failed to create backup", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (backup: Backup) => {
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/backups/${backup.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setBackupToDelete(null);
        loadBackups();
        showToast(t("backups.backupDeleted"));
      }
    } catch {}
  };

  const handleRestore = async (backup: Backup) => {
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/backups/${backup.id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setBackupToRestore(null);
        showToast(t("backups.backupRestored"));
      }
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="monthly"
              checked={monthlyEnabled}
              onCheckedChange={setMonthlyEnabled}
              disabled={!canEdit}
            />
            <Label htmlFor="monthly" className="text-sm cursor-pointer">
              {t("backups.enableMonthly")}
            </Label>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            onClick={handleCreate}
            disabled={isCreating}
          >
            <DatabaseBackup className="h-4 w-4" />
            {isCreating ? t("common.saving") : t("backups.takeBackup")}
          </Button>
        )}
      </div>

      {backups.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16 text-center">
          <div>
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <DatabaseBackup className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{t("backups.noBackups")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("backups.createFirst")}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t("backups.number")}</TableHead>
                <TableHead>{t("backups.takenOn")}</TableHead>
                <TableHead>{t("backups.type")}</TableHead>
                <TableHead>{t("backups.charts")}</TableHead>
                <TableHead>{t("backups.people")}</TableHead>
                <TableHead>{t("backups.customFields")}</TableHead>
                {canEdit && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup, idx) => (
                <TableRow key={backup.id} className="hover:bg-muted/50">
                  <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                  <TableCell className="text-sm">{formatDate(backup.createdAt)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={backup.type === "monthly" ? "default" : "secondary"}
                      className="capitalize text-xs"
                    >
                      {backup.type === "monthly" ? t("backups.monthly") : t("backups.manual")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      {backup.chartCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      {backup.employeeCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      {backup.fieldCount}
                    </div>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                          onClick={() => setBackupToRestore(backup)}
                          title={t("backups.restore")}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setBackupToDelete(backup)}
                          title={t("backups.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="p-3 border-t border-border text-xs text-muted-foreground">
        {backups.length} {t("backups.title").toLowerCase()}
      </div>

      <AlertDialog open={!!backupToDelete} onOpenChange={(o) => { if (!o) setBackupToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("backups.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => backupToDelete && handleDelete(backupToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirmDialog.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!backupToRestore} onOpenChange={(o) => { if (!o) setBackupToRestore(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backups.restore")}</AlertDialogTitle>
            <AlertDialogDescription>{t("backups.confirmRestore")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => backupToRestore && handleRestore(backupToRestore)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {t("backups.restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {toast && (
        <div className={`fixed bottom-6 end-6 px-4 py-2 rounded-lg text-sm shadow-lg z-50 border ${
          toast.type === "error"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-green-50 border-green-200 text-green-700"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
