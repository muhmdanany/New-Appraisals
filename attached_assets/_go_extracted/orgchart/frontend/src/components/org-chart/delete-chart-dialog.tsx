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
import type { TFn } from "@/lib/org-chart/types";

interface DeleteChartDialogProps {
  chartToDelete: { id: number; name: string } | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
  t: TFn;
}

export function DeleteChartDialog({ chartToDelete, onClose, onConfirm, t }: DeleteChartDialogProps) {
  return (
    <AlertDialog open={!!chartToDelete} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
          <AlertDialogDescription>{t("orgChart.deleteChartDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { if (chartToDelete) onConfirm(chartToDelete.id); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("confirmDialog.confirmDelete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
