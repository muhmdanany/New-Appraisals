"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/trpc/react";
import { StageTimeline } from "./stage-timeline";

export function CareerPathView({ trigger, pathId }: { trigger: React.ReactNode; pathId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = api.careerPath.byId.useQuery({ id: pathId }, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "المسار الوظيفي"}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="py-8 text-center text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {[data.field, data.duration].filter(Boolean).join(" · ")}
            </div>
            {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
            <div className="max-h-[60vh] overflow-y-auto">
              <StageTimeline stages={data.stages} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
