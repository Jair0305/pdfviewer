"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  IconZoomIn,
  IconZoomOut,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconFileAlert,
  IconMaximize,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FileNode } from "@/types/expediente";
import { useIsElectron } from "@/hooks/useIsElectron";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  file: FileNode | null;
}

export function PdfViewer({ file }: PdfViewerProps) {
  const inElectron = useIsElectron();
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);

  // Blob URL for the current PDF (avoids custom-protocol URL canonicalization issues on Windows)
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // Load PDF via IPC → Blob URL (Electron) or direct path (browser)
  useEffect(() => {
    // Revoke previous blob URL to free memory
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setPdfSrc(null);
    setNumPages(0);
    setCurrentPage(1);
    setScale(1.0);

    if (!file || file.type !== "pdf") return;

    // Browser mode: use path directly (works with /public assets)
    if (!inElectron) {
      setPdfSrc(file.path);
      return;
    }

    // Electron mode: read via IPC → base64 → Blob URL
    // This sidesteps all Chromium URL canonicalization issues with Windows paths.
    let cancelled = false;
    setLoading(true);

    window.api
      .readFile(file.path)
      .then((base64) => {
        if (cancelled) return;

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPdfSrc(url);
      })
      .catch(() => {
        if (!cancelled) setPdfSrc(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file?.path, inElectron]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  }, []);

  const zoomIn  = () => setScale((s) => Math.min(+(s + 0.2).toFixed(1), 3.0));
  const zoomOut = () => setScale((s) => Math.max(+(s - 0.2).toFixed(1), 0.4));
  const fitPage = () => setScale(1.0);
  const prevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const nextPage = () => setCurrentPage((p) => Math.min(p + 1, numPages));

  if (!file) {
    return (
      <EmptyState
        icon={<IconFileAlert size={44} strokeWidth={1} className="opacity-30" />}
        message="Selecciona un archivo PDF"
        sub="Haz clic en un PDF del explorador"
      />
    );
  }

  if (file.type !== "pdf") {
    return (
      <EmptyState
        icon={<IconFileAlert size={44} strokeWidth={1} className="opacity-30" />}
        message="Archivo no compatible"
        sub={`El visor soporta únicamente PDFs — ${file.name}`}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-background px-2 py-1">
        <span className="mr-1 max-w-[200px] truncate text-xs text-muted-foreground" title={file.name}>
          {file.name}
        </span>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prevPage} disabled={currentPage <= 1}>
          <IconChevronLeft size={13} />
        </Button>
        <span className="min-w-[60px] text-center text-xs tabular-nums text-muted-foreground">
          {numPages > 0 ? `${currentPage} / ${numPages}` : "—"}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={nextPage} disabled={currentPage >= numPages}>
          <IconChevronRight size={13} />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomOut}>
          <IconZoomOut size={13} />
        </Button>
        <button
          onClick={fitPage}
          className="min-w-[42px] rounded px-1 text-center text-xs tabular-nums text-muted-foreground hover:bg-accent"
        >
          {Math.round(scale * 100)}%
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomIn}>
          <IconZoomIn size={13} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fitPage} title="Zoom 100%">
          <IconMaximize size={13} />
        </Button>
      </div>

      {/* PDF canvas */}
      <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900">
        <div className="flex min-h-full items-start justify-center p-4">
          {loading && <LoadingState />}

          {!loading && pdfSrc && (
            <Document
              file={pdfSrc}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<LoadingState />}
              error={<ErrorState path={file.path} />}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer
                renderAnnotationLayer
                className="shadow-lg"
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      {icon}
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs opacity-60">{sub}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
      <IconLoader2 size={18} className="animate-spin" />
      <span className="text-sm">Cargando PDF…</span>
    </div>
  );
}

function ErrorState({ path }: { path: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
      <IconFileAlert size={32} strokeWidth={1} />
      <span className="text-sm">Error al cargar el PDF</span>
      <span className="max-w-xs break-all text-center text-[10px] opacity-50">{path}</span>
    </div>
  );
}
