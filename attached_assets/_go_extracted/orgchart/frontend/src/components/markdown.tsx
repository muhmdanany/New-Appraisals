import { ReactNode } from "react";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    if (!/^https?:\/\//.test(src) && !src.startsWith("/")) return _;
    return `<img alt="${alt}" src="${src}" class="my-3 max-w-full rounded-md border" />`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const safe = href.replace(/"/g, "");
    return `<a href="${safe}" class="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return out;
}

interface Block {
  type: "heading" | "paragraph" | "list";
  level?: number;
  text?: string;
  items?: string[];
}

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: buf.join(" ") });
  }
  return blocks;
}

export function Markdown({ source }: { source: string }): ReactNode {
  const blocks = parseMarkdown(source);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {blocks.map((b, idx) => {
        if (b.type === "heading") {
          const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-sm"];
          const size = sizes[(b.level ?? 1) - 1] ?? "text-base";
          const Tag = `h${b.level ?? 1}` as "h1";
          return (
            <Tag
              key={idx}
              className={`${size} font-semibold text-foreground`}
              dangerouslySetInnerHTML={{ __html: renderInline(b.text ?? "") }}
            />
          );
        }
        if (b.type === "list") {
          return (
            <ul key={idx} className="list-disc space-y-1 ps-5 marker:text-muted-foreground">
              {(b.items ?? []).map((item, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
              ))}
            </ul>
          );
        }
        return (
          <p
            key={idx}
            className="text-foreground/90"
            dangerouslySetInnerHTML={{ __html: renderInline(b.text ?? "") }}
          />
        );
      })}
    </div>
  );
}
