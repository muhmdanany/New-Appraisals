"use client";

import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GuideContent } from "./guide-content";

/** "دليل المعايير" button that opens the evaluation criteria guide in a side drawer. */
export function GuideSheet({ trigger }: { trigger?: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <BookOpen className="size-4" />
            دليل المعايير
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left">
        <SheetTitle>دليل معايير التقييم</SheetTitle>
        <SheetDescription>راجع المعايير أثناء إدخال الدرجات دون مغادرة النموذج.</SheetDescription>
        <GuideContent />
      </SheetContent>
    </Sheet>
  );
}
