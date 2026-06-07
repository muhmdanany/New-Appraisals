import { useTranslation } from "react-i18next";
import { Check, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  maxAgeDays: number;
  preventReuseLast: number;
}

interface Rule {
  key: string;
  label: string;
  met: boolean;
  informational?: boolean;
}

function buildRules(
  policy: PasswordPolicy,
  password: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): Rule[] {
  const rules: Rule[] = [];
  const len = Array.from(password).length;
  rules.push({
    key: "minLength",
    label: t("passwordChecklist.minLength", { count: policy.minLength }),
    met: len >= policy.minLength,
  });
  if (policy.requireUpper) {
    rules.push({
      key: "upper",
      label: t("passwordChecklist.requireUpper"),
      met: /\p{Lu}/u.test(password),
    });
  }
  if (policy.requireLower) {
    rules.push({
      key: "lower",
      label: t("passwordChecklist.requireLower"),
      met: /\p{Ll}/u.test(password),
    });
  }
  if (policy.requireDigit) {
    rules.push({
      key: "digit",
      label: t("passwordChecklist.requireDigit"),
      met: /\p{Nd}/u.test(password),
    });
  }
  if (policy.requireSymbol) {
    rules.push({
      key: "symbol",
      label: t("passwordChecklist.requireSymbol"),
      met: /[^\p{L}\p{N}\s]/u.test(password),
    });
  }
  if (policy.preventReuseLast > 0) {
    rules.push({
      key: "reuse",
      label: t("passwordChecklist.preventReuse", { count: policy.preventReuseLast }),
      met: false,
      informational: true,
    });
  }
  return rules;
}

interface Props {
  policy: PasswordPolicy | null;
  password: string;
  className?: string;
}

export function PasswordPolicyChecklist({ policy, password, className }: Props) {
  const { t } = useTranslation();
  if (!policy) return null;
  const rules = buildRules(policy, password, t);
  const showLive = password.length > 0;
  return (
    <div
      className={cn("rounded border border-border bg-muted/40 p-3 space-y-1.5", className)}
      data-testid="password-policy-checklist"
    >
      <div className="text-xs font-medium text-foreground">
        {t("passwordChecklist.title")}
      </div>
      <ul className="space-y-1">
        {rules.map((r) => {
          const met = r.met;
          const Icon = r.informational ? Info : met ? Check : X;
          const color = r.informational
            ? "text-muted-foreground"
            : !showLive
              ? "text-muted-foreground"
              : met
                ? "text-green-600 dark:text-green-500"
                : "text-muted-foreground";
          return (
            <li
              key={r.key}
              className={cn("flex items-start gap-2 text-xs", color)}
              data-testid={`password-rule-${r.key}`}
              data-met={r.informational ? "info" : met ? "true" : "false"}
            >
              <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{r.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PasswordPolicyChecklist;
