import type { Dispatch, SetStateAction } from "react";
import { Download, FileImage, FileText, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
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
import type { ExportOptions, TFn } from "@/lib/org-chart/types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportOptions: ExportOptions;
  setExportOptions: Dispatch<SetStateAction<ExportOptions>>;
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;
  exportError: string | null;
  onRunExport: () => void;
  t: TFn;
}

export function ExportDialog({
  open,
  onOpenChange,
  exportOptions,
  setExportOptions,
  isExporting,
  exportProgress,
  exportStatus,
  exportError,
  onRunExport,
  t,
}: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isExporting) onOpenChange(o); }}>
      <DialogContent className="max-w-md" data-testid="export-dialog">
        <DialogHeader>
          <DialogTitle>{t("orgChart.exportDialogTitle")}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t("orgChart.exportDialogDesc")}</p>
        </DialogHeader>
        <div className="space-y-4 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("orgChart.exportFormat")}
            </Label>
            <RadioGroup
              value={exportOptions.format}
              onValueChange={(v) => setExportOptions((o) => ({ ...o, format: v as "png" | "jpeg" | "pdf" | "svg" }))}
              className="grid grid-cols-2 gap-2 mt-2"
            >
              <label className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer ${exportOptions.format === "png" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="png" data-testid="export-format-png" />
                <FileImage className="h-4 w-4" />
                <span className="text-sm">{t("orgChart.exportFormatPNG")}</span>
              </label>
              <label className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer ${exportOptions.format === "jpeg" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="jpeg" data-testid="export-format-jpeg" />
                <FileImage className="h-4 w-4" />
                <span className="text-sm">{t("orgChart.exportFormatJPEG")}</span>
              </label>
              <label className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer ${exportOptions.format === "pdf" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="pdf" data-testid="export-format-pdf" />
                <FileText className="h-4 w-4" />
                <span className="text-sm">{t("orgChart.exportFormatPDF")}</span>
              </label>
              <label className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer ${exportOptions.format === "svg" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="svg" data-testid="export-format-svg" />
                <FileCode2 className="h-4 w-4" />
                <span className="text-sm">{t("orgChart.exportFormatSVG")}</span>
              </label>
            </RadioGroup>
          </div>

          {exportOptions.format !== "svg" && (
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("orgChart.exportResolution")}
              </Label>
              <Select
                value={String(exportOptions.pixelRatio)}
                onValueChange={(v) => setExportOptions((o) => ({ ...o, pixelRatio: Number(v) as 1 | 2 | 3 }))}
              >
                <SelectTrigger className="mt-2 h-9" data-testid="export-resolution"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("orgChart.exportResolutionStandard")}</SelectItem>
                  <SelectItem value="2">{t("orgChart.exportResolutionRetina")}</SelectItem>
                  <SelectItem value="3">{t("orgChart.exportResolutionUltra")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {exportOptions.format === "png" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="export-transparent"
                checked={exportOptions.transparent}
                onCheckedChange={(v) => setExportOptions((o) => ({ ...o, transparent: !!v }))}
                data-testid="export-transparent"
              />
              <Label htmlFor="export-transparent" className="text-sm cursor-pointer">
                {t("orgChart.exportTransparent")}
              </Label>
            </div>
          )}

          {exportOptions.format === "pdf" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("orgChart.exportPageSize")}
                  </Label>
                  <Select
                    value={exportOptions.pageSize}
                    onValueChange={(v) => setExportOptions((o) => ({ ...o, pageSize: v as "A4" | "Letter" | "A3" }))}
                  >
                    <SelectTrigger className="mt-2 h-9" data-testid="export-page-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                      <SelectItem value="A3">A3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("orgChart.exportOrientation")}
                  </Label>
                  <Select
                    value={exportOptions.orientation}
                    onValueChange={(v) => setExportOptions((o) => ({ ...o, orientation: v as "portrait" | "landscape" }))}
                  >
                    <SelectTrigger className="mt-2 h-9" data-testid="export-orientation"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">{t("orgChart.exportOrientationPortrait")}</SelectItem>
                      <SelectItem value="landscape">{t("orgChart.exportOrientationLandscape")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("orgChart.exportFit")}
                  </Label>
                  <Select
                    value={exportOptions.fitMode}
                    onValueChange={(v) => setExportOptions((o) => ({ ...o, fitMode: v as "fit" | "multi" }))}
                  >
                    <SelectTrigger className="mt-2 h-9" data-testid="export-fit-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">{t("orgChart.exportFitToPage")}</SelectItem>
                      <SelectItem value="multi">{t("orgChart.exportMultiPage")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("orgChart.exportMargin")}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={exportOptions.margin}
                    onChange={(e) => setExportOptions((o) => ({ ...o, margin: Math.max(0, Math.min(50, Number(e.target.value) || 0)) }))}
                    className="mt-2 h-9"
                    data-testid="export-margin"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="export-header"
              checked={exportOptions.includeHeader}
              onCheckedChange={(v) => setExportOptions((o) => ({ ...o, includeHeader: !!v }))}
              data-testid="export-include-header"
            />
            <Label htmlFor="export-header" className="text-sm cursor-pointer">
              {t("orgChart.exportIncludeHeader")}
            </Label>
          </div>

          {isExporting && (
            <div className="space-y-2" data-testid="export-progress">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{exportStatus}</span>
                <span>{t("orgChart.exportProgress", { percent: exportProgress })}</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}

          {exportError && (
            <p className="text-sm text-destructive" data-testid="export-error">{exportError}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            data-testid="export-cancel"
          >
            {t("orgChart.exportCancel")}
          </Button>
          <Button
            onClick={onRunExport}
            disabled={isExporting}
            data-testid="export-confirm"
          >
            <Download className="h-4 w-4 me-1" />
            {isExporting ? t("orgChart.exporting") : t("orgChart.exportStart")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
