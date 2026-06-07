import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SHORTCUTS,
  SHORTCUT_CATEGORY_ORDER,
  ShortcutCategory,
  useKeyboardShortcuts,
} from "@/lib/keyboard-shortcuts";

const categoryLabelKey: Record<ShortcutCategory, string> = {
  navigation: "shortcuts.categories.navigation",
  editing: "shortcuts.categories.editing",
  chart: "shortcuts.categories.chart",
  export: "shortcuts.categories.export",
};

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md border border-border bg-muted text-foreground text-xs font-semibold shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog() {
  const { isOpen, close } = useKeyboardShortcuts();
  const { t } = useTranslation();

  const grouped = SHORTCUT_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: SHORTCUTS.filter((s) => s.category === cat),
  }));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent
        className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto"
        data-testid="dialog-keyboard-shortcuts"
      >
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("shortcuts.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {grouped.map(({ category, items }) => (
            <section key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t(categoryLabelKey[category])}
              </h3>
              <ul className="space-y-2">
                {items.map((shortcut) => (
                  <li
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4 py-1.5"
                    data-testid={`shortcut-${shortcut.id}`}
                  >
                    <span className="text-sm text-foreground">
                      {t(shortcut.descriptionKey)}
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {shortcut.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                          <Key>{k}</Key>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
