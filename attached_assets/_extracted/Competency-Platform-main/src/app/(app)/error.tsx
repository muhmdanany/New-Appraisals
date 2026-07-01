"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="text-lg font-bold text-foreground">حدث خطأ غير متوقع</h2>
      <p className="text-sm text-muted-foreground">نعتذر، تعذّر تحميل هذه الصفحة. يمكنك إعادة المحاولة.</p>
      <Button onClick={reset}>إعادة المحاولة</Button>
    </Card>
  );
}
