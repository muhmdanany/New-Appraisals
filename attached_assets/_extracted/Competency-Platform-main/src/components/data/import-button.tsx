"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseSpreadsheet, type SheetRow } from "@/lib/xlsx";

/** Reusable "import from Excel" button. Parses the file in-browser and hands the
 *  rows to `onRows`; the raw file never leaves the device. */
export function ImportButton({
  onRows,
  disabled,
}: {
  onRows: (rows: SheetRow[]) => Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const rows = await parseSpreadsheet(file);
            if (!rows.length) {
              toast.error("الملف فارغ أو غير صالح.");
              return;
            }
            await onRows(rows);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "فشل استيراد الملف.");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <Button variant="outline" size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        استيراد
      </Button>
    </>
  );
}
