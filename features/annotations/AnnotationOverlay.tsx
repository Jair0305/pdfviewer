"use client";

import { useRef, useState } from "react";
import type { Annotation, AnnotationColor, NormalizedPoint, NormalizedRect } from "@/types/anotaciones";

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/**
 * Convert canonical (rotation=0) pixel coords to rotated overlay pixel coords.
 * cw/ch are the CANONICAL dimensions (intrinsicW*scale × intrinsicH*scale).
 */
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

/**
 * Convert rotated overlay pixel coords to canonical (rotation=0) pixel coords.
 */
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

/**
 * Convert display-space rect (overlay pixels, already rotated) to
 * canonical normalized [0,1] rect by un-rotating all 4 corners.
 * Exported for use in PdfViewer when recording text selections.
 */
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

/**
 * Convert a canonical normalized rect back to overlay SVG pixel AABB
 * by rotating all 4 corners and taking the bounding box.
 * Used inside AnnotationOverlay for rendering highlight rects.
 */
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

function buildPathD(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

// ─── Color map ────────────────────────────────────────────────────────────────

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

const MIN_DIST_SQ = 4; // 2px minimum distance between captured points

// ─── Component ────────────────────────────────────────────────────────────────

interface AnnotationOverlayProps {
  pageNumber:      number;
  scale:           number;
  rotation:        0 | 90 | 180 | 270;
  intrinsicWidth:  number;
  intrinsicHeight: number;
  /** "pen" = draw strokes; "erase" = click-to-delete; null = view-only */
  annotationMode:  "pen" | "erase" | null;
  activeColor:     AnnotationColor;
  annotations:     Annotation[]; // already filtered to this page
  /** Called with the finished stroke's normalized points AND the last raw overlay-pixel coords. */
  onCreated:           (path: NormalizedPoint[], endX: number, endY: number) => void;
  onAnnotationClick:   (id: string) => void;
  onAnnotationDelete:  (id: string) => void;
  /** ID of the annotation to flash (glow highlight for 2 s after navigation) */
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const rawStroke = useRef<{ x: number; y: number }[]>([]);
  const [livePathD, setLivePathD] = useState("");
  const [hoveredEraseId, setHoveredEraseId] = useState<string | null>(null);

  // Canonical dimensions at current scale
  const canonW = intrinsicWidth  * scale;
  const canonH = intrinsicHeight * scale;

  // Overlay dimensions (width/height swap when rotated 90/270)
  const overlayW = rotation === 90 || rotation === 270 ? canonH : canonW;
  const overlayH = rotation === 90 || rotation === 270 ? canonW : canonH;

  // strokeWidth scales proportionally with the page
  const strokeWidth = Math.max(2.5, 2.5 * scale);

  // Convert stored normalized points → overlay SVG pixel coords for rendering
  function normToOverlay(pts: NormalizedPoint[]): { x: number; y: number }[] {
    return pts.map((p) => {
      const [ox, oy] = toRotated(p.x * canonW, p.y * canonH, canonW, canonH, rotation);
      return { x: ox, y: oy };
    });
  }

  // ── Drawing (pen mode) ──────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (annotationMode !== "pen") return;
    e.preventDefault();
    e.stopPropagation();
    const pt = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    rawStroke.current = [pt];
    setLivePathD(`M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (annotationMode !== "pen" || !isDrawing) return;
    const pt = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    const stroke = rawStroke.current;
    if (stroke.length > 0) {
      const last = stroke[stroke.length - 1];
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      if (dx * dx + dy * dy >= MIN_DIST_SQ) {
        rawStroke.current = [...stroke, pt];
        setLivePathD(buildPathD(rawStroke.current));
      }
    }
  };

  const finalizeStroke = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const stroke = rawStroke.current;
    rawStroke.current = [];
    setLivePathD("");

    if (stroke.length < 2) return;

    const lastPt = stroke[stroke.length - 1];

    // Normalize: overlay pixels → canonical pixels → [0,1]
    const normalized: NormalizedPoint[] = stroke.map((pt) => {
      const [cx, cy] = toCanonical(pt.x, pt.y, canonW, canonH, rotation);
      return { x: cx / canonW, y: cy / canonH };
    });

    onCreated(normalized, lastPt.x, lastPt.y);
  };

  // SVG captures events only when in a mode (pen or erase)
  const svgPointerEvents = annotationMode !== null ? "all" : "none";
  const svgCursor =
    annotationMode === "pen"   ? "crosshair" :
    annotationMode === "erase" ? "default"   : "default";

  return (
    <svg
      ref={svgRef}
      style={{
        position:     "absolute",
        inset:        0,
        width:        overlayW,
        height:       overlayH,
        pointerEvents: svgPointerEvents,
        cursor:       svgCursor,
        zIndex:       10,
        overflow:     "visible",
        userSelect:   "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finalizeStroke}
      onMouseLeave={finalizeStroke}
    >
      {/* Highlight annotations (rendered under strokes) */}
      {annotations
        .filter((ann) => (ann.type ?? "stroke") === "highlight" && ann.rects?.length)
        .map((ann) =>
          ann.rects!.map((rect, i) => {
            const r         = toRotatedRect(rect, canonW, canonH, rotation);
            const isHovered = hoveredEraseId === ann.id;
            const isFlash   = flashingAnnotationId === ann.id;
            return (
              <rect
                key={`${ann.id}-h${i}`}
                x={r.x} y={r.y} width={r.w} height={r.h}
                fill={isHovered ? HIGHLIGHT_FILL_ERASE : HIGHLIGHT_FILL[ann.color]}
                style={{
                  pointerEvents: i === 0 ? "all" : "none",
                  cursor:
                    annotationMode === "erase" || annotationMode === null
                      ? "pointer"
                      : "none",
                  transition: "fill 0.1s",
                  animation: isFlash ? "annotFlash 2s ease-out forwards" : undefined,
                }}
                onMouseEnter={() => annotationMode === "erase" && setHoveredEraseId(ann.id)}
                onMouseLeave={() => setHoveredEraseId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (annotationMode === "erase") {
                    setHoveredEraseId(null);
                    onAnnotationDelete(ann.id);
                  } else if (annotationMode === null) {
                    onAnnotationClick(ann.id);
                  }
                }}
              />
            );
          }),
        )}

      {/* Saved annotations */}
      {annotations.map((ann) => {
        if (!ann.path || ann.path.length < 2) return null;
        const overlayPts = normToOverlay(ann.path);
        const d = buildPathD(overlayPts);

        const isHoveredErase = hoveredEraseId === ann.id;
        const isFlashing     = flashingAnnotationId === ann.id;
        const strokeColor =
          isHoveredErase ? "rgba(239,68,68,0.9)" : STROKE_COLOR[ann.color];

        return (
          <g key={ann.id}>
            {/* Glow flash layer — rendered only while this annotation is highlighted */}
            {isFlashing && (
              <path
                d={d}
                stroke={STROKE_COLOR[ann.color]}
                strokeWidth={strokeWidth * 4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  pointerEvents: "none",
                  filter: "blur(6px)",
                  animation: "annotFlash 2s ease-out forwards",
                }}
              />
            )}
            <path
              d={d}
              stroke={strokeColor}
              strokeWidth={isHoveredErase ? strokeWidth * 1.4 : strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                pointerEvents: "stroke",
                cursor:
                  annotationMode === "erase" ? "pointer" :
                  annotationMode === null    ? "pointer" : "none",
                transition: "stroke 0.1s, stroke-width 0.1s",
              }}
              onMouseEnter={() => annotationMode === "erase" && setHoveredEraseId(ann.id)}
              onMouseLeave={() => setHoveredEraseId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (annotationMode === "erase") {
                  setHoveredEraseId(null);
                  onAnnotationDelete(ann.id);
                } else if (annotationMode === null) {
                  onAnnotationClick(ann.id);
                }
              }}
            />
          </g>
        );
      })}

      {/* Live stroke while drawing */}
      {livePathD && (
        <path
          d={livePathD}
          stroke={STROKE_COLOR[activeColor]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
}
