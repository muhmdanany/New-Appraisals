import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FilterableNode {
  id: number;
  departmentId: number | null;
  administrationId: number | null;
  nationality?: string | null;
  title?: string | null;
  tags?: { id: number }[];
  children: FilterableNode[];
}

export type TagsMode = "any" | "all";

export interface OrgChartFilter {
  departmentIds: number[];
  administrationIds: number[];
  nationalities: string[];
  titles: string[];
  tagIds: number[];
  tagsMode: TagsMode;
}

const STORAGE_PREFIX = "orgchart_filter";

function emptyFilter(): OrgChartFilter {
  return {
    departmentIds: [],
    administrationIds: [],
    nationalities: [],
    titles: [],
    tagIds: [],
    tagsMode: "any",
  };
}

export function isFilterEmpty(f: OrgChartFilter): boolean {
  return (
    f.departmentIds.length === 0 &&
    f.administrationIds.length === 0 &&
    f.nationalities.length === 0 &&
    f.titles.length === 0 &&
    f.tagIds.length === 0
  );
}

function parseNumberList(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parseStringList(raw: string | null): string[] {
  if (!raw) return [];
  // URLSearchParams.get() already decodes once. We additionally decode
  // each token defensively (safely) to support older URLs that were
  // double-encoded by previous versions, and to tolerate malformed input.
  return raw
    .split(",")
    .map((s) => safeDecode(s).trim())
    .filter((s) => s.length > 0);
}

function readFromUrl(): OrgChartFilter {
  if (typeof window === "undefined") return emptyFilter();
  const params = new URLSearchParams(window.location.search);
  const tagsModeRaw = params.get("tagMode");
  const tagsMode: TagsMode = tagsModeRaw === "all" ? "all" : "any";
  return {
    departmentIds: parseNumberList(params.get("dept")),
    administrationIds: parseNumberList(params.get("admin")),
    nationalities: parseStringList(params.get("nat")).map((s) => s.toUpperCase()),
    titles: parseStringList(params.get("title")),
    tagIds: parseNumberList(params.get("tag")),
    tagsMode,
  };
}

function readFromStorage(key: string): OrgChartFilter | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      departmentIds: Array.isArray(parsed.departmentIds)
        ? parsed.departmentIds.filter((n: unknown) => typeof n === "number")
        : [],
      administrationIds: Array.isArray(parsed.administrationIds)
        ? parsed.administrationIds.filter((n: unknown) => typeof n === "number")
        : [],
      nationalities: Array.isArray(parsed.nationalities)
        ? parsed.nationalities.filter((s: unknown): s is string => typeof s === "string")
        : [],
      titles: Array.isArray(parsed.titles)
        ? parsed.titles.filter((s: unknown): s is string => typeof s === "string")
        : [],
      tagIds: Array.isArray(parsed.tagIds)
        ? parsed.tagIds.filter((n: unknown) => typeof n === "number")
        : [],
      tagsMode: parsed.tagsMode === "all" ? "all" : "any",
    };
  } catch {
    return null;
  }
}

export function useOrgChartFilter(scopeKey: string | null) {
  const storageKey = scopeKey ? `${STORAGE_PREFIX}_${scopeKey}` : null;
  const initializedRef = useRef(false);

  const [filter, setFilter] = useState<OrgChartFilter>(() => {
    const fromUrl = readFromUrl();
    if (!isFilterEmpty(fromUrl)) return fromUrl;
    return emptyFilter();
  });

  useEffect(() => {
    if (!storageKey) return;
    const fromUrl = readFromUrl();
    if (!isFilterEmpty(fromUrl)) {
      setFilter(fromUrl);
      initializedRef.current = true;
      return;
    }
    const stored = readFromStorage(storageKey);
    if (stored) {
      setFilter(stored);
    } else {
      setFilter(emptyFilter());
    }
    initializedRef.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initializedRef.current) return;
    const params = new URLSearchParams(window.location.search);

    const setOrDelete = (key: string, value: string) => {
      if (value.length > 0) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete("dept", filter.departmentIds.join(","));
    setOrDelete("admin", filter.administrationIds.join(","));
    // Nationalities are 2-letter codes — safe as-is.
    setOrDelete("nat", filter.nationalities.join(","));
    // Titles are free text and may contain commas. Encode each token so
    // commas inside a title don't get split on read; URLSearchParams will
    // additionally percent-encode reserved chars in the URL output. The
    // reader uses safeDecode to reverse this single layer.
    setOrDelete(
      "title",
      filter.titles.map((s) => encodeURIComponent(s)).join(","),
    );
    setOrDelete("tag", filter.tagIds.join(","));
    if (filter.tagIds.length > 0 && filter.tagsMode === "all") {
      params.set("tagMode", "all");
    } else {
      params.delete("tagMode");
    }

    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);

    if (storageKey) {
      try {
        if (isFilterEmpty(filter)) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(filter));
        }
      } catch {
        // storage unavailable
      }
    }
  }, [filter, storageKey]);

  const toggleDepartment = useCallback((id: number) => {
    setFilter((prev) => {
      const has = prev.departmentIds.includes(id);
      return {
        ...prev,
        departmentIds: has ? prev.departmentIds.filter((d) => d !== id) : [...prev.departmentIds, id],
      };
    });
  }, []);

  const toggleAdministration = useCallback((id: number) => {
    setFilter((prev) => {
      const has = prev.administrationIds.includes(id);
      return {
        ...prev,
        administrationIds: has ? prev.administrationIds.filter((a) => a !== id) : [...prev.administrationIds, id],
      };
    });
  }, []);

  const toggleNationality = useCallback((code: string) => {
    const normalized = code.toUpperCase();
    setFilter((prev) => {
      const has = prev.nationalities.includes(normalized);
      return {
        ...prev,
        nationalities: has
          ? prev.nationalities.filter((n) => n !== normalized)
          : [...prev.nationalities, normalized],
      };
    });
  }, []);

  const toggleTitle = useCallback((title: string) => {
    setFilter((prev) => {
      const has = prev.titles.includes(title);
      return {
        ...prev,
        titles: has ? prev.titles.filter((t) => t !== title) : [...prev.titles, title],
      };
    });
  }, []);

  const toggleTag = useCallback((id: number) => {
    setFilter((prev) => {
      const has = prev.tagIds.includes(id);
      return {
        ...prev,
        tagIds: has ? prev.tagIds.filter((t) => t !== id) : [...prev.tagIds, id],
      };
    });
  }, []);

  const setTagsMode = useCallback((mode: TagsMode) => {
    setFilter((prev) => ({ ...prev, tagsMode: mode }));
  }, []);

  const clear = useCallback(() => {
    setFilter(emptyFilter());
  }, []);

  const applyFilter = useCallback((next: OrgChartFilter) => {
    setFilter({
      departmentIds: [...(next.departmentIds ?? [])],
      administrationIds: [...(next.administrationIds ?? [])],
      nationalities: [...(next.nationalities ?? [])],
      titles: [...(next.titles ?? [])],
      tagIds: [...(next.tagIds ?? [])],
      tagsMode: next.tagsMode === "all" ? "all" : "any",
    });
  }, []);

  const isActive = !isFilterEmpty(filter);

  return {
    filter,
    toggleDepartment,
    toggleAdministration,
    toggleNationality,
    toggleTitle,
    toggleTag,
    setTagsMode,
    clear,
    applyFilter,
    isActive,
  };
}

function nodeMatches(node: FilterableNode, filter: OrgChartFilter): boolean {
  // AND between categories, OR within each category.
  // An empty category imposes no constraint.
  if (filter.departmentIds.length > 0) {
    if (node.departmentId == null || !filter.departmentIds.includes(node.departmentId)) {
      return false;
    }
  }
  if (filter.administrationIds.length > 0) {
    if (node.administrationId == null || !filter.administrationIds.includes(node.administrationId)) {
      return false;
    }
  }
  if (filter.nationalities.length > 0) {
    const code = node.nationality ? node.nationality.toUpperCase() : null;
    if (!code || !filter.nationalities.includes(code)) {
      return false;
    }
  }
  if (filter.titles.length > 0) {
    const title = (node.title || "").trim();
    if (!title || !filter.titles.includes(title)) {
      return false;
    }
  }
  if (filter.tagIds.length > 0) {
    const ids = new Set((node.tags ?? []).map((t) => t.id));
    if (filter.tagsMode === "all") {
      for (const id of filter.tagIds) {
        if (!ids.has(id)) return false;
      }
    } else {
      let any = false;
      for (const id of filter.tagIds) {
        if (ids.has(id)) {
          any = true;
          break;
        }
      }
      if (!any) return false;
    }
  }
  return true;
}

export function filterOrgTree<T extends FilterableNode>(tree: T[], filter: OrgChartFilter): T[] {
  if (isFilterEmpty(filter)) return tree;

  const visit = (node: T): T | null => {
    const filteredChildren = ((node.children as T[] | undefined) ?? [])
      .map((c) => visit(c))
      .filter((c): c is T => c !== null);
    const matches = nodeMatches(node, filter);
    if (matches || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  return tree.map((root) => visit(root)).filter((n): n is T => n !== null);
}

export function countNodes<T extends FilterableNode>(tree: T[]): number {
  let count = 0;
  const walk = (nodes: T[]) => {
    for (const n of nodes) {
      count++;
      if (n.children?.length) walk(n.children as T[]);
    }
  };
  walk(tree);
  return count;
}

export function useFilteredTree<T extends FilterableNode>(tree: T[] | undefined, filter: OrgChartFilter) {
  return useMemo(() => {
    const original = tree ?? [];
    const filtered = filterOrgTree(original, filter);
    return {
      tree: filtered,
      visibleCount: countNodes(filtered),
      totalCount: countNodes(original),
    };
  }, [tree, filter]);
}
