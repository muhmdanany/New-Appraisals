export function resolvePhotoUrl(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith("/objects/")) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${base}/api/storage${avatarUrl}`;
  }
  return avatarUrl;
}
