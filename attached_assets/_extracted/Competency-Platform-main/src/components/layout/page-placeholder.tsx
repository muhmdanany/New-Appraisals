import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PagePlaceholder({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Construction className="size-7" />
        </div>
        <p className="text-sm font-medium text-foreground">هذه الصفحة قيد التطوير</p>
        <p className="text-xs text-muted-foreground">ستُبنى في {phase}</p>
      </Card>
    </div>
  );
}
