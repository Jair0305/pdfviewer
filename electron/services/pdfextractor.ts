/**
 * PDF text extraction for the main process using pdfjs-dist legacy build.
 * Loaded lazily via a dynamic file:// import to bypass esbuild bundling.
 */
import { createRequire } from "module";
import path from "path";
import fs from "fs";

const req = createRequire(import.meta.url);

// Lazy singleton — initialized once, reused for all extractions
let _getDocument: ((src: { data: Uint8Array }) => { promise: Promise<PdfDoc> }) | null = null;

interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>;
  cleanup(): void;
}

async function ensureInit() {
  if (_getDocument) return _getDocument;

  // Resolve actual file paths from node_modules at runtime
  const pkgJson  = req.resolve("pdfjs-dist/package.json");
  const pkgDir   = path.dirname(pkgJson);
  const pdfPath  = path.join(pkgDir, "legacy", "build", "pdf.mjs");
  const wrkPath  = path.join(pkgDir, "legacy", "build", "pdf.worker.mjs");

  // Use file:// URLs — esbuild leaves dynamic `import(variable)` untouched
  const pdfUrl = "file:///" + pdfPath.replace(/\\/g, "/");
  const wrkUrl = "file:///" + wrkPath.replace(/\\/g, "/");

  const lib = await import(pdfUrl) as {
    getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfDoc> };
    GlobalWorkerOptions: { workerSrc: string };
  };
  lib.GlobalWorkerOptions.workerSrc = wrkUrl;
  _getDocument = lib.getDocument;

  console.log("[PDF EXTRACTOR] pdfjs initialized, worker:", wrkUrl);
  return _getDocument;
}

export interface ExtractedPage {
  page: number;
  text: string;
}

export async function extractPdfPages(filePath: string): Promise<ExtractedPage[]> {
  const getDocument = await ensureInit();

  const buffer = fs.readFileSync(filePath);
  const data   = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const doc   = await getDocument({ data }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const tc   = await page.getTextContent();
    const text = (tc.items as { str?: string }[])
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 5) pages.push({ page: pageNum, text });
    page.cleanup();
  }

  await doc.destroy();
  return pages;
}
