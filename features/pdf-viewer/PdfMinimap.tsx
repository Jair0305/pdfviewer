"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Annotation, AnnotationColor } from "@/types/anotaciones";
import type { Bookmark } from "@/types/bookmarks";

interface PdfMinimapProps {
  numPages:         number;
  currentPage:      number;
  annotations:      Annotation[];
  bookmarks:        Bookmark[];
  relativeFilePath: string | null;
  mainScrollRef:    React.RefObject<HTMLDivElement | null>;
  scrollToPage:     (pageNum: number) => void;
}

const COLOR_MAP: Record<AnnotationColor, string> = {
  yellow: "bg-amber-400",
  green:  "bg-green-500",
  red:    "bg-red-500",
  blue:   "bg-blue-500",
};

export function PdfMinimap({
  numPages,
  currentPage,
  annotations,
  bookmarks,
  relativeFilePath,
  mainScrollRef,
  scrollToPage,
}: PdfMinimapProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Bucket annotations by page — O(annotations) once
  const annotsByPage = useMemo(() => {
    const map: Record<number, Annotation[]> = {};
    if (!relativeFilePath) return map;
    for (const ann of annotations) {
      if (ann.relativeFilePath === relativeFilePath && ann.pageNumber != null) {
        (map[ann.pageNumber] ??= []).push(ann);
      }
    }
    return map;
  }, [annotations, relativeFilePath]);

  // Set of bookmarked pages for this file — O(1) lookup
  const bookmarkedPages = useMemo(() => {
    const set = new Set<number>();
    if (!relativeFilePath) return set;
    for (const bm of bookmarks) {
      if (bm.relativeFilePath === relativeFilePath) set.add(bm.pageNumber);
    }
    return set;
  }, [bookmarks, relativeFilePath]);

  // Direct DOM update — no state, no re-render on every scroll event
  useEffect(() => {
    const scrollEl = mainScrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const indicator = indicatorRef.current;
      if (!indicator) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const progress = scrollTop / (scrollHeight - clientHeight || 1);
      const ratio    = clientHeight / scrollHeight;
      indicator.style.top    = `${progress * (100 - ratio * 100)}%`;
      indicator.style.height = `${ratio * 100}%`;
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [mainScrollRef, numPages]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const scrollEl = mainScrollRef.current;
    if (scrollEl) {
      scrollEl.scrollTop = ratio * (scrollEl.scrollHeight - scrollEl.clientHeight);
    }
  };

  if (numPages <= 0) return null;

  return (
    <div
      className="relative flex w-4 shrink-0 flex-col border-l border-border/40 bg-muted/5 select-none transition-all duration-300 hover:w-8 group/minimap shadow-[-2px_0_12px_rgba(0,0,0,0.02)] dark:shadow-none"
      onClick={handleMinimapClick}
    >
      <div className="absolute inset-0 overflow-hidden py-4">
        {/* Viewport indicator — positioned via direct DOM */}
        <div
          ref={indicatorRef}
          className="absolute left-0 right-0 z-20 border-y border-primary/20 bg-primary/5 backdrop-blur-[1px] pointer-events-none"
          style={{ top: "0%", height: "10%" }}
        />

        {Array.from({ length: numPages }).map((_, i) => {
          const pageNum    = i + 1;
          const pageAnns   = annotsByPage[pageNum] ?? [];
          const isBookmark = bookmarkedPages.has(pageNum);

          return (
            <div
              key={pageNum}
              className={cn(
                "relative w-full border-b border-border/10 transition-colors",
                currentPage === pageNum ? "bg-primary/5" : "bg-transparent",
              )}
              style={{ height: `${100 / numPages}%` }}
              title={`Página ${pageNum}${isBookmark ? " 🔖" : ""}`}
            >
              {/* Bookmark flag — amber left edge */}
              {isBookmark && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-amber-400/80 z-10" />
              )}

              {/* Annotation dots */}
              {pageAnns.map((ann) => {
                const topVal = ann.type === "highlight"
                  ? (ann.rects?.[0]?.y ?? 0)
                  : (ann.path?.[0]?.y ?? 0);
                return (
                  <div
                    key={ann.id}
                    className={cn(
                      "absolute left-0 right-0 h-[2px] opacity-80 shadow-[0_0_4px_currentColor]",
                      COLOR_MAP[ann.color],
                    )}
                    style={{ top: `${topVal * 100}%` }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Hover page count label */}
      <div className="absolute inset-y-0 right-full hidden group-hover/minimap:flex flex-col justify-center pr-2 pointer-events-none">
        <div className="rounded bg-popover px-1.5 py-0.5 text-[9px] font-medium shadow-md border border-border animate-in fade-in slide-in-from-right-1">
          {numPages} págs
        </div>
      </div>
    </div>
  );
}
