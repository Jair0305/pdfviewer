"use client";

import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Annotation, AnnotationColor } from "@/types/anotaciones";

interface PdfMinimapProps {
  numPages: number;
  currentPage: number;
  annotations: Annotation[];
  relativeFilePath: string | null;
  mainScrollRef: React.RefObject<HTMLDivElement | null>;
  scrollToPage: (pageNum: number) => void;
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
  relativeFilePath,
  mainScrollRef,
  scrollToPage,
}: PdfMinimapProps) {
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [viewportHeightRatio, setViewportHeightRatio] = useState(0.1);

  useEffect(() => {
    const scrollEl = mainScrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      setScrollProgress(scrollTop / (scrollHeight - clientHeight || 1));
      setViewportHeightRatio(clientHeight / scrollHeight);
    };

    scrollEl.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial sync
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [mainScrollRef, numPages]);

  // Filter annotations for this file
  const fileAnnotations = relativeFilePath 
    ? annotations.filter(a => a.relativeFilePath === relativeFilePath)
    : [];

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = clickY / rect.height;
    
    if (mainScrollRef.current) {
      const { scrollHeight, clientHeight } = mainScrollRef.current;
      mainScrollRef.current.scrollTop = ratio * (scrollHeight - clientHeight);
    }
  };

  if (numPages <= 0) return null;

  return (
    <div 
      className="relative flex w-4 shrink-0 flex-col border-l border-border/40 bg-muted/5 select-none transition-all duration-300 hover:w-8 group/minimap"
      onClick={handleMinimapClick}
    >
      <div className="absolute inset-0 overflow-hidden py-4">
        {/* Viewport Indicator */}
        <div 
          className="absolute left-0 right-0 z-20 border-y border-primary/20 bg-primary/5 backdrop-blur-[1px] transition-all duration-75 pointer-events-none"
          style={{ 
            top: `${scrollProgress * (100 - viewportHeightRatio * 100)}%`, 
            height: `${viewportHeightRatio * 100}%` 
          }}
        />

        {/* Page segments and annotation markers */}
        {Array.from({ length: numPages }).map((_, i) => {
          const pageNum = i + 1;
          const pageAnnos = fileAnnotations.filter(a => a.pageNumber === pageNum);

          return (
            <div 
              key={pageNum}
              className={cn(
                "relative w-full border-b border-border/10 transition-colors",
                currentPage === pageNum ? "bg-primary/5" : "bg-transparent"
              )}
              style={{ height: `${100 / numPages}%` }}
              title={`Página ${pageNum}`}
            >
              {pageAnnos.map((anno) => {
                const topVal = anno.type === "highlight" 
                  ? (anno.rects?.[0]?.y ?? 0)
                  : (anno.path?.[0]?.y ?? 0);

                return (
                  <div 
                    key={anno.id}
                    className={cn(
                      "absolute left-0 right-0 h-[2px] opacity-80 shadow-[0_0_4px_currentColor]",
                      COLOR_MAP[anno.color]
                    )}
                    style={{ 
                      top: `${topVal * 100}%`,
                      color: `var(--${anno.color}-500)`
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Hover Page Number Label */}
      <div className="absolute inset-y-0 right-full hidden group-hover/minimap:flex flex-col justify-center pr-2 pointer-events-none">
        <div className="rounded bg-popover px-1.5 py-0.5 text-[9px] font-medium shadow-md border border-border animate-in fade-in slide-in-from-right-1">
          {numPages} págs
        </div>
      </div>
    </div>
  );
}
