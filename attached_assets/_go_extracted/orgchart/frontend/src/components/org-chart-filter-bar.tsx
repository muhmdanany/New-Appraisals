import { useMemo, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Landmark, Filter, X, Search, Globe, Briefcase, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { OrgChartFilter } from "@/hooks/use-org-chart-filter";
import { SavedFilterViews } from "@/components/saved-filter-views";

interface OptionItem<K extends string | number> {
  id: K;
  name: string;
  color?: string | null;
  prefix?: React.ReactNode;
}

interface MultiSelectProps<K extends string | number> {
  label: string;
  icon: React.ReactNode;
  options: OptionItem<K>[];
  selected: K[];
  onToggle: (id: K) => void;
  onClear: () => void;
  searchPlaceholder: string;
  emptyText: string;
  clearLabel: string;
  testIdBase: string;
}

const NumberMultiSelectFilter = MultiSelectFilter as (props: MultiSelectProps<number>) => ReactElement;
const StringMultiSelectFilter = MultiSelectFilter as (props: MultiSelectProps<string>) => ReactElement;

function MultiSelectFilter<K extends string | number>({
  label,
  icon,
  options,
  selected,
  onToggle,
  onClear,
  searchPlaceholder,
  emptyText,
  clearLabel,
  testIdBase,
}: MultiSelectProps<K>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const count = selected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          data-testid={`${testIdBase}-trigger`}
        >
          {icon}
          <span className="ms-1.5">{label}</span>
          {count > 0 && (
            <Badge
              variant="secondary"
              className="ms-2 h-5 min-w-5 px-1.5 rounded-full text-[10px]"
              data-testid={`${testIdBase}-count`}
            >
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        data-testid={`${testIdBase}-popover`}
      >
        <div className="px-2 py-2 border-b">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 ps-7 text-sm"
              data-testid={`${testIdBase}-search`}
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              {emptyText}
            </div>
          ) : (
            filtered.map((opt) => {
              const checked = selected.includes(opt.id);
              return (
                <label
                  key={String(opt.id)}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
                  data-testid={`${testIdBase}-option-${opt.id}`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(opt.id)}
                  />
                  {opt.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.prefix}
                  <span className="truncate flex-1">{opt.name}</span>
                </label>
              );
            })
          )}
        </div>
        {count > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={onClear}
              data-testid={`${testIdBase}-clear`}
            >
              <X className="h-3 w-3 me-1" />
              {clearLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface DepartmentOption {
  id: number;
  name: string;
  color?: string | null;
}

interface AdministrationOption {
  id: number;
  name: string;
  color?: string | null;
}

interface NationalityOption {
  code: string;
  name: string;
  flag: string;
}

interface TitleOption {
  title: string;
}

interface TagOption {
  id: number;
  name: string;
  color: string;
}

interface OrgChartFilterBarProps {
  departments: DepartmentOption[];
  administrations: AdministrationOption[];
  nationalities: NationalityOption[];
  titles: TitleOption[];
  tags: TagOption[];
  filter: OrgChartFilter;
  onToggleDepartment: (id: number) => void;
  onToggleAdministration: (id: number) => void;
  onToggleNationality: (code: string) => void;
  onToggleTitle: (title: string) => void;
  onToggleTag: (id: number) => void;
  onSetTagsMode: (mode: "any" | "all") => void;
  onClear: () => void;
  onApplyFilter?: (next: OrgChartFilter) => void;
  visibleCount: number;
  totalCount: number;
  orgId?: number | null;
  chartScope?: string | null;
}

export function OrgChartFilterBar({
  departments,
  administrations,
  nationalities,
  titles,
  tags,
  filter,
  onToggleDepartment,
  onToggleAdministration,
  onToggleNationality,
  onToggleTitle,
  onToggleTag,
  onSetTagsMode,
  onClear,
  onApplyFilter,
  visibleCount,
  totalCount,
  orgId,
  chartScope,
}: OrgChartFilterBarProps) {
  const { t } = useTranslation();
  const isActive =
    filter.departmentIds.length > 0 ||
    filter.administrationIds.length > 0 ||
    filter.nationalities.length > 0 ||
    filter.titles.length > 0 ||
    filter.tagIds.length > 0;
  const tagMap = useMemo(() => new Map(tags.map((tg) => [tg.id, tg])), [tags]);

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const adminMap = useMemo(() => new Map(administrations.map((a) => [a.id, a])), [administrations]);
  const natMap = useMemo(
    () => new Map(nationalities.map((n) => [n.code.toUpperCase(), n])),
    [nationalities],
  );

  const adminOptions: OptionItem<number>[] = useMemo(
    () => administrations.map((a) => ({ id: a.id, name: a.name, color: a.color })),
    [administrations],
  );
  const deptOptions: OptionItem<number>[] = useMemo(
    () => departments.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    [departments],
  );
  const nationalityOptions: OptionItem<string>[] = useMemo(
    () =>
      nationalities.map((n) => ({
        id: n.code.toUpperCase(),
        name: n.name,
        prefix: <span className="text-base leading-none">{n.flag}</span>,
      })),
    [nationalities],
  );
  const titleOptions: OptionItem<string>[] = useMemo(
    () => titles.map((t) => ({ id: t.title, name: t.title })),
    [titles],
  );
  const tagOptions: OptionItem<number>[] = useMemo(
    () => tags.map((tg) => ({ id: tg.id, name: tg.name, color: tg.color })),
    [tags],
  );

  const clearAdmins = () => {
    filter.administrationIds.forEach((id) => onToggleAdministration(id));
  };
  const clearDepts = () => {
    filter.departmentIds.forEach((id) => onToggleDepartment(id));
  };
  const clearNats = () => {
    filter.nationalities.forEach((code) => onToggleNationality(code));
  };
  const clearTitles = () => {
    filter.titles.forEach((title) => onToggleTitle(title));
  };
  const clearTags = () => {
    filter.tagIds.forEach((id) => onToggleTag(id));
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="org-chart-filter-bar">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span>{t("orgChart.filterBy")}</span>
      </div>

      <NumberMultiSelectFilter
        label={t("orgChart.filterAdministrations")}
        icon={<Landmark className="h-3.5 w-3.5" />}
        options={adminOptions}
        selected={filter.administrationIds}
        onToggle={onToggleAdministration}
        onClear={clearAdmins}
        searchPlaceholder={t("orgChart.filterSearchAdmin")}
        emptyText={t("orgChart.filterNoneFound")}
        clearLabel={t("orgChart.filterClearList")}
        testIdBase="filter-administration"
      />

      <NumberMultiSelectFilter
        label={t("orgChart.filterDepartments")}
        icon={<Building2 className="h-3.5 w-3.5" />}
        options={deptOptions}
        selected={filter.departmentIds}
        onToggle={onToggleDepartment}
        onClear={clearDepts}
        searchPlaceholder={t("orgChart.filterSearchDept")}
        emptyText={t("orgChart.filterNoneFound")}
        clearLabel={t("orgChart.filterClearList")}
        testIdBase="filter-department"
      />

      <StringMultiSelectFilter
        label={t("orgChart.filterNationalities")}
        icon={<Globe className="h-3.5 w-3.5" />}
        options={nationalityOptions}
        selected={filter.nationalities}
        onToggle={onToggleNationality}
        onClear={clearNats}
        searchPlaceholder={t("orgChart.filterSearchNationality")}
        emptyText={t("orgChart.filterNoneFound")}
        clearLabel={t("orgChart.filterClearList")}
        testIdBase="filter-nationality"
      />

      <StringMultiSelectFilter
        label={t("orgChart.filterTitles")}
        icon={<Briefcase className="h-3.5 w-3.5" />}
        options={titleOptions}
        selected={filter.titles}
        onToggle={onToggleTitle}
        onClear={clearTitles}
        searchPlaceholder={t("orgChart.filterSearchTitle")}
        emptyText={t("orgChart.filterNoneFound")}
        clearLabel={t("orgChart.filterClearList")}
        testIdBase="filter-title"
      />

      <NumberMultiSelectFilter
        label={t("orgChart.filterTags")}
        icon={<TagIcon className="h-3.5 w-3.5" />}
        options={tagOptions}
        selected={filter.tagIds}
        onToggle={onToggleTag}
        onClear={clearTags}
        searchPlaceholder={t("orgChart.filterSearchTag")}
        emptyText={t("orgChart.filterNoneFound")}
        clearLabel={t("orgChart.filterClearList")}
        testIdBase="filter-tag"
      />

      {filter.tagIds.length > 1 && (
        <div
          className="inline-flex items-center rounded-md border border-input bg-background h-8 text-xs"
          role="group"
          aria-label={t("orgChart.filterTagsModeLabel")}
          data-testid="filter-tags-mode"
        >
          <button
            type="button"
            onClick={() => onSetTagsMode("any")}
            className={`px-2.5 h-full rounded-s-md ${filter.tagsMode === "any" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="filter-tags-mode-any"
          >
            {t("orgChart.filterTagsModeAny")}
          </button>
          <button
            type="button"
            onClick={() => onSetTagsMode("all")}
            className={`px-2.5 h-full rounded-e-md ${filter.tagsMode === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="filter-tags-mode-all"
          >
            {t("orgChart.filterTagsModeAll")}
          </button>
        </div>
      )}

      {onApplyFilter && (
        <SavedFilterViews
          orgId={orgId ?? null}
          chartScope={chartScope ?? null}
          filter={filter}
          onApply={onApplyFilter}
        />
      )}

      {filter.administrationIds.map((id) => {
        const a = adminMap.get(id);
        if (!a) return null;
        return (
          <Badge
            key={`a-${id}`}
            variant="secondary"
            className="h-7 ps-2 pe-1 gap-1"
            style={{
              backgroundColor: a.color ? `${a.color}15` : undefined,
              color: a.color || undefined,
            }}
            data-testid={`filter-chip-administration-${id}`}
          >
            <Landmark className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{a.name}</span>
            <button
              type="button"
              onClick={() => onToggleAdministration(id)}
              className="hover:bg-black/10 rounded-sm p-0.5"
              aria-label={t("orgChart.filterRemoveChip", { name: a.name })}
              data-testid={`filter-chip-remove-administration-${id}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {filter.departmentIds.map((id) => {
        const d = deptMap.get(id);
        if (!d) return null;
        return (
          <Badge
            key={`d-${id}`}
            variant="secondary"
            className="h-7 ps-2 pe-1 gap-1"
            style={{
              backgroundColor: d.color ? `${d.color}15` : undefined,
              color: d.color || undefined,
            }}
            data-testid={`filter-chip-department-${id}`}
          >
            <Building2 className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{d.name}</span>
            <button
              type="button"
              onClick={() => onToggleDepartment(id)}
              className="hover:bg-black/10 rounded-sm p-0.5"
              aria-label={t("orgChart.filterRemoveChip", { name: d.name })}
              data-testid={`filter-chip-remove-department-${id}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {filter.nationalities.map((code) => {
        const n = natMap.get(code);
        const display = n ? `${n.flag} ${n.name}` : code;
        return (
          <Badge
            key={`n-${code}`}
            variant="secondary"
            className="h-7 ps-2 pe-1 gap-1"
            data-testid={`filter-chip-nationality-${code}`}
          >
            <Globe className="h-3 w-3" />
            <span className="truncate max-w-[140px]">{display}</span>
            <button
              type="button"
              onClick={() => onToggleNationality(code)}
              className="hover:bg-black/10 rounded-sm p-0.5"
              aria-label={t("orgChart.filterRemoveChip", { name: n?.name || code })}
              data-testid={`filter-chip-remove-nationality-${code}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {filter.tagIds.map((id) => {
        const tg = tagMap.get(id);
        if (!tg) return null;
        return (
          <Badge
            key={`tg-${id}`}
            variant="secondary"
            className="h-7 ps-2 pe-1 gap-1"
            style={{
              backgroundColor: `${tg.color}15`,
              color: tg.color,
            }}
            data-testid={`filter-chip-tag-${id}`}
          >
            <TagIcon className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{tg.name}</span>
            <button
              type="button"
              onClick={() => onToggleTag(id)}
              className="hover:bg-black/10 rounded-sm p-0.5"
              aria-label={t("orgChart.filterRemoveChip", { name: tg.name })}
              data-testid={`filter-chip-remove-tag-${id}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {filter.titles.map((title) => (
        <Badge
          key={`t-${title}`}
          variant="secondary"
          className="h-7 ps-2 pe-1 gap-1"
          data-testid={`filter-chip-title-${title}`}
        >
          <Briefcase className="h-3 w-3" />
          <span className="truncate max-w-[140px]">{title}</span>
          <button
            type="button"
            onClick={() => onToggleTitle(title)}
            className="hover:bg-black/10 rounded-sm p-0.5"
            aria-label={t("orgChart.filterRemoveChip", { name: title })}
            data-testid={`filter-chip-remove-title-${title}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onClear}
          data-testid="filter-clear-all"
        >
          <X className="h-3 w-3 me-1" />
          {t("orgChart.filterClearAll")}
        </Button>
      )}

      <div className="ms-auto text-xs text-muted-foreground" data-testid="filter-counter">
        {t("orgChart.filterShowingCounter", { visible: visibleCount, total: totalCount })}
      </div>
    </div>
  );
}
