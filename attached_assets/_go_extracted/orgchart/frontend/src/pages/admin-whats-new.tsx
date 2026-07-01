import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListWhatsNewPosts,
  useAdminCreateWhatsNewPost,
  useAdminUpdateWhatsNewPost,
  useAdminDeleteWhatsNewPost,
  getAdminListWhatsNewPostsQueryKey,
  getListWhatsNewEntriesQueryKey,
  getGetWhatsNewUnreadCountQueryKey,
  type WhatsNewPost,
  type WhatsNewPostInput,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Markdown } from "@/components/markdown";
import { Plus, ShieldCheck, Save, Trash2, Sparkles } from "lucide-react";

type Draft = WhatsNewPostInput & { isNew?: boolean };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankDraft(): Draft {
  return {
    slug: `update-${Math.random().toString(36).slice(2, 7)}`,
    date: todayIso(),
    category: "new",
    image: null,
    tryLink: null,
    bodyEn: "# New update\n\nDescribe what changed in English.",
    bodyAr: "",
    status: "draft",
    isNew: true,
  };
}

function fromPost(post: WhatsNewPost): Draft {
  return {
    slug: post.slug,
    date: post.date,
    category: post.category,
    image: post.image ?? null,
    tryLink: post.tryLink ?? null,
    bodyEn: post.bodyEn,
    bodyAr: post.bodyAr,
    status: post.status,
  };
}

function categoryClass(category: string): string {
  switch (category) {
    case "new":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "improvement":
      return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
    case "fix":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "security":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function AdminWhatsNewPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: posts, isLoading } = useAdminListWhatsNewPosts({
    query: {
      enabled: !!user?.isSystemAdmin,
      queryKey: getAdminListWhatsNewPostsQueryKey(),
    },
  });

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Sync the editor with the active post whenever the selection or the
  // server-side list changes.
  useEffect(() => {
    if (!posts) return;
    if (activeSlug == null) {
      if (posts.length > 0) {
        setActiveSlug(posts[0].slug);
        setDraft(fromPost(posts[0]));
      }
      return;
    }
    if (draft?.isNew) return;
    const found = posts.find((p) => p.slug === activeSlug);
    if (found) {
      setDraft(fromPost(found));
    }
  }, [posts, activeSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getAdminListWhatsNewPostsQueryKey() });
    qc.invalidateQueries({ queryKey: getListWhatsNewEntriesQueryKey({ lang: "en" }) });
    qc.invalidateQueries({ queryKey: getListWhatsNewEntriesQueryKey({ lang: "ar" }) });
    qc.invalidateQueries({ queryKey: getGetWhatsNewUnreadCountQueryKey() });
  };

  const createMutation = useAdminCreateWhatsNewPost({
    mutation: {
      onSuccess: (created) => {
        invalidateAll();
        setActiveSlug(created.slug);
        setDraft(fromPost(created));
        toast({
          title: t("adminWhatsNew.savedTitle"),
          description: t("adminWhatsNew.savedDescription"),
        });
      },
      onError: (err) =>
        toast({
          title: t("adminWhatsNew.saveErrorTitle"),
          description: (err as Error)?.message || String(err),
          variant: "destructive",
        }),
    },
  });

  const updateMutation = useAdminUpdateWhatsNewPost({
    mutation: {
      onSuccess: (updated) => {
        invalidateAll();
        setDraft(fromPost(updated));
        toast({
          title: t("adminWhatsNew.savedTitle"),
          description: t("adminWhatsNew.savedDescription"),
        });
      },
      onError: (err) =>
        toast({
          title: t("adminWhatsNew.saveErrorTitle"),
          description: (err as Error)?.message || String(err),
          variant: "destructive",
        }),
    },
  });

  const deleteMutation = useAdminDeleteWhatsNewPost({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        const remaining = (posts ?? []).filter((p) => p.slug !== activeSlug);
        setActiveSlug(remaining[0]?.slug ?? null);
        setDraft(remaining[0] ? fromPost(remaining[0]) : null);
        toast({
          title: t("adminWhatsNew.deletedTitle"),
          description: t("adminWhatsNew.deletedDescription"),
        });
      },
      onError: (err) =>
        toast({
          title: t("adminWhatsNew.deleteErrorTitle"),
          description: (err as Error)?.message || String(err),
          variant: "destructive",
        }),
    },
  });

  const sortedPosts = useMemo(
    () => [...(posts ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [posts],
  );

  if (!user?.isSystemAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {t("adminWhatsNew.notAuthorized")}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">{t("common.loading")}</div>;
  }

  const handleNew = () => {
    const fresh = blankDraft();
    setActiveSlug(fresh.slug);
    setDraft(fresh);
  };

  const handleSelect = (post: WhatsNewPost) => {
    setActiveSlug(post.slug);
    setDraft(fromPost(post));
  };

  const handleSave = (overrideStatus?: "draft" | "published") => {
    if (!draft) return;
    const payload: WhatsNewPostInput = {
      slug: draft.slug.trim(),
      date: draft.date,
      category: draft.category || "new",
      image: draft.image && draft.image.trim() !== "" ? draft.image : null,
      tryLink: draft.tryLink && draft.tryLink.trim() !== "" ? draft.tryLink : null,
      bodyEn: draft.bodyEn,
      bodyAr: draft.bodyAr,
      status: (overrideStatus ?? draft.status) as WhatsNewPostInput["status"],
    };
    if (draft.isNew) {
      createMutation.mutate({ data: payload });
    } else {
      updateMutation.mutate({ slug: draft.slug, data: payload });
    }
  };

  const handleDelete = () => {
    if (!draft || draft.isNew) {
      // Local-only draft, just drop it.
      const first = sortedPosts[0];
      setActiveSlug(first?.slug ?? null);
      setDraft(first ? fromPost(first) : null);
      return;
    }
    deleteMutation.mutate({ slug: draft.slug });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const categories = ["new", "improvement", "fix", "security"];

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="admin-whats-new-page">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {t("adminWhatsNew.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("adminWhatsNew.subtitle")}
          </p>
        </div>
        <Button onClick={handleNew} data-testid="button-new-post">
          <Plus className="h-4 w-4 me-2" />
          {t("adminWhatsNew.newPost")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="space-y-1">
          {sortedPosts.length === 0 && !draft?.isNew && (
            <div className="text-sm text-muted-foreground px-1 py-4">
              {t("adminWhatsNew.empty")}
            </div>
          )}
          {sortedPosts.map((post) => (
            <button
              key={post.slug}
              type="button"
              onClick={() => handleSelect(post)}
              className={`w-full text-start rounded-md border px-3 py-2 text-sm hover:border-primary/50 transition-colors ${
                post.slug === activeSlug && !draft?.isNew
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
              data-testid={`post-list-${post.slug}`}
            >
              <div className="font-medium truncate">{post.slug}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  className={`${categoryClass(post.category)} border-transparent text-[10px] py-0 px-1.5`}
                >
                  {t(`whatsNew.category.${post.category}`, { defaultValue: post.category })}
                </Badge>
                <span>{post.date}</span>
                <span>·</span>
                <span>
                  {post.status === "published"
                    ? t("adminWhatsNew.statusPublished")
                    : t("adminWhatsNew.statusDraft")}
                </span>
              </div>
            </button>
          ))}
          {draft?.isNew && (
            <div
              className="w-full rounded-md border border-dashed border-primary/60 bg-primary/5 px-3 py-2 text-sm"
              data-testid="post-list-draft"
            >
              <div className="font-medium truncate">{draft.slug}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("adminWhatsNew.unsavedDraft")}
              </div>
            </div>
          )}
        </aside>

        {draft ? (
          <section className="space-y-6" data-testid="post-editor">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-semibold">{t("adminWhatsNew.metadata")}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSave("draft")}
                    disabled={isSaving}
                    data-testid="button-save-draft"
                  >
                    <Save className="h-4 w-4 me-2" />
                    {t("adminWhatsNew.saveDraft")}
                  </Button>
                  <Button
                    onClick={() => handleSave("published")}
                    disabled={isSaving}
                    data-testid="button-publish"
                  >
                    <Sparkles className="h-4 w-4 me-2" />
                    {t("adminWhatsNew.publish")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-delete-post">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("adminWhatsNew.deleteConfirmTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("adminWhatsNew.deleteConfirmBody", { slug: draft.slug })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          data-testid="button-delete-confirm"
                        >
                          {t("adminWhatsNew.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("adminWhatsNew.slug")}>
                  <Input
                    value={draft.slug}
                    disabled={!draft.isNew}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, slug: e.target.value } : d))
                    }
                    data-testid="input-post-slug"
                  />
                </Field>
                <Field label={t("adminWhatsNew.date")}>
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, date: e.target.value } : d))
                    }
                    data-testid="input-post-date"
                  />
                </Field>
                <Field label={t("adminWhatsNew.category")}>
                  <Select
                    value={draft.category}
                    onValueChange={(value) =>
                      setDraft((d) => (d ? { ...d, category: value } : d))
                    }
                  >
                    <SelectTrigger data-testid="select-post-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {t(`whatsNew.category.${cat}`, { defaultValue: cat })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("adminWhatsNew.status")}>
                  <Select
                    value={draft.status}
                    onValueChange={(value) =>
                      setDraft((d) =>
                        d ? { ...d, status: value as WhatsNewPostInput["status"] } : d,
                      )
                    }
                  >
                    <SelectTrigger data-testid="select-post-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("adminWhatsNew.statusDraft")}</SelectItem>
                      <SelectItem value="published">
                        {t("adminWhatsNew.statusPublished")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("adminWhatsNew.image")}>
                  <Input
                    placeholder="https://..."
                    value={draft.image ?? ""}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, image: e.target.value === "" ? null : e.target.value } : d,
                      )
                    }
                    data-testid="input-post-image"
                  />
                </Field>
                <Field label={t("adminWhatsNew.tryLink")}>
                  <Input
                    placeholder="/snapshots"
                    value={draft.tryLink ?? ""}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? { ...d, tryLink: e.target.value === "" ? null : e.target.value }
                          : d,
                      )
                    }
                    data-testid="input-post-trylink"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h2 className="font-semibold">{t("adminWhatsNew.content")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("adminWhatsNew.contentHint")}
              </p>
              <Tabs defaultValue="en" className="w-full">
                <TabsList>
                  <TabsTrigger value="en" data-testid="tab-edit-en">
                    {t("adminWhatsNew.bodyEn")}
                  </TabsTrigger>
                  <TabsTrigger value="ar" data-testid="tab-edit-ar">
                    {t("adminWhatsNew.bodyAr")}
                  </TabsTrigger>
                  <TabsTrigger value="preview-en" data-testid="tab-preview-en">
                    {t("adminWhatsNew.previewEn")}
                  </TabsTrigger>
                  <TabsTrigger value="preview-ar" data-testid="tab-preview-ar">
                    {t("adminWhatsNew.previewAr")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="en">
                  <Textarea
                    value={draft.bodyEn}
                    rows={14}
                    className="font-mono text-sm"
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, bodyEn: e.target.value } : d))
                    }
                    data-testid="textarea-body-en"
                  />
                </TabsContent>
                <TabsContent value="ar">
                  <Textarea
                    value={draft.bodyAr}
                    rows={14}
                    dir="rtl"
                    className="font-mono text-sm"
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, bodyAr: e.target.value } : d))
                    }
                    data-testid="textarea-body-ar"
                  />
                </TabsContent>
                <TabsContent value="preview-en">
                  <PreviewCard draft={draft} lang="en" t={t} />
                </TabsContent>
                <TabsContent value="preview-ar">
                  <PreviewCard draft={draft} lang="ar" t={t} />
                </TabsContent>
              </Tabs>
            </div>
          </section>
        ) : (
          <div className="text-sm text-muted-foreground p-6">
            {t("adminWhatsNew.selectPost")}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PreviewCard({
  draft,
  lang,
  t,
}: {
  draft: Draft;
  lang: "en" | "ar";
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const body = lang === "ar" ? draft.bodyAr || draft.bodyEn : draft.bodyEn || draft.bodyAr;
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      data-testid={`preview-${lang}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge className={`${categoryClass(draft.category)} border-transparent`}>
          {t(`whatsNew.category.${draft.category}`, { defaultValue: draft.category })}
        </Badge>
        <span className="text-xs text-muted-foreground">{draft.date}</span>
        {draft.status === "draft" && (
          <Badge variant="outline" className="text-[10px]">
            {t("adminWhatsNew.statusDraft")}
          </Badge>
        )}
      </div>
      {draft.image && (
        <img
          src={draft.image}
          alt=""
          className="mb-4 w-full rounded-md border border-border"
        />
      )}
      {body.trim() === "" ? (
        <div className="text-sm text-muted-foreground">{t("adminWhatsNew.previewEmpty")}</div>
      ) : (
        <Markdown source={body} />
      )}
    </div>
  );
}
