import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Check } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const PRESET_COLORS = [
  { name: "Purple", value: "#7c3aed" },
  { name: "Blue", value: "#2563eb" },
  { name: "Green", value: "#16a34a" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Teal", value: "#0d9488" },
  { name: "Pink", value: "#db2777" },
  { name: "Slate", value: "#475569" },
];

interface OrgTheme {
  primaryColor: string;
  cardStyle: string;
  showAvatars: boolean;
  showDepartmentColors: boolean;
}

export default function ThemesPage() {
  const { t } = useTranslation();
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const [theme, setTheme] = useState<OrgTheme>({
    primaryColor: "#7c3aed",
    cardStyle: "rounded",
    showAvatars: true,
    showDepartmentColors: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canEdit = hasPermission("themes", "edit");

  useEffect(() => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    fetch(`${API_BASE}/organizations/${selectedOrgId}/theme`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTheme({
            primaryColor: data.primaryColor || "#7c3aed",
            cardStyle: data.cardStyle || "rounded",
            showAvatars: data.showAvatars ?? true,
            showDepartmentColors: data.showDepartmentColors ?? true,
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedOrgId]);

  const handleSave = async () => {
    if (!selectedOrgId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/organizations/${selectedOrgId}/theme`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      if (res.ok) {
        setToast(t("themes.saved"));
        setTimeout(() => setToast(null), 3000);
      }
    } catch {}
    setIsSaving(false);
  };

  if (!selectedOrgId) {
    return (
      <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-xl">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              {t("themes.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("themes.subtitle")}</p>
          </div>
          {canEdit && (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? t("common.saving") : t("themes.save")}
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-2xl space-y-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">
                {t("themes.primaryColor")}
              </h2>
            </div>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => canEdit && setTheme((t) => ({ ...t, primaryColor: color.value }))}
                  disabled={!canEdit}
                  className="relative group flex flex-col items-center gap-1.5"
                  title={color.name}
                >
                  <div
                    className={`h-10 w-10 rounded-full border-2 transition-all shadow-sm ${
                      theme.primaryColor === color.value
                        ? "border-foreground scale-110 shadow-md"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                  >
                    {theme.primaryColor === color.value && (
                      <Check className="h-4 w-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground mb-5">
              {t("themes.cardStyle")}
            </h2>
            <Select
              value={theme.cardStyle}
              onValueChange={(v) => canEdit && setTheme((th) => ({ ...th, cardStyle: v }))}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rounded">{t("themes.rounded")}</SelectItem>
                <SelectItem value="square">{t("themes.square")}</SelectItem>
                <SelectItem value="flat">{t("themes.flat")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-foreground">Display Options</h2>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="showAvatars" className="text-sm font-medium">
                  {t("themes.showAvatars")}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Show profile picture initials on org chart cards
                </p>
              </div>
              <Switch
                id="showAvatars"
                checked={theme.showAvatars}
                onCheckedChange={(v) => canEdit && setTheme((th) => ({ ...th, showAvatars: v }))}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="showDeptColors" className="text-sm font-medium">
                  {t("themes.showDepartmentColors")}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Color-code org chart cards by department
                </p>
              </div>
              <Switch
                id="showDeptColors"
                checked={theme.showDepartmentColors}
                onCheckedChange={(v) => canEdit && setTheme((th) => ({ ...th, showDepartmentColors: v }))}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 end-6 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
