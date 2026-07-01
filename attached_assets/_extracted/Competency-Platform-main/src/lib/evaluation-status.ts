import type { BadgeProps } from "@/components/ui/badge";

export const EVALUATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "قيد الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  ACKNOWLEDGED: "تم الإقرار",
  OBJECTED: "اعتراض",
};

export const EVALUATION_STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  DRAFT: "muted",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  ACKNOWLEDGED: "success",
  OBJECTED: "purple",
};
