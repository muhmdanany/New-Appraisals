"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Dialog that collects a required free-text value before confirming an action. */
export function PromptDialog({
  trigger,
  title,
  placeholder,
  confirmLabel,
  confirmVariant = "default",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  placeholder?: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={4} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            إلغاء
          </Button>
          <Button
            variant={confirmVariant}
            disabled={busy || !text.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(text.trim());
                setOpen(false);
                setText("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
