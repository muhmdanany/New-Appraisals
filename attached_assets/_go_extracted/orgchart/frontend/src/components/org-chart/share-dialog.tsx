import type { Dispatch, SetStateAction } from "react";
import { Share2, Copy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TFn } from "@/lib/org-chart/types";

interface ShareForm {
  password: string;
  expiresAt: string;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareForm: ShareForm;
  setShareForm: Dispatch<SetStateAction<ShareForm>>;
  createdShareUrl: string;
  shareError: string;
  onCreate: () => void;
  isCreating: boolean;
  canCreate: boolean;
  t: TFn;
}

export function ShareDialog({
  open,
  onOpenChange,
  shareForm,
  setShareForm,
  createdShareUrl,
  shareError,
  onCreate,
  isCreating,
  canCreate,
  t,
}: ShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-share-link">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t("orgChart.share.title")}
          </DialogTitle>
        </DialogHeader>
        {!createdShareUrl ? (
          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">{t("orgChart.share.subtitle")}</p>
            <div>
              <Label htmlFor="share-expires">{t("orgChart.share.expiresAt")}</Label>
              <Input
                id="share-expires"
                type="date"
                value={shareForm.expiresAt}
                onChange={(e) => setShareForm((f) => ({ ...f, expiresAt: e.target.value }))}
                data-testid="input-share-expires"
              />
              {!shareForm.expiresAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("orgChart.share.noExpiryHint")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="share-password" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {t("orgChart.share.password")}
              </Label>
              <Input
                id="share-password"
                type="password"
                value={shareForm.password}
                onChange={(e) => setShareForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={t("orgChart.share.passwordPlaceholder")}
                data-testid="input-share-password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("orgChart.share.passwordHint")}
              </p>
            </div>
            {shareError && (
              <p className="text-xs text-destructive" data-testid="text-share-error">
                {shareError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={onCreate}
                disabled={isCreating || !canCreate}
                data-testid="button-share-create"
              >
                {isCreating ? t("common.saving") : t("orgChart.share.create")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <p className="text-sm">{t("orgChart.share.created")}</p>
            <div className="flex items-center gap-2">
              <Input
                value={createdShareUrl}
                readOnly
                className="font-mono text-xs"
                data-testid="input-share-url"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => { void navigator.clipboard.writeText(createdShareUrl); }}
                data-testid="button-share-copy"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("orgChart.share.manageHint")}</p>
            <div className="flex justify-end pt-2">
              <Button onClick={() => onOpenChange(false)} data-testid="button-share-done">
                {t("common.done")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
