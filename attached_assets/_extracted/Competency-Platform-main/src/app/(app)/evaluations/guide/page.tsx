"use client";

import Link from "next/link";
import { Printer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideContent } from "@/components/evaluation/guide-content";

export default function EvaluationGuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-foreground">دليل معايير التقييم</h1>
          <p className="text-sm text-muted-foreground">المرجع المعتمد لاختيار درجات الجدارات ومؤشرات الأداء</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            طباعة / حفظ PDF
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluations">
              <ArrowRight className="size-4" />
              التقييمات
            </Link>
          </Button>
        </div>
      </div>
      <GuideContent />
    </div>
  );
}
