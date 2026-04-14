"use client";

import { useMemo } from "react";
import { useExplorerStore } from "@/state/explorer.store";
import { useDocStatusStore } from "@/state/docStatus.store";
import { useRevisionStore } from "@/state/revision.store";
import type { FileNode } from "@/types/expediente";
import type { DocStatus } from "@/types/docStatus";
import { IconFolderOpen, IconFileTypePdf, IconFileTypeXml } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRel(filePath: string, expedientePath: string): string {
  const fwd    = filePath.replace(/\\/g, "/");
  const expFwd = expedientePath.replace(/\\/g, "/").replace(/\/$/, "");
  return fwd.startsWith(expFwd + "/") ? fwd.slice(expFwd.length) : "/" + (fwd.split("/").pop() ?? fwd);
}

function walk(
  node: FileNode,
  expedientePath: string,
  acc: { paths: string[]; pdf: number; xml: number; other: number },
): void {
  if (node.type === "folder") {
    for (const child of node.children ?? []) walk(child, expedientePath, acc);
  } else {
    acc.paths.push(computeRel(node.path, expedientePath));
    if (node.type === "pdf")      acc.pdf++;
    else if (node.type === "xml") acc.xml++;
    else                          acc.other++;
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: {
  key: DocStatus;
  label: string;
  dot: string;
  bar: string;
  text: string;
}[] = [
  { key: "sin_revisar",       label: "Sin revisar",       dot: "bg-muted-foreground/25", bar: "bg-muted-foreground/25", text: "text-muted-foreground/60" },
  { key: "en_revision",       label: "En revisión",       dot: "bg-amber-500",           bar: "bg-amber-500",           text: "text-amber-600"           },
  { key: "revisado",          label: "Revisado",           dot: "bg-green-500",           bar: "bg-green-500",           text: "text-green-600"           },
  { key: "con_observaciones", label: "Con observaciones", dot: "bg-red-500",             bar: "bg-red-500",             text: "text-red-600"             },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpedienteDashboard() {
  const root           = useExplorerStore((s) => s.root);
  const { statuses }   = useDocStatusStore();
  const meta           = useRevisionStore((s) => s.meta);

  const stats = useMemo(() => {
    if (!root) return null;
    const expedientePath = meta?.expedientePath ?? root.path;
    const acc = { paths: [] as string[], pdf: 0, xml: 0, other: 0 };
    walk(root, expedientePath, acc);
    const total = acc.paths.length;

    const counts: Record<DocStatus, number> = {
      sin_revisar: 0, en_revision: 0, revisado: 0, con_observaciones: 0,
    };
    for (const rel of acc.paths) {
      counts[statuses[rel] ?? "sin_revisar"]++;
    }

    const done     = counts.revisado + counts.con_observaciones;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, pdf: acc.pdf, xml: acc.xml, other: acc.other, counts, done, progress };
  }, [root, statuses, meta]);

  if (!root || !stats) return null;

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-[320px] space-y-5 animate-in fade-in zoom-in-95 duration-500">

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <IconFolderOpen size={24} strokeWidth={1.5} className="text-primary" />
          </div>
          <h2 className="text-sm font-bold tracking-tight text-foreground/90 truncate">{root.name}</h2>
          {meta?.expedienteId && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/50 truncate">{meta.expedienteId}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Progreso de revisión</span>
            <span className="text-[11px] font-bold tabular-nums text-foreground/80">{stats.progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/40">
            {stats.done} de {stats.total} archivo{stats.total !== 1 ? "s" : ""} revisado{stats.done !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Status breakdown */}
        <div className="space-y-2">
          {STATUS_CFG.map(({ key, label, dot, bar, text }) => {
            const count = stats.counts[key];
            const pct   = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
                <span className={cn("flex-1 text-[11px]", text)}>{label}</span>
                <span className="w-5 text-right text-[11px] tabular-nums font-medium text-foreground/60">{count}</span>
                <div className="w-14 h-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all duration-700", bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* File type row */}
        <div className="flex items-center gap-4 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <IconFileTypePdf size={13} className="text-red-400/70" />
            <span className="text-[11px] text-foreground/60 tabular-nums">{stats.pdf} PDF</span>
          </div>
          {stats.xml > 0 && (
            <div className="flex items-center gap-1.5">
              <IconFileTypeXml size={13} className="text-blue-400/70" />
              <span className="text-[11px] text-foreground/60 tabular-nums">{stats.xml} XML</span>
            </div>
          )}
          {stats.other > 0 && (
            <span className="text-[11px] text-muted-foreground/40 tabular-nums">{stats.other} otros</span>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/30">
          Selecciona un PDF del explorador para comenzar
        </p>
      </div>
    </div>
  );
}
