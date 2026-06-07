import { useState, type Dispatch, type SetStateAction } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TFn } from "@/lib/org-chart/types";

interface SnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrgId: number | null | undefined;
  snapshotName: string;
  setSnapshotName: Dispatch<SetStateAction<string>>;
  snapshotDesc: string;
  setSnapshotDesc: Dispatch<SetStateAction<string>>;
  t: TFn;
}

export function SnapshotDialog({
  open,
  onOpenChange,
  selectedOrgId,
  snapshotName,
  setSnapshotName,
  snapshotDesc,
  setSnapshotDesc,
  t,
}: SnapshotDialogProps) {
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotSavedMessage, setSnapshotSavedMessage] = useState<string | null>(null);

  const handleClose = (o: boolean) => {
    if (isSavingSnapshot) return;
    onOpenChange(o);
    if (!o) {
      setSnapshotError(null);
      setSnapshotSavedMessage(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {t("snapshots.save")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="snapshot-name-org">{t("snapshots.name")}</Label>
            <Input
              id="snapshot-name-org"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="Q4 2025 Pre-reorg"
              data-testid="input-snapshot-name-org"
            />
          </div>
          <div>
            <Label htmlFor="snapshot-desc-org">{t("common.description")}</Label>
            <Textarea
              id="snapshot-desc-org"
              value={snapshotDesc}
              onChange={(e) => setSnapshotDesc(e.target.value)}
              rows={3}
              data-testid="input-snapshot-description-org"
            />
          </div>
          {snapshotError && <p className="text-sm text-destructive">{snapshotError}</p>}
          {snapshotSavedMessage && <p className="text-sm text-green-700">{snapshotSavedMessage}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSavingSnapshot}
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={isSavingSnapshot || !snapshotName.trim() || !selectedOrgId}
            data-testid="button-confirm-save-snapshot"
            onClick={async () => {
              if (!selectedOrgId || !snapshotName.trim()) return;
              setIsSavingSnapshot(true);
              setSnapshotError(null);
              setSnapshotSavedMessage(null);
              try {
                const base = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
                const r = await fetch(
                  `${base}/organizations/${selectedOrgId}/snapshots`,
                  {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: snapshotName.trim(),
                      description: snapshotDesc.trim() || null,
                    }),
                  },
                );
                if (!r.ok) {
                  const txt = await r.text();
                  throw new Error(txt || `HTTP ${r.status}`);
                }
                setSnapshotSavedMessage(t("common.saved"));
                setSnapshotName("");
                setSnapshotDesc("");
                setTimeout(() => {
                  onOpenChange(false);
                  setSnapshotSavedMessage(null);
                }, 800);
              } catch (e) {
                setSnapshotError((e as Error).message);
              } finally {
                setIsSavingSnapshot(false);
              }
            }}
          >
            {isSavingSnapshot ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
