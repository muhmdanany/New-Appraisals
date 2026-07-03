import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useIdentity } from "@/lib/identity";
import { usePermission, type Resource, type Action } from "@/lib/permissions";

// Management actions are gated by the permissions engine.
// Legacy signature kept for backward compatibility: roles param is ignored now.
export function useCanManage(_roles?: string[]) {
  // "canManage" means at least edit-level access.
  // Since each page calls useCanManage without specifying a resource,
  // this hook is kept as a simple role-based fallback;
  // pages should migrate to usePermission(resource, action) directly.
  const { user } = useIdentity();
  if (!user) return false;
  // ADMIN and HR_MANAGER are org-wide managers by default.
  return ["ADMIN", "HR_MANAGER"].includes(user.role);
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  submitLabel = "حفظ",
  children,
  wide,
  canSubmit = true,
  footerExtra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
  children: ReactNode;
  wide?: boolean;
  canSubmit?: boolean;
  footerExtra?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          wide
            ? "max-w-3xl max-h-[90vh] overflow-y-auto"
            : "max-w-lg max-h-[90vh] overflow-y-auto"
        }
      >
        <DialogHeader className="text-right">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          {children}
          <DialogFooter className="gap-2 sm:gap-2">
            {footerExtra}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const NONE = "__none__";

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "اختر...",
  required,
  allowEmpty,
  emptyLabel = "بدون",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Select
        value={value === "" ? undefined : value}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? <SelectItem value={NONE}>{emptyLabel}</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function MultiSelectField({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const toggle = (id: string) => {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  };
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="max-h-44 overflow-y-auto rounded-md border border-border p-2 space-y-1">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">لا توجد عناصر</p>
        ) : (
          options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-1 py-1 rounded hover:bg-secondary cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              {o.label}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
