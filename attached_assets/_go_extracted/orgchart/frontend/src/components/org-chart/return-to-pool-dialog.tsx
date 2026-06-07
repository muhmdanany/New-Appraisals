import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { OrgChartNode, TFn } from "@/lib/org-chart/types";

export type ReturnStrategy = "reassign" | "promote" | "returnAll";

interface ReturnToPoolDialogProps {
  returnDialog: { node: OrgChartNode; childCount: number } | null;
  isApplyingReturn: boolean;
  onClose: () => void;
  onApply: (id: number, strategy: ReturnStrategy) => void;
  t: TFn;
}

export function ReturnToPoolDialog({
  returnDialog,
  isApplyingReturn,
  onClose,
  onApply,
  t,
}: ReturnToPoolDialogProps) {
  return (
    <AlertDialog
      open={!!returnDialog}
      onOpenChange={(open) => { if (!open && !isApplyingReturn) onClose(); }}
    >
      <AlertDialogContent data-testid="return-to-pool-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("orgChart.returnSubsTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {returnDialog
              ? t("orgChart.returnSubsDesc", {
                  name: `${returnDialog.node.firstName} ${returnDialog.node.lastName}`.trim(),
                  count: returnDialog.childCount,
                })
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="outline"
            className="justify-start h-auto py-3 text-start"
            disabled={isApplyingReturn}
            onClick={() => returnDialog && onApply(returnDialog.node.id, "reassign")}
            data-testid="return-strategy-reassign"
          >
            <div>
              <p className="font-medium text-sm">
                {returnDialog?.node.managerId
                  ? t("orgChart.returnSubsReassign")
                  : t("orgChart.returnSubsReassignRoot")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {returnDialog?.node.managerId
                  ? t("orgChart.returnSubsReassignHint")
                  : t("orgChart.returnSubsReassignRootHint")}
              </p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3 text-start"
            disabled={isApplyingReturn}
            onClick={() => returnDialog && onApply(returnDialog.node.id, "promote")}
            data-testid="return-strategy-promote"
          >
            <div>
              <p className="font-medium text-sm">{t("orgChart.returnSubsPromote")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("orgChart.returnSubsPromoteHint")}
              </p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3 text-start"
            disabled={isApplyingReturn}
            onClick={() => returnDialog && onApply(returnDialog.node.id, "returnAll")}
            data-testid="return-strategy-return-all"
          >
            <div>
              <p className="font-medium text-sm">{t("orgChart.returnSubsReturnAll")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("orgChart.returnSubsReturnAllHint")}
              </p>
            </div>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isApplyingReturn}>{t("confirmDialog.cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
