"use client";

import { useState, useEffect, useMemo } from "react";
import {
  IconFileTypeXml, IconLoader2, IconAlertTriangle,
  IconReceipt, IconBuilding, IconUser, IconCoin,
  IconCalendar, IconHash, IconTag, IconShield,
  IconChevronDown, IconChevronRight, IconCode,
} from "@tabler/icons-react";
import { useIsElectron } from "@/hooks/useIsElectron";
import type { FileNode } from "@/types/expediente";
import { cn } from "@/lib/utils";

// ─── XML pretty-printer + syntax highlighter ─────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function prettyXml(xml: string, indent = 2): string {
  const INDENT = " ".repeat(indent);
  let out = "", depth = 0, i = 0;

  const token = (): string => {
    if (i >= xml.length) return "";
    if (xml[i] === "<") {
      const end = xml.indexOf(">", i);
      if (end < 0) return xml.slice(i);
      const tag = xml.slice(i, end + 1);
      i = end + 1;
      return tag;
    }
    const next = xml.indexOf("<", i);
    const text = (next < 0 ? xml.slice(i) : xml.slice(i, next)).trim();
    i = next < 0 ? xml.length : next;
    return text;
  };

  let tok: string;
  while ((tok = token()) !== "") {
    if (!tok.startsWith("<")) { if (tok) out += INDENT.repeat(depth) + escHtml(tok) + "\n"; continue; }
    const isClose    = tok.startsWith("</");
    const isSelfClose = tok.endsWith("/>");
    const isDecl     = tok.startsWith("<?") || tok.startsWith("<!");
    if (isClose) depth = Math.max(0, depth - 1);
    out += INDENT.repeat(depth) + colorTag(tok) + "\n";
    if (!isClose && !isSelfClose && !isDecl) depth++;
  }
  return out;
}

function colorTag(tag: string): string {
  if (tag.startsWith("<?") || tag.startsWith("<!")) {
    return `<span class="text-muted-foreground/50">${escHtml(tag)}</span>`;
  }
  // Split tag into: opening < + name + attrs + closing >
  return tag.replace(
    /^(<\/?)([^\s>\/]+)([\s\S]*?)(\/?>)$/,
    (_, open, name, attrs, close) => {
      const coloredName = `<span class="text-blue-400 dark:text-blue-300">${escHtml(name)}</span>`;
      const coloredAttrs = attrs.replace(
        /([\w:]+)=("([^"]*)")/g,
        (_m: string, attrName: string, _q: string, val: string) =>
          `<span class="text-amber-500 dark:text-amber-400">${attrName}</span>=<span class="text-green-500 dark:text-green-400">"${escHtml(val)}"</span>`,
      );
      return `<span class="text-muted-foreground/60">${escHtml(open)}</span>${coloredName}${coloredAttrs}<span class="text-muted-foreground/60">${escHtml(close)}</span>`;
    },
  );
}

// ─── CFDI detection & parsing ─────────────────────────────────────────────────

const CFDI_NS = ["http://www.sat.gob.mx/cfd/3", "http://www.sat.gob.mx/cfd/4"];

function isCfdi(doc: Document): boolean {
  const root = doc.documentElement;
  const localName = root.localName.toLowerCase();
  const ns = root.namespaceURI ?? "";
  return localName === "comprobante" && CFDI_NS.some((n) => ns.includes(n.split("/").slice(0, -1).join("/")));
}

interface CfdiData {
  version:        string;
  fecha:          string;
  folio:          string;
  serie:          string;
  tipo:           string;
  subtotal:       string;
  descuento:      string;
  total:          string;
  moneda:         string;
  metodoPago:     string;
  formaPago:      string;
  emisorRfc:      string;
  emisorNombre:   string;
  emisorRegimen:  string;
  receptorRfc:    string;
  receptorNombre: string;
  receptorUso:    string;
  conceptos:      { descripcion: string; cantidad: string; unidad: string; valorUnitario: string; importe: string }[];
  totalIva:       string;
  uuid:           string;
  fechaTimbrado:  string;
}

function attr(el: Element | null, name: string): string {
  if (!el) return "";
  // Try direct attribute + common prefixes
  return el.getAttribute(name) ?? el.getAttribute("cfdi:" + name) ?? "";
}

function parseCfdi(doc: Document): CfdiData {
  const root = doc.documentElement;
  const g = (name: string) => attr(root, name);

  const emisor   = root.querySelector("Emisor,   [local-name()='Emisor']")   ?? null;
  const receptor = root.querySelector("Receptor, [local-name()='Receptor']") ?? null;

  // getElementsByTagNameNS fallback
  const getFirst = (tag: string) => {
    const direct = root.getElementsByTagName(tag)[0] ?? root.getElementsByTagName("cfdi:" + tag)[0];
    return direct ?? null;
  };

  const emisorEl   = getFirst("Emisor");
  const receptorEl = getFirst("Receptor");
  const tfd        = root.getElementsByTagName("tfd:TimbreFiscalDigital")[0]
                   ?? root.getElementsByTagName("TimbreFiscalDigital")[0]
                   ?? null;

  const conceptoEls = Array.from(root.getElementsByTagName("Concepto"))
    .concat(Array.from(root.getElementsByTagName("cfdi:Concepto")));

  const impuestosEl = getFirst("Impuestos");

  return {
    version:        g("Version") || g("version"),
    fecha:          g("Fecha"),
    folio:          g("Folio"),
    serie:          g("Serie"),
    tipo:           g("TipoDeComprobante"),
    subtotal:       g("SubTotal"),
    descuento:      g("Descuento"),
    total:          g("Total"),
    moneda:         g("Moneda"),
    metodoPago:     g("MetodoPago"),
    formaPago:      g("FormaPago"),
    emisorRfc:      attr(emisorEl, "Rfc"),
    emisorNombre:   attr(emisorEl, "Nombre"),
    emisorRegimen:  attr(emisorEl, "RegimenFiscal"),
    receptorRfc:    attr(receptorEl, "Rfc"),
    receptorNombre: attr(receptorEl, "Nombre"),
    receptorUso:    attr(receptorEl, "UsoCFDI"),
    conceptos: conceptoEls.slice(0, 20).map((c) => ({
      descripcion:   c.getAttribute("Descripcion") ?? "",
      cantidad:      c.getAttribute("Cantidad") ?? "",
      unidad:        c.getAttribute("ClaveUnidad") ?? c.getAttribute("Unidad") ?? "",
      valorUnitario: c.getAttribute("ValorUnitario") ?? "",
      importe:       c.getAttribute("Importe") ?? "",
    })),
    totalIva:     attr(impuestosEl, "TotalImpuestosTrasladados"),
    uuid:         tfd?.getAttribute("UUID") ?? tfd?.getAttribute("uuid") ?? "",
    fechaTimbrado: tfd?.getAttribute("FechaTimbrado") ?? "",
  };
}

// ─── CFDI helpers ─────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  I: "Ingreso", E: "Egreso", T: "Traslado", N: "Nómina", P: "Pago",
};
const TIPO_COLOR: Record<string, string> = {
  I: "text-green-600 bg-green-500/10 border-green-500/20",
  E: "text-red-600 bg-red-500/10 border-red-500/20",
  T: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  N: "text-violet-600 bg-violet-500/10 border-violet-500/20",
  P: "text-amber-600 bg-amber-500/10 border-amber-500/20",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

function fmtMoney(val: string, moneda = "MXN"): string {
  if (!val) return "—";
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN" }).format(parseFloat(val));
  } catch { return val; }
}

// ─── CFDI View ────────────────────────────────────────────────────────────────

function CfdiView({ data }: { data: CfdiData }) {
  const [showConceptos, setShowConceptos] = useState(true);

  const tipoLabel = TIPO_LABEL[data.tipo] ?? data.tipo;
  const tipoColor = TIPO_COLOR[data.tipo] ?? "text-muted-foreground bg-muted/30 border-border";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border bg-muted/10 px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
          <IconReceipt size={15} className="text-blue-500" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">CFDI {data.version}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", tipoColor)}>
              {tipoLabel}
            </span>
            {data.serie && <span className="text-xs text-muted-foreground/60 font-mono">{data.serie}{data.folio}</span>}
          </div>
          {data.uuid && <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5 truncate">UUID: {data.uuid}</p>}
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-lg font-bold tabular-nums">{fmtMoney(data.total, data.moneda)}</p>
          <p className="text-[10px] text-muted-foreground/50">{data.moneda}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Partes */}
        <div className="grid grid-cols-2 gap-4">
          <InfoCard icon={IconBuilding} label="Emisor" color="text-blue-500">
            <p className="font-mono text-xs text-muted-foreground/70">{data.emisorRfc || "—"}</p>
            <p className="text-sm font-medium mt-0.5">{data.emisorNombre || "—"}</p>
            {data.emisorRegimen && <p className="text-[10px] text-muted-foreground/50 mt-0.5">Régimen: {data.emisorRegimen}</p>}
          </InfoCard>
          <InfoCard icon={IconUser} label="Receptor" color="text-green-500">
            <p className="font-mono text-xs text-muted-foreground/70">{data.receptorRfc || "—"}</p>
            <p className="text-sm font-medium mt-0.5">{data.receptorNombre || "—"}</p>
            {data.receptorUso && <p className="text-[10px] text-muted-foreground/50 mt-0.5">Uso CFDI: {data.receptorUso}</p>}
          </InfoCard>
        </div>

        {/* Fechas + pago */}
        <div className="grid grid-cols-3 gap-3">
          <MiniStat icon={IconCalendar} label="Fecha emisión" value={fmtDate(data.fecha)} />
          {data.fechaTimbrado && <MiniStat icon={IconShield} label="Fecha timbrado" value={fmtDate(data.fechaTimbrado)} />}
          {data.metodoPago && <MiniStat icon={IconTag} label="Método de pago" value={data.metodoPago} />}
          {data.formaPago   && <MiniStat icon={IconCoin} label="Forma de pago" value={data.formaPago} />}
        </div>

        {/* Importes */}
        <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-border">
            <AmountCell label="Subtotal" value={fmtMoney(data.subtotal, data.moneda)} />
            {data.descuento && <AmountCell label="Descuento" value={`- ${fmtMoney(data.descuento, data.moneda)}`} />}
            {data.totalIva  && <AmountCell label="IVA" value={fmtMoney(data.totalIva, data.moneda)} />}
            <AmountCell label="Total" value={fmtMoney(data.total, data.moneda)} highlight />
          </div>
        </div>

        {/* Conceptos */}
        {data.conceptos.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              className="flex w-full items-center justify-between bg-muted/20 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setShowConceptos((v) => !v)}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Conceptos ({data.conceptos.length})
              </span>
              {showConceptos ? <IconChevronDown size={13} className="text-muted-foreground/50" /> : <IconChevronRight size={13} className="text-muted-foreground/50" />}
            </button>
            {showConceptos && (
              <div className="divide-y divide-border/40">
                {data.conceptos.map((c, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground/90 leading-relaxed">{c.descripcion || "—"}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {c.cantidad && `${c.cantidad} ${c.unidad}`}
                        {c.valorUnitario && ` · ${fmtMoney(c.valorUnitario, "MXN")} c/u`}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-xs font-medium text-foreground/80">
                      {fmtMoney(c.importe, "MXN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* UUID */}
        {data.uuid && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/20 border border-border/40 px-3 py-2">
            <IconHash size={12} className="shrink-0 text-muted-foreground/40" />
            <p className="text-[10px] font-mono text-muted-foreground/50 break-all select-all">{data.uuid}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, color, children }: {
  icon: React.ElementType; label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} className={cn("shrink-0", color)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">{label}</span>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={10} className="text-muted-foreground/40" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">{label}</span>
      </div>
      <p className="text-xs font-medium text-foreground/80">{value}</p>
    </div>
  );
}

function AmountCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("px-4 py-3 text-center", highlight && "bg-primary/5")}>
      <p className={cn("text-[10px] uppercase tracking-wider font-semibold mb-1", highlight ? "text-primary/70" : "text-muted-foreground/50")}>{label}</p>
      <p className={cn("tabular-nums font-bold", highlight ? "text-base text-primary" : "text-sm text-foreground/80")}>{value}</p>
    </div>
  );
}

// ─── Raw XML View ─────────────────────────────────────────────────────────────

function RawXmlView({ xml }: { xml: string }) {
  const [showRaw, setShowRaw] = useState(false);

  const highlighted = useMemo(() => prettyXml(xml, 2), [xml]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 flex items-center gap-3 border-b border-border bg-muted/10 px-5 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
          <IconFileTypeXml size={13} className="text-blue-400" />
        </div>
        <span className="text-sm font-semibold">Documento XML</span>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <IconCode size={11} />
          {showRaw ? "Vista formateada" : "XML crudo"}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-muted/5 p-5">
        <pre
          className="font-mono text-[11px] leading-relaxed whitespace-pre"
          // Content is XML string we own — escaped before inserting
          dangerouslySetInnerHTML={{ __html: showRaw ? escHtml(xml) : highlighted }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function XmlViewer({ file }: { file: FileNode }) {
  const inElectron = useIsElectron();
  const [content, setContent] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setContent(null);
    setError(null);
    setLoading(true);

    if (!inElectron) { setLoading(false); setError("Solo disponible en la app de escritorio."); return; }

    window.api.readFile(file.path)
      .then((text) => { setContent(text); setLoading(false); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error al leer el archivo.");
        setLoading(false);
      });
  }, [file.path, inElectron]);

  if (loading) return (
    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground/50">
      <IconLoader2 size={18} className="animate-spin" />
      <span className="text-sm">Cargando XML…</span>
    </div>
  );

  if (error || !content) return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/50">
      <IconAlertTriangle size={32} strokeWidth={1} className="opacity-40" />
      <p className="text-sm">{error ?? "No se pudo leer el archivo."}</p>
    </div>
  );

  // Parse once, decide view
  let doc: Document | null = null;
  try { doc = new DOMParser().parseFromString(content, "text/xml"); } catch {}

  if (doc && !doc.querySelector("parsererror") && isCfdi(doc)) {
    return <CfdiView data={parseCfdi(doc)} />;
  }

  return <RawXmlView xml={content} />;
}
