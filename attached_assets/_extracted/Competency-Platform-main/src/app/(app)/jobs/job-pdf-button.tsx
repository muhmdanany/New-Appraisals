"use client";

import Link from "next/link";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the job profile preview (same tab); the preview page has a download button. */
export function JobPdfButton({ jobId }: { jobId: string }) {
  return (
    <Button variant="ghost" size="icon" className="size-8" title="بطاقة الوصف الوظيفي (PDF)" aria-label="بطاقة الوصف الوظيفي" asChild>
      <Link href={`/jobs/${jobId}/profile`}>
        <FileDown className="size-4" />
      </Link>
    </Button>
  );
}
