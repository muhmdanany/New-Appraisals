import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      <span className="text-sm">جارٍ التحميل…</span>
    </div>
  );
}
