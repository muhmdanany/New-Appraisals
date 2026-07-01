import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee } from "@workspace/api-client-react";
import type { TFn } from "@/lib/org-chart/types";

interface BulkMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: number[];
  employees: Employee[];
  onConfirm: (newManagerId: number | null) => void;
  isSaving: boolean;
  t: TFn;
}

export function BulkMoveDialog({
  open,
  onOpenChange,
  selectedIds,
  employees,
  onConfirm,
  isSaving,
  t,
}: BulkMoveDialogProps) {
  const [query, setQuery] = useState("");
  const [chosenId, setChosenId] = useState<number | "root" | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setChosenId(null);
    }
  }, [open]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const eligible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((e) => !selectedSet.has(e.id))
      .filter((e) => {
        if (!q) return true;
        const hay = `${e.firstName} ${e.lastName} ${e.title} ${e.email}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [employees, selectedSet, query]);

  const handleConfirm = () => {
    if (chosenId === null) return;
    onConfirm(chosenId === "root" ? null : chosenId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="bulk-move-dialog">
        <DialogHeader>
          <DialogTitle>
            {t("orgChart.table.bulkMoveTitle", { count: selectedIds.length })}
          </DialogTitle>
          <DialogDescription>
            {t("orgChart.table.bulkMoveDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">
              {t("orgChart.table.bulkMoveSearch")}
            </Label>
            <div className="relative mt-1">
              <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("orgChart.table.bulkMoveSearchPlaceholder")}
                className="ps-8"
                data-testid="bulk-move-search"
              />
            </div>
          </div>

          <div className="border rounded-md max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => setChosenId("root")}
              className={`w-full text-start px-3 py-2 text-sm border-b hover:bg-muted ${
                chosenId === "root" ? "bg-primary/10" : ""
              }`}
              data-testid="bulk-move-option-root"
            >
              <span className="font-medium">{t("orgChart.table.bulkMoveRoot")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("orgChart.table.bulkMoveRootHint")}
              </span>
            </button>
            {eligible.length === 0 ? (
              <div className="px-3 py-6 text-sm text-center text-muted-foreground">
                {t("orgChart.table.bulkMoveNoMatches")}
              </div>
            ) : (
              eligible.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setChosenId(e.id)}
                  className={`w-full text-start px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted ${
                    chosenId === e.id ? "bg-primary/10" : ""
                  }`}
                  data-testid={`bulk-move-option-${e.id}`}
                >
                  <div className="font-medium">
                    {e.firstName} {e.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.title}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t("orgChart.table.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={chosenId === null || isSaving}
            data-testid="bulk-move-confirm"
          >
            {isSaving
              ? t("orgChart.table.moving")
              : t("orgChart.table.bulkMoveConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
