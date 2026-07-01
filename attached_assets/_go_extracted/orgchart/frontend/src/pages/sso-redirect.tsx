import { useEffect } from "react";
import { useParams } from "wouter";

export default function SSORedirect() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  useEffect(() => {
    if (!slug) return;
    const next = new URL(window.location.href).searchParams.get("next") ?? "";
    const qs = next ? `?next=${encodeURIComponent(next)}` : "";
    window.location.replace(
      `${import.meta.env.BASE_URL}api/sso/login/${encodeURIComponent(slug)}${qs}`,
    );
  }, [slug]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Redirecting to your identity provider…
    </div>
  );
}
