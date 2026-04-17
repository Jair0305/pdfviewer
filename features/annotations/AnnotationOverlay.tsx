"use client";

import { useRef, useState } from "react";
import type { Annotation, AnnotationColor, NormalizedPoint, NormalizedRect } from "@/types/anotaciones";

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function toRotated(
  x: number, y: number,
  cw: number, ch: number,
  rotation: 0 | 90 | 180 | 270,
): [number, number] {
  switch (rotation) {
    case 0:   return [x,      y];
    case 90:  return [ch - y, x];
    case 180: return [cw - x, ch - y];
    case 270: return [y,      cw - x];
  }
}

function toCanonical(
  x: number, y: number,
  cw: number, ch: number,
  rotation: 0 | 90 | 180 | 270,
): [number, number] {
  switch (rotation) {
    case 0:   return [x,      y];
    case 90:  return [y,      ch - x];
    case 180: return [cw - x, ch - y];
    case 270: return [cw - y, x];
  }
}

export function toCanonicalRect(
  dispX: number, dispY: number, dispW: number, dispH: number,
  canonW: number, canonH: number,
  rotation: 0 | 90 | 180 | 270,
): NormalizedRect {
  const corners: [number, number][] = [
    toCanonical(dispX,         dispY,         canonW, canonH, rotation),
    toCanonical(dispX + dispW, dispY,         canonW, canonH, rotation),
    toCanonical(dispX + dispW, dispY + dispH, canonW, canonH, rotation),
    toCanonical(dispX,         dispY + dispH, canonW, canonH, rotation),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return {
    x: Math.min(...xs) / canonW,
    y: Math.min(...ys) / canonH,
    w: (Math.max(...xs) - Math.min(...xs)) / canonW,
    h: (Math.max(...ys) - Math.min(...ys)) / canonH,
  };
}

export function toRotatedRect(
  rect: NormalizedRect,
  canonW: number, canonH: number,
  rotation: 0 | 90 | 180 | 270,
): { x: number; y: number; w: number; h: number } {
  const cx = rect.x * canonW, cy = rect.y * canonH;
  const cw = rect.w * canonW, ch = rect.h * canonH;
  const corners: [number, number][] = [
    toRotated(cx,      cy,      canonW, canonH, rotation),
    toRotated(cx + cw, cy,      canonW, canonH, rotation),
    toRotated(cx + cw, cy + ch, canonW, canonH, rotation),
    toRotated(cx,      cy + ch, canonW, canonH, rotation),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

/**
 * Build a smooth SVG path using quadratic bezier midpoint technique.
 * Each interior point becomes a bezier control point; midpoints are the endpoints.
 * Results in C0-smooth curves that match the drawn gesture visually.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const c = points[i];
    const n = points[i + 1];
    const mx = ((c.x + n.x) / 2).toFixed(1);
    const my = ((c.y + n.y) / 2).toFixed(1);
    d += ` Q ${c.x.toFixed(1)},${c.y.toFixed(1)} ${mx},${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)},${last.y.toFixed(1)}`;
  return d;
}

// ─── Color maps ───────────────────────────────────────────────────────────────

const STROKE_COLOR: Record<AnnotationColor, string> = {
  yellow: "rgba(245,158,11,0.85)",
  green:  "rgba(34,197,94,0.85)",
  red:    "rgba(239,68,68,0.85)",
  blue:   "rgba(59,130,246,0.85)",
};

const HIGHLIGHT_FILL: Record<AnnotationColor, string> = {
  yellow: "rgba(245,158,11,0.28)",
  green:  "rgba(34,197,94,0.28)",
  red:    "rgba(239,68,68,0.28)",
  blue:   "rgba(59,130,246,0.28)",
};

const HIGHLIGHT_FILL_ERASE = "rgba(239,68,68,0.45)";

// 1px² minimum distance between sampled points
const MIN_DIST_SQ = 1;

// ─── Component ────────────────────────────────────────────────────────────────

interface AnnotationOverlayProps {
  pageNumber:      number;
  scale:           number;
  rotation:        0 | 90 | 180 | 270;
  intrinsicWidth:  number;
  intrinsicHeight: number;
  annotationMode:  "pen" | "erase" | null;
  activeColor:     AnnotationColor;
  annotations:     Annotation[];
  onCreated:           (path: NormalizedPoint[], endX: number, endY: number) => void;
  onAnnotationClick:   (id: string) => void;
  onAnnotationDelete:  (id: string) => void;
  flashingAnnotationId?: string | null;
}

export function AnnotationOverlay({
  scale,
  rotation,
  intrinsicWidth,
  intrinsicHeight,
  annotationMode,
  activeColor,
  annotations,
  onCreated,
  onAnnotationClick,
  onAnnotationDelete,
  flashingAnnotationId,
}: AnnotationOverlayProps) {
  const [hoveredEraseId, setHoveredEraseId] = useState<string | null>(null);

  // Drawing state — all refs so event handlers never read stale closures
  const isDrawingRef     = useRef(false);
  const rawStroke        = useRef<{ x: number; y: number }[]>([]);
  // Committed bezier path string — appended O(1) per point (never rebuilt in full)
  const committedPath    = useRef("");
  // Latest full path string — written from pointer events, read from RAF callback
  const pendingD         = useRef("");
  const rafHandle        = useRef<number | null>(null);
  // Direct SVG DOM ref — bypass React entirely during drawing (zero re-renders)
  const livePathRef      = useRef<SVGPathElement>(null);

  const canonW = intrinsicWidth  * scale;
  const canonH = intrinsicHeight * scale;
  const overlayW = rotation === 90 || rotation === 270 ? canonH : canonW;
  const overlayH = rotation === 90 || rotation === 270 ? canonW : canonH;
  const strokeWidth = Math.max(2.5, 2.5 * scale);

  function normToOverlay(pts: NormalizedPoint[]): { x: number; y: number }[] {
    return pts.map((p) => {
      const [ox, oy] = toRotated(p.x * canonW, p.y * canonH, canonW, canonH, rotation);
      return { x: ox, y: oy };
    });
  }

  // ── Pointer-based drawing ─────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (annotationMode !== "pen") return;
    e.preventDefault();
    e.stopPropagation();
    // Capture pointer so events keep flowing even if cursor leaves the SVG
    e.currentTarget.setPointerCapture(e.pointerId);

    const pt = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    rawStroke.current      = [pt];
    committedPath.current  = `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    pendingD.current       = committedPath.current;
    isDrawingRef.current   = true;
    livePathRef.current?.setAttribute("d", committedPath.current);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    // getCoalescedEvents() provides all intermediate positions between frames —
    // critical for fast mouse movement that would otherwise produce straight lines.
    const events: { offsetX: number; offsetY: number }[] =
      (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];

    const stroke = rawStroke.current;

    for (const ev of events) {
      const pt = { x: ev.offsetX, y: ev.offsetY };
      const last = stroke[stroke.length - 1];
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      if (dx * dx + dy * dy < MIN_DIST_SQ) continue;

      stroke.push(pt);

      // Incremental bezier: append one Q segment per new point — O(1), never rebuilds full path
      if (stroke.length >= 3) {
        const prev = stroke[stroke.length - 2];
        const curr = stroke[stroke.length - 1];
        const mx = ((prev.x + curr.x) / 2).toFixed(1);
        const my = ((prev.y + curr.y) / 2).toFixed(1);
        committedPath.current += ` Q ${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${mx},${my}`;
      }
    }

    // Tentative tail: straight line from committed path to the latest point
    const tail = stroke[stroke.length - 1];
    pendingD.current = `${committedPath.current} L ${tail.x.toFixed(1)},${tail.y.toFixed(1)}`;

    // RAF-throttle direct DOM mutation — zero React reconciliation overhead
    if (!rafHandle.current) {
      rafHandle.current = requestAnimationFrame(() => {
        livePathRef.current?.setAttribute("d", pendingD.current);
        rafHandle.current = null;
      });
    }
  };

  const finalizeStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Cancel pending RAF — flush final state synchronously
    if (rafHandle.current !== null) {
      cancelAnimationFrame(rafHandle.current);
      rafHandle.current = null;
    }

    // Clear live path immediately — no React state involved
    livePathRef.current?.setAttribute("d", "");

    const stroke = rawStroke.current;
    rawStroke.current     = [];
    committedPath.current = "";
    pendingD.current      = "";

    if (stroke.length < 2) return;

    const lastPt = stroke[stroke.length - 1];
    const normalized: NormalizedPoint[] = stroke.map((pt) => {
      const [cx, cy] = toCanonical(pt.x, pt.y, canonW, canonH, rotation);
      return { x: cx / canonW, y: cy / canonH };
    });

    onCreated(normalized, lastPt.x, lastPt.y);
  };

  const svgPointerEvents = annotationMode !== null ? "all" : "none";
  const svgCursor =
    annotationMode === "pen"   ? "crosshair" :
    annotationMode === "erase" ? "default"   : "default";

  return (
    <svg
      style={{
        position:      "absolute",
        inset:         0,
        width:         overlayW,
        height:        overlayH,
        pointerEvents: svgPointerEvents,
        cursor:        svgCursor,
        zIndex:        10,
        overflow:      "visible",
        userSelect:    "none",
        touchAction:   "none",
        willChange:    "transform",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finalizeStroke}
      onPointerLeave={finalizeStroke}
      onPointerCancel={finalizeStroke}
    >
      {/* Highlight annotations (under strokes) */}
      {annotations
        .filter((ann) => (ann.type ?? "stroke") === "highlight" && ann.rects?.length)
        .map((ann) =>
          ann.rects!.map((rect, i) => {
            const r       = toRotatedRect(rect, canonW, canonH, rotation);
            const hovered = hoveredEraseId === ann.id;
            const flash   = flashingAnnotationId === ann.id;
            return (
              <rect
                key={`${ann.id}-h${i}`}
                x={r.x} y={r.y} width={r.w} height={r.h}
                fill={hovered ? HIGHLIGHT_FILL_ERASE : HIGHLIGHT_FILL[ann.color]}
                style={{
                  pointerEvents: i === 0 ? "all" : "none",
                  cursor: annotationMode === "erase" || annotationMode === null ? "pointer" : "none",
                  transition: "fill 0.1s",
                  animation: flash ? "annotFlash 2s ease-out forwards" : undefined,
                }}
                onMouseEnter={() => annotationMode === "erase" && setHoveredEraseId(ann.id)}
                onMouseLeave={() => setHoveredEraseId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (annotationMode === "erase") { setHoveredEraseId(null); onAnnotationDelete(ann.id); }
                  else if (annotationMode === null) onAnnotationClick(ann.id);
                }}
              />
            );
          }),
        )}

      {/* Saved stroke annotations */}
      {annotations.map((ann) => {
        if (!ann.path || ann.path.length < 2) return null;
        const d            = buildSmoothPath(normToOverlay(ann.path));
        const hovered      = hoveredEraseId === ann.id;
        const flashing     = flashingAnnotationId === ann.id;
        const strokeColor  = hovered ? "rgba(239,68,68,0.9)" : STROKE_COLOR[ann.color];

        return (
          <g key={ann.id}>
            {flashing && (
              <path
                d={d}
                stroke={STROKE_COLOR[ann.color]}
                strokeWidth={strokeWidth * 4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: "none", filter: "blur(6px)", animation: "annotFlash 2s ease-out forwards" }}
              />
            )}
            <path
              d={d}
              stroke={strokeColor}
              strokeWidth={hovered ? strokeWidth * 1.4 : strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                pointerEvents: "stroke",
                cursor: annotationMode === "erase" ? "pointer" : annotationMode === null ? "pointer" : "none",
                transition: "stroke 0.1s, stroke-width 0.1s",
              }}
              onMouseEnter={() => annotationMode === "erase" && setHoveredEraseId(ann.id)}
              onMouseLeave={() => setHoveredEraseId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (annotationMode === "erase") { setHoveredEraseId(null); onAnnotationDelete(ann.id); }
                else if (annotationMode === null) onAnnotationClick(ann.id);
              }}
            />
          </g>
        );
      })}

      {/* Live stroke — always in DOM, d attribute mutated directly via ref (no React re-renders) */}
      <path
        ref={livePathRef}
        d=""
        stroke={STROKE_COLOR[activeColor]}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}
