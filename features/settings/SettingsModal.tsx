"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import {
  IconX, IconSun, IconMoon, IconDeviceDesktop,
  IconFolder, IconFolderOpen, IconFolderCheck, IconAlertCircle,
  IconSettings2, IconHeart, IconBrain, IconChartBar, IconPalette,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/state/settings.store";
import { useUXStore } from "@/state/ux.store";
import { useIsElectron } from "@/hooks/useIsElectron";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryId = "apariencia" | "carpetas" | "salud" | "enfoque" | "estadisticas";

interface Category { id: CategoryId; label: string; icon: React.ElementType; group: string; color: string; }
interface ScienceInfo { concentration: string; health: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getStats(history: { firstUse: string; daily: Record<string, number> }) {
  const today   = new Date().toISOString().slice(0, 10);
  const entries = Object.entries(history.daily);
  const totalSeconds     = entries.reduce((sum, [, s]) => sum + s, 0);
  const daysWithActivity = entries.filter(([, s]) => s > 0).length;
  const dailyAvg         = daysWithActivity > 0 ? totalSeconds / daysWithActivity : 0;

  const now = new Date(), dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekSeconds  = entries.filter(([d]) => d >= weekStartStr).reduce((sum, [, s]) => sum + s, 0);
  const monthStr     = today.slice(0, 7);
  const monthSeconds = entries.filter(([d]) => d.startsWith(monthStr)).reduce((sum, [, s]) => sum + s, 0);
  const bestEntry    = entries.reduce<[string, number] | null>((b, c) => (!b || c[1] > b[1] ? c : b), null);

  const byDow: number[] = [0,0,0,0,0,0,0], countByDow: number[] = [0,0,0,0,0,0,0];
  for (const [date, secs] of entries) { const d = new Date(date + "T12:00:00").getDay(); byDow[d] += secs; countByDow[d]++; }
  const avgByDow = byDow.map((s, i) => countByDow[i] > 0 ? s / countByDow[i] : 0);
  const bestDow  = avgByDow.indexOf(Math.max(...avgByDow));
  const DOW_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  let streak = 0;
  const checkDate = new Date();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ds = checkDate.toISOString().slice(0, 10);
    if (history.daily[ds] && history.daily[ds] > 0) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else break;
  }

  const last7: { date: string; seconds: number }[] = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); last7.push({ date: ds, seconds: history.daily[ds] ?? 0 }); }
  const maxLast7 = Math.max(...last7.map((d) => d.seconds), 1);

  return { totalSeconds, daysWithActivity, dailyAvg, weekSeconds, monthSeconds, bestEntry, bestDow: DOW_NAMES[bestDow] ?? "—", streak, last7, maxLast7, today };
}

function formatFirstUse(iso: string): string {
  try { return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
}

// ─── SciTooltip — uses Radix Portal, escapes scroll overflow ─────────────────

function SciTooltip({ info }: { info: ScienceInfo }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/60 text-[9px] font-bold text-muted-foreground/50 hover:border-primary/40 hover:bg-primary/8 hover:text-primary transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <IconInfoCircle size={10} />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="right"
            sideOffset={10}
            className="z-[999999] w-72 rounded-xl border border-border bg-popover p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 data-[side=right]:slide-in-from-left-2 duration-150 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
              <span className="text-[11px] font-semibold text-foreground">¿Por qué funciona?</span>
            </div>

            {/* Concentración */}
            <div className="px-4 py-3 border-b border-border/40">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm leading-none">🧠</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Concentración</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{info.concentration}</p>
            </div>

            {/* Salud */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm leading-none">❤️</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Salud</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{info.health}</p>
            </div>

            <TooltipPrimitive.Arrow className="fill-border" width={10} height={5} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, color = "primary" }: {
  checked: boolean; onChange: (v: boolean) => void; color?: "primary" | "amber" | "red";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked
          ? color === "amber" ? "bg-amber-500" : color === "red" ? "bg-red-500" : "bg-primary"
          : "bg-muted-foreground/25",
      )}
    >
      <span className={cn(
        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200",
        checked ? "translate-x-[22px]" : "translate-x-0.5",
      )} />
    </button>
  );
}

// ─── SettingRow ───────────────────────────────────────────────────────────────

function SettingRow({ label, description, checked, onChange, color = "primary", science }: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; color?: "primary" | "amber" | "red";
  science?: ScienceInfo;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5 border-b border-border/40 last:border-b-0">
      <div className="space-y-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{label}</p>
          {science && <SciTooltip info={science} />}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} color={color} />
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, index = 0 }: {
  label: string; value: string; sub?: string; accent?: string; index?: number;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-muted/20 p-4 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden relative"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
    >
      {accent && <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accent)} />}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 pl-1">{label}</p>
      <p className="text-xl font-bold tabular-nums pl-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 pl-1">{sub}</p>}
    </div>
  );
}

// ─── FolderSetting ────────────────────────────────────────────────────────────

function FolderSetting({ label, description, value, placeholder, onPick, onClear, disabled }: {
  label: string; description: string; value: string | null;
  placeholder: string; onPick: () => void; onClear: () => void; disabled: boolean;
}) {
  return (
    <section className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      {value ? (
        <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <IconFolderCheck size={14} className="mt-0.5 shrink-0 text-green-500" />
            <span className="break-all text-xs text-foreground leading-relaxed" title={value}>{value}</span>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onPick} disabled={disabled}>
              <IconFolderOpen size={13} />Cambiar…
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClear}>
              Limpiar
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconAlertCircle size={14} className="shrink-0 text-amber-500" />
            <span className="text-xs">{placeholder}</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onPick} disabled={disabled}>
            <IconFolderOpen size={13} />Seleccionar carpeta…
          </Button>
        </div>
      )}
    </section>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="mb-7 flex items-center gap-3">
      {color && <div className={cn("h-5 w-1 rounded-full", color)} />}
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
    </div>
  );
}

// ─── Science data ──────────────────────────────────────────────────────────────

const SCIENCE: Record<string, ScienceInfo> = {
  privacy: {
    concentration: "El efecto Hawthorne (1924) demostró que la percepción de ser observado aumenta la carga cognitiva en 15-30%. El desenfoque automático elimina el estrés de vigilancia, liberando recursos del córtex prefrontal para trabajo profundo.",
    health: "La percepción de ser observado activa el eje HPA elevando cortisol crónicamente. Reducir este estímulo disminuye el desgaste por estrés acumulado durante la jornada.",
  },
  foveal: {
    concentration: "El sistema visual periférico envía señales al tálamo incluso cuando el objeto no es relevante. Atenuar archivos vecinos reduce el ruido visual periférico, aumentando el tiempo en estado de flujo (Csikszentmihalyi, 1990).",
    health: "La estimulación visual innecesaria fatiga más rápido a las células ganglionares de la retina. Menos carga visual = menos fatiga ocular acumulada en jornadas largas de revisión.",
  },
  reading: {
    concentration: "La luz azul (450-480nm) inhibe la melatonina hasta un 50% (Harvard Medical, 2012). Al normalizar el ritmo circadiano, el sueño mejora y la memoria declarativa se consolida un 23% mejor al día siguiente.",
    health: "La exposición nocturna a pantallas sin filtro eleva marcadores de inflamación sistémica (IL-6, TNF-α) en un 20%. El filtro ámbar reduce esta respuesta inflamatoria progresiva.",
  },
  reminders: {
    concentration: "El cerebro opera en ciclos ultradianos de ~90 minutos (Kleitman, 1963). Pasado este punto, el rendimiento cognitivo cae hasta 25% sin pausa. Los avisos sincronizan el trabajo con la biología neural.",
    health: "Sentarse más de 90 minutos continuos reduce el flujo sanguíneo cerebral prefrontal un 20% (U. Otago, 2020). Una pausa de 3 minutos lo restaura completamente.",
  },
  timer: {
    concentration: "La visibilidad del tiempo activa el córtex cingulado anterior (monitoreo de metas). El registro reduce el efecto de la Ley de Parkinson —el trabajo expande el tiempo disponible— hasta en un 30%.",
    health: "El auto-monitoreo cuantificado es una técnica validada de regulación cognitivo-conductual. Ver el tiempo acumulado genera paradas naturales que previenen el agotamiento por sesiones excesivas.",
  },
  limit: {
    concentration: "La fatiga de decisión (Baumeister, 2008) acumulada en sesiones largas degrada la calidad de análisis legal. Un límite forzado preserva los recursos ejecutivos para las horas de mayor productividad.",
    health: "El trabajo crónico >10h/día aumenta en 33% el riesgo de infarto y 13% el de ACV (The Lancet, 2021). Los límites temporales son una intervención preventiva de salud cardiovascular.",
  },
  progressive: {
    concentration: "La teoría de la carga cognitiva (Sweller, 1988) demuestra que información irrelevante visible consume memoria de trabajo, reduciendo hasta 40% la capacidad para razonamiento profundo por pregunta.",
    health: "La sobrecarga de información activa la amígdala elevando adrenalina. Mostrar un ítem a la vez reduce la activación simpática, permitiendo un estado mental más relajado y preciso.",
  },
  tinting: {
    concentration: "La memoria dependiente del contexto (Godden & Baddeley, 1975) muestra que claves de color reducen el tiempo de recuperación de información en un 15-20%. Cada tinte crea un 'espacio mental' diferenciado por expediente.",
    health: "El cambio de contexto visual previene la interferencia proactiva —confundir información de casos similares— reduciendo errores cognitivos y el estrés asociado a ellos.",
  },
  audio: {
    concentration: "La retroalimentación multimodal (visual + auditiva) crea bucles dopaminérgicos que aceleran el aprendizaje procedimental en 20-25% (Schultz, 1997). Los sonidos sutiles confirman la acción sin interrumpir el flujo.",
    health: "La confirmación inmediata elimina la microansiedad de incertidumbre ('¿guardé el cambio?'). Eliminar este ciclo repetitivo disminuye la carga alostática acumulada durante la jornada.",
  },
  bionic: {
    concentration: "El cerebro predice palabras a partir de sus primeras 3-4 letras (procesamiento predictivo, Clark, 2010). Resaltar el inicio de palabras reduce el tiempo de fijación ocular en 20-30% sin afectar la comprensión.",
    health: "Menos fijaciones por párrafo = menor trabajo de los músculos ciliares. En sesiones largas de lectura legal, reduce la fatiga visual acumulada y los dolores de cabeza tensionales.",
  },
  lighthouse: {
    concentration: "Sin guía horizontal, los movimientos sacádicos de retorno (salto entre líneas) son la principal fuente de errores de lectura. El faro elimina la carga de 'encontrar la línea siguiente', liberando recursos para comprensión.",
    health: "La guía visual reduce los movimientos sacádicos erróneos, disminuyendo la activación de los músculos oculomotores ~25% en sesiones largas. Previene fatiga visual y dolores de cabeza occipitales.",
  },
  pulse: {
    concentration: "El descanso visual periódico previene la diplopía por vergencia —visión doble momentánea— que fuerza al cerebro a corregirla constantemente, consumiendo recursos atencionales que necesitas para el análisis.",
    health: "La Asociación Optométrica Americana documenta que la regla 20-20-20 reduce el Síndrome de Visión Computacional en un 73% de usuarios. Relaja los músculos ciliares y previene la progresión de miopía inducida por pantalla.",
  },
  ambient: {
    concentration: "Ruido ambiental de 65-70 dB (como una cafetería) aumenta el pensamiento abstracto al incrementar el procesamiento difuso (Mehta et al., Journal of Consumer Research, 2012). El ruido blanco enmascara distracciones en espacios abiertos.",
    health: "El silencio absoluto genera hipervigilancia. El sonido ambiental constante y predecible activa el sistema nervioso parasimpático, reduciendo la variabilidad de frecuencia cardíaca asociada al estrés de alerta.",
  },
};

// ─── Section content ──────────────────────────────────────────────────────────

function AparienciaContent() {
  const { theme, setTheme } = useTheme();
  const THEMES = [
    { value: "light",  icon: IconSun,          label: "Claro",   preview: "bg-white border border-zinc-200"  },
    { value: "dark",   icon: IconMoon,          label: "Oscuro",  preview: "bg-zinc-900 border border-zinc-700" },
    { value: "system", icon: IconDeviceDesktop, label: "Sistema", preview: "bg-gradient-to-br from-white to-zinc-900 border border-zinc-300" },
  ] as const;

  return (
    <div>
      <SectionTitle color="bg-violet-500">Apariencia</SectionTitle>
      <div className="flex gap-4">
        {THEMES.map(({ value, icon: Icon, label, preview }) => (
          <button key={value} onClick={() => setTheme(value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all duration-200",
              theme === value
                ? "border-primary bg-primary/5 shadow-sm scale-[1.02]"
                : "border-border hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <div className={cn("h-10 w-full rounded-lg", preview)} />
            <div className="flex items-center gap-1.5">
              <Icon size={13} className={theme === value ? "text-primary" : "text-muted-foreground"} />
              <span className={cn("text-xs font-medium", theme === value ? "text-primary" : "text-muted-foreground")}>{label}</span>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground/50">Atajo rápido: tecla D en cualquier momento.</p>
    </div>
  );
}

function CarpetasContent() {
  const { clientesFolder, revisionesFolder, setClientesFolder, setRevisionesFolder } = useSettingsStore();
  const inElectron = useIsElectron();
  const pick = async (setter: (p: string) => void) => { if (!inElectron) return; const p = await window.api.openDirectory(); if (p) setter(p); };
  return (
    <div className="space-y-8">
      <SectionTitle color="bg-amber-500">Carpetas</SectionTitle>
      <FolderSetting label="Carpeta de clientes" description="Raíz del Dropbox compartido con clientes." value={clientesFolder} placeholder="Sin configurar" onPick={() => pick(setClientesFolder)} onClear={() => setClientesFolder(null)} disabled={!inElectron} />
      <FolderSetting label="Carpeta de revisiones" description="Donde se guardan los JSON de revisión." value={revisionesFolder} placeholder="Sin configurar" onPick={() => pick(setRevisionesFolder)} onClear={() => setRevisionesFolder(null)} disabled={!inElectron} />
    </div>
  );
}

function SaludContent() {
  const {
    privacyBlur, setPrivacyBlur, fovealFocus, setFovealFocus,
    autoReadingMode, setAutoReadingMode, readingModeStartHour, setReadingModeStartHour,
    healthReminders, setHealthReminders, sessionTimer, setSessionTimer,
    dailyLimitEnabled, setDailyLimitEnabled, dailyLimitMinutes, setDailyLimitMinutes,
  } = useUXStore();
  const limitH = Math.floor(dailyLimitMinutes / 60), limitM = dailyLimitMinutes % 60;
  const handleH = (h: number) => setDailyLimitMinutes(Math.max(1, Math.max(0, h) * 60 + limitM));
  const handleM = (m: number) => setDailyLimitMinutes(Math.max(1, limitH * 60 + Math.min(59, Math.max(0, m))));

  return (
    <div>
      <SectionTitle color="bg-red-500">Salud & Foco</SectionTitle>

      <SettingRow label="Privacy Focus" description="Desenfoque automático al cambiar de ventana para evitar miradas indiscretas." checked={privacyBlur} onChange={setPrivacyBlur} science={SCIENCE.privacy} />
      <SettingRow label="Foveal Focus" description="Atenúa sutilmente los archivos vecinos en el explorador para centrar la atención." checked={fovealFocus} onChange={setFovealFocus} science={SCIENCE.foveal} />

      {/* Auto Reading Mode */}
      <div className="py-3.5 border-b border-border/40 space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">Modo Lectura Automático</p>
              <SciTooltip info={SCIENCE.reading} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Filtro de descanso visual basado en la hora local (24h).</p>
          </div>
          <Toggle checked={autoReadingMode} onChange={setAutoReadingMode} color="amber" />
        </div>
        {autoReadingMode && (
          <div className="flex items-center justify-between rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-muted-foreground">Activar a partir de las:</p>
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} max={23} value={readingModeStartHour} onChange={(e) => setReadingModeStartHour(parseInt(e.target.value) || 0)}
                className="h-6 w-10 rounded border border-border bg-background text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              <span className="text-xs font-medium text-muted-foreground/60">:00h</span>
            </div>
          </div>
        )}
      </div>

      <SettingRow label="Recordatorios de Salud" description="Avisos de descanso automáticos cada 50 minutos de flujo profundo." checked={healthReminders} onChange={setHealthReminders} science={SCIENCE.reminders} />
      <SettingRow label="Contador de Sesión" description="Muestra el tiempo total de actividad en la barra inferior." checked={sessionTimer} onChange={setSessionTimer} science={SCIENCE.timer} />

      {/* Daily Limit */}
      <div className="py-3.5 space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">Límite Diario</p>
              <SciTooltip info={SCIENCE.limit} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Bloquea el acceso a la app tras alcanzar el tiempo configurado.</p>
          </div>
          <Toggle checked={dailyLimitEnabled} onChange={setDailyLimitEnabled} color="red" />
        </div>
        {dailyLimitEnabled && (
          <div className="flex items-center justify-between rounded-lg bg-red-500/5 border border-red-500/20 p-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-muted-foreground">Bloquear tras:</p>
            <div className="flex items-center gap-1">
              <input type="number" min={0} max={23} value={limitH} onChange={(e) => handleH(parseInt(e.target.value) || 0)} className="h-6 w-10 rounded border border-border bg-background text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-400/40" />
              <span className="text-xs font-medium text-muted-foreground/60">h</span>
              <input type="number" min={0} max={59} value={limitM} onChange={(e) => handleM(parseInt(e.target.value) || 0)} className="h-6 w-10 rounded border border-border bg-background text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-400/40" />
              <span className="text-xs font-medium text-muted-foreground/60">m</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EnfoqueContent() {
  const {
    progressiveDisclosure, setProgressiveDisclosure, contextTinting, setContextTinting,
    microAudio, setMicroAudio, bionicReading, setBionicReading,
    lighthouseMode, setLighthouseMode, eyePulse, setEyePulse, ambientSound, setAmbientSound,
  } = useUXStore();

  return (
    <div>
      <SectionTitle color="bg-blue-500">Enfoque Avanzado</SectionTitle>
      <SettingRow label="Progressive Disclosure" description="Enfoca solo la pregunta activa en el cuestionario, atenuando el resto." checked={progressiveDisclosure} onChange={setProgressiveDisclosure} science={SCIENCE.progressive} />
      <SettingRow label="Tintado de Contexto" description="Colorea sutilmente la app según el tipo de expediente para reconocimiento rápido." checked={contextTinting} onChange={setContextTinting} science={SCIENCE.tinting} />
      <SettingRow label="Micro-Audio Háptico" description="Sonidos sutiles para confirmar interacciones (vía altavoz)." checked={microAudio} onChange={setMicroAudio} science={SCIENCE.audio} />
      <SettingRow label="Lectura Biónica" description="Resalta el inicio de las palabras para acelerar el escaneo mental del texto." checked={bionicReading} onChange={setBionicReading} science={SCIENCE.bionic} />
      <SettingRow label="Modo Faro (Lighthouse)" description="Crea una guía luminosa horizontal para no perder la línea al leer PDF." checked={lighthouseMode} onChange={setLighthouseMode} science={SCIENCE.lighthouse} />
      <SettingRow label="Pulso Ocular 20-20-20" description="Un indicador visual sutil cada 20 minutos para prevenir fatiga ocular." checked={eyePulse} onChange={setEyePulse} science={SCIENCE.pulse} />

      <div className="py-3.5">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-sm font-medium">Ambiente Sonoro</p>
          <SciTooltip info={SCIENCE.ambient} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["none","rain","white","cafe"] as const).map((id) => {
            const labels: Record<string, string> = { none: "Sin Sonido", rain: "Lluvia", white: "Ruido Blanco", cafe: "Cafetería" };
            return (
              <button key={id} onClick={() => setAmbientSound(id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all border",
                  ambientSound === id
                    ? "bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-500/25"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
                )}
              >{labels[id]}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EstadisticasContent() {
  const usageHistory = useUXStore((s) => s.usageHistory);
  const stats = getStats(usageHistory);
  const [mounted, setMounted] = useState(false);
  const DOW_SHORT = ["D","L","M","X","J","V","S"];

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const ACCENTS = ["bg-primary","bg-green-500","bg-violet-500","bg-amber-500","bg-sky-500","bg-yellow-500","bg-orange-500","bg-red-500"];

  return (
    <div>
      <SectionTitle color="bg-green-500">Estadísticas</SectionTitle>
      <p className="text-xs text-muted-foreground mb-6">En uso desde el <span className="font-semibold text-foreground">{formatFirstUse(usageHistory.firstUse)}</span></p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatCard label="Hoy"             value={formatDuration(stats.last7[stats.last7.length - 1]?.seconds ?? 0)} accent={ACCENTS[0]} index={0} />
        <StatCard label="Esta semana"     value={formatDuration(stats.weekSeconds)}  accent={ACCENTS[1]} index={1} />
        <StatCard label="Este mes"        value={formatDuration(stats.monthSeconds)} accent={ACCENTS[2]} index={2} />
        <StatCard label="Total histórico" value={formatDuration(stats.totalSeconds)} accent={ACCENTS[3]} index={3} />
        <StatCard label="Promedio diario" value={formatDuration(Math.round(stats.dailyAvg))} sub={`${stats.daysWithActivity} días activos`} accent={ACCENTS[4]} index={4} />
        <StatCard label="Mejor día"       value={stats.bestEntry ? formatDuration(stats.bestEntry[1]) : "—"} sub={stats.bestEntry?.[0]} accent={ACCENTS[5]} index={5} />
        <StatCard label="Día más productivo" value={stats.bestDow} accent={ACCENTS[6]} index={6} />
        <StatCard label="Racha actual"    value={stats.streak > 0 ? `${stats.streak > 2 ? "🔥 " : ""}${stats.streak} día${stats.streak !== 1 ? "s" : ""}` : "—"} accent={ACCENTS[7]} index={7} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Últimos 7 días</p>
        <div className="flex items-end gap-2 h-20">
          {stats.last7.map((day, i) => {
            const targetH = Math.round((day.seconds / stats.maxLast7) * 56);
            const finalH  = Math.max(targetH, day.seconds > 0 ? 4 : 0);
            const dowIdx  = new Date(day.date + "T12:00:00").getDay();
            const isToday = day.date === stats.today;
            return (
              <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex flex-1 w-full items-end justify-center">
                  <div
                    className={cn("w-full rounded-t-md transition-all", isToday ? "bg-primary shadow-sm shadow-primary/30" : "bg-primary/35 hover:bg-primary/55")}
                    style={{ height: mounted ? `${finalH}px` : "0px", transition: `height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 60}ms` }}
                  />
                  <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground/90 px-2.5 py-1.5 text-[10px] text-background opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                    <p className="font-semibold">{day.date}</p>
                    <p className="text-background/70">{formatDuration(day.seconds)}</p>
                  </div>
                </div>
                <span className={cn("text-[9px] font-semibold", isToday ? "text-primary" : "text-muted-foreground/50")}>{DOW_SHORT[dowIdx]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { id: "apariencia",   label: "Apariencia",      icon: IconPalette,  group: "GENERAL",     color: "text-violet-500" },
  { id: "carpetas",     label: "Carpetas",         icon: IconFolder,   group: "GENERAL",     color: "text-amber-500"  },
  { id: "salud",        label: "Salud & Foco",     icon: IconHeart,    group: "EXPERIENCIA", color: "text-red-500"    },
  { id: "enfoque",      label: "Enfoque Avanzado", icon: IconBrain,    group: "EXPERIENCIA", color: "text-blue-500"   },
  { id: "estadisticas", label: "Estadísticas",     icon: IconChartBar, group: "DATOS",       color: "text-green-500"  },
];

// ─── Modal ────────────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("apariencia");
  const [contentKey,     setContentKey]     = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCategoryChange = (id: CategoryId) => { setActiveCategory(id); setContentKey((k) => k + 1); };
  const groups = Array.from(new Set(CATEGORIES.map((c) => c.group)));

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex w-[920px] h-[660px] max-w-[95vw] max-h-[90vh] rounded-2xl bg-background border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left sidebar */}
        <div className="w-[210px] shrink-0 flex flex-col border-r border-border bg-muted/10">
          <div className="flex items-center justify-between px-4 py-4 shrink-0">
            <div className="flex items-center gap-2">
              <IconSettings2 size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold">Configuración</span>
            </div>
            <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <IconX size={14} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-5">
            {groups.map((group) => (
              <div key={group}>
                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{group}</p>
                {CATEGORIES.filter((c) => c.group === group).map(({ id, label, icon: Icon, color }) => (
                  <button key={id} onClick={() => handleCategoryChange(id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all duration-150 relative",
                      activeCategory === id
                        ? "bg-primary/8 text-foreground font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon size={15} strokeWidth={1.8} className={cn("transition-colors", activeCategory === id ? color : "text-muted-foreground/60")} />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div key={contentKey} className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-200">
          {activeCategory === "apariencia"   && <AparienciaContent />}
          {activeCategory === "carpetas"     && <CarpetasContent />}
          {activeCategory === "salud"        && <SaludContent />}
          {activeCategory === "enfoque"      && <EnfoqueContent />}
          {activeCategory === "estadisticas" && <EstadisticasContent />}
        </div>
      </div>
    </div>
  );
}
