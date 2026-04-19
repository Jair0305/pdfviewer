"use client";

import { useRef, useState, useEffect } from "react";
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

// Smooth SVG path for saved annotations (static — not used during live drawing)
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const c = points[i], n = points[i + 1];
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

  // ── Drawing refs — zero re-renders during stroke ──────────────────────────
  const isDrawingRef       = useRef(false);
  const rawStroke          = useRef<{ x: number; y: number }[]>([]);
  const rafHandle          = useRef<number | null>(null);

  // Two GPU canvas layers for live drawing:
  //   committedCanvas — accumulates bezier segments immediately in pointer handler (no RAF wait)
  //   liveCanvas      — only the tail segment, cleared + redrawn O(1) per RAF
  const committedCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef      = useRef<HTMLCanvasElement>(null);

  // Last committed bezier midpoint — start of the live tail
  const committedMid = useRef<{ x: number; y: number } | null>(null);
  // Pending tail endpoints written by pointer events, consumed by RAF
  const pendingTail  = useRef<{ fx: number; fy: number; tx: number; ty: number } | null>(null);

  const canonW    = intrinsicWidth  * scale;
  const canonH    = intrinsicHeight * scale;
  const overlayW  = rotation === 90 || rotation === 270 ? canonH : canonW;
  const overlayH  = rotation === 90 || rotation === 270 ? canonW : canonH;
  const strokeWidth = Math.max(2.5, 2.5 * scale);

  // Resize canvases via effect — avoids React clearing bitmap on JSX attribute update
  useEffect(() => {
    if (committedCanvasRef.current) {
      committedCanvasRef.current.width  = overlayW;
      committedCanvasRef.current.height = overlayH;
    }
    if (liveCanvasRef.current) {
      liveCanvasRef.current.width  = overlayW;
      liveCanvasRef.current.height = overlayH;
    }
  }, [overlayW, overlayH]);

  function normToOverlay(pts: NormalizedPoint[]): { x: number; y: number }[] {
    return pts.map((p) => {
      const [ox, oy] = toRotated(p.x * canonW, p.y * canonH, canonW, canonH, rotation);
      return { x: ox, y: oy };
    });
  }

  function applyStyle(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = STROKE_COLOR[activeColor];
    ctx.lineWidth   = strokeWidth;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
  }

  // ── Pointer-based drawing ─────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (annotationMode !== "pen") return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pt = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    rawStroke.current    = [pt];
    committedMid.current = null;
    pendingTail.current  = null;
    isDrawingRef.current = true;

    // Clear both canvas layers for new stroke
    committedCanvasRef.current?.getContext("2d")?.clearRect(0, 0, overlayW, overlayH);
    liveCanvasRef.current?.getContext("2d")?.clearRect(0, 0, overlayW, overlayH);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    const events: { offsetX: number; offsetY: number }[] =
      (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];

    const stroke = rawStroke.current;
    const cc     = committedCanvasRef.current;

    for (const ev of events) {
      const pt = { x: ev.offsetX, y: ev.offsetY };
      const last = stroke[stroke.length - 1];
      const dx = pt.x - last.x, dy = pt.y - last.y;
      if (dx * dx + dy * dy < MIN_DIST_SQ) continue;

      stroke.push(pt);
      const n = stroke.length;

      if (n >= 3 && cc) {
        // Commit one bezier segment directly to GPU bitmap — no RAF wait
        const p_prev = stroke[n - 2];
        const p_curr = stroke[n - 1];
        const newMid = { x: (p_prev.x + p_curr.x) / 2, y: (p_prev.y + p_curr.y) / 2 };

        const ctx = cc.getContext("2d")!;
        applyStyle(ctx);
        ctx.beginPath();
        if (committedMid.current) {
          ctx.moveTo(committedMid.current.x, committedMid.current.y);
        } else {
          ctx.moveTo((stroke[0].x + stroke[1].x) / 2, (stroke[0].y + stroke[1].y) / 2);
        }
        ctx.quadraticCurveTo(p_prev.x, p_prev.y, newMid.x, newMid.y);
        ctx.stroke();

        committedMid.current = newMid;
      }
    }

    // Update tail: from last committed midpoint (or stroke start) to current cursor
    const tailFrom = committedMid.current ?? stroke[0];
    const latest   = stroke[stroke.length - 1];
    pendingTail.current = { fx: tailFrom.x, fy: tailFrom.y, tx: latest.x, ty: latest.y };

    // RAF: only the tail needs redraw — O(1) per frame regardless of stroke length
    if (!rafHandle.current) {
      rafHandle.current = requestAnimationFrame(() => {
        const tail = pendingTail.current;
        const lc   = liveCanvasRef.current;
        if (tail && lc) {
          const ctx = lc.getContext("2d")!;
          ctx.clearRect(0, 0, overlayW, overlayH);
          applyStyle(ctx);
          ctx.beginPath();
          ctx.moveTo(tail.fx, tail.fy);
          ctx.lineTo(tail.tx, tail.ty);
          ctx.stroke();
        }
        rafHandle.current = null;
      });
    }
  };

  const finalizeStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (rafHandle.current !== null) {
      cancelAnimationFrame(rafHandle.current);
      rafHandle.current = null;
    }

    // Clear both layers — committed SVG annotation appears instantly after onCreated
    committedCanvasRef.current?.getContext("2d")?.clearRect(0, 0, overlayW, overlayH);
    liveCanvasRef.current?.getContext("2d")?.clearRect(0, 0, overlayW, overlayH);
    committedMid.current = null;
    pendingTail.current  = null;

    const stroke = rawStroke.current;
    rawStroke.current = [];
    if (stroke.length < 2) return;

    const lastPt     = stroke[stroke.length - 1];
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

  const canvasStyle: React.CSSProperties = {
    position:      "absolute",
    inset:         0,
    pointerEvents: "none",
  };

  return (
    <>
      {/* SVG: event capture + saved annotations (never touched during live drawing) */}
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
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finalizeStroke}
        onPointerLeave={finalizeStroke}
        onPointerCancel={finalizeStroke}
      >
        {/* Highlight annotations */}
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
          const d           = buildSmoothPath(normToOverlay(ann.path));
          const hovered     = hoveredEraseId === ann.id;
          const flashing    = flashingAnnotationId === ann.id;
          const strokeColor = hovered ? "rgba(239,68,68,0.9)" : STROKE_COLOR[ann.color];

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
      </svg>

      {/* Canvas layer 1: committed beziers — GPU bitmap, incremental, never cleared mid-stroke */}
      <canvas ref={committedCanvasRef} style={{ ...canvasStyle, zIndex: 11 }} />

      {/* Canvas layer 2: tail only — clearRect + lineTo per RAF, O(1) always */}
      <canvas ref={liveCanvasRef} style={{ ...canvasStyle, zIndex: 12 }} />
    </>
  );
}
