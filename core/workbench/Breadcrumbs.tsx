"use client";

import { IconChevronRight, IconFile, IconFolder } from "@tabler/icons-react";
import type { Tab } from "@/types/expediente";

interface BreadcrumbsProps {
  file: Tab | null;
  rootPath: string | null;
}

export function Breadcrumbs({ file, rootPath }: BreadcrumbsProps) {
  if (!file) return <div className="h-6 shrink-0 border-b" />;

  // Build path segments relative to root
  const normalized = file.path.replace(/\\/g, "/");
  const normalizedRoot = rootPath ? rootPath.replace(/\\/g, "/") : null;

  let segments: string[];
  if (normalizedRoot && normalized.startsWith(normalizedRoot)) {
    const relative = normalized.slice(normalizedRoot.length).replace(/^\//, "");
    segments = relative.split("/");
  } else {
    segments = normalized.split("/");
  }

  return (
    <div className="flex h-6 shrink-0 items-center gap-0.5 border-b bg-background px-3 text-[11px] text-muted-foreground overflow-hidden">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center gap-0.5 min-w-0">
            {i > 0 && <IconChevronRight size={10} className="shrink-0 opacity-40" />}
            {isLast
              ? <IconFile size={11} className="shrink-0 opacity-60" />
              : <IconFolder size={11} className="shrink-0 opacity-60" />
            }
            <span className={isLast ? "font-medium text-foreground truncate" : "truncate"}>
              {seg}
            </span>
          </span>
        );
      })}
    </div>
  );
}
