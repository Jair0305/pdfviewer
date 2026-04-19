"use client";

import { useState } from "react";
import {
  IconSettings2,
  IconFolderOpen,
  IconFolderCheck,
  IconAlertCircle,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/state/settings.store";
import { useUXStore }       from "@/state/ux.store";
import { useIsElectron }    from "@/hooks/useIsElectron";
import { cn }               from "@/lib/utils";

// ─── Folder picker row ────────────────────────────────────────────────────────

function FolderSetting({
  label,
  description,
  value,
  placeholder,
  onPick,
  onClear,
  disabled,
}: {
  label: string;
  description: string;
  value: string | null;
  placeholder: string;
  onPick: () => void;
  onClear: () => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>

      {value ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-2">
          <div className="flex items-start gap-2">
            <IconFolderCheck size={13} className="mt-0.5 shrink-0 text-green-500" />
            <span
              className="break-all text-[11px] text-foreground leading-relaxed"
              title={value}
            >
              {value}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1.5 text-[11px]"
              onClick={onPick}
              disabled={disabled}
            >
              <IconFolderOpen size={12} />
              Cambiar…
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-muted-foreground"
              onClick={onClear}
            >
              Limpiar
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconAlertCircle size={13} className="shrink-0 text-amber-500" />
            <span className="text-[11px]">{placeholder}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1.5 text-[11px]"
            onClick={onPick}
            disabled={disabled}
          >
            <IconFolderOpen size={12} />
            Seleccionar carpeta…
          </Button>
        </div>
      )}
    </section>
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
        "relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shadow-inner",
        checked
          ? color === "amber" ? "bg-amber-500" : color === "red" ? "bg-red-500" : "bg-primary"
          : "bg-muted-foreground/30 dark:bg-muted-foreground/20",
      )}
    >
      <span className={cn(
        "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-5" : "translate-x-0",
      )} />
    </button>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const {
    clientesFolder,
    revisionesFolder,
    setClientesFolder,
    setRevisionesFolder,
  } = useSettingsStore();

  const {
    privacyBlur, setPrivacyBlur,
    fovealFocus, setFovealFocus,
    autoReadingMode, setAutoReadingMode,
    readingModeStartHour, setReadingModeStartHour,
    progressiveDisclosure, setProgressiveDisclosure,
    contextTinting, setContextTinting,
    microAudio, setMicroAudio,
    healthReminders, setHealthReminders,
    sessionTimer, setSessionTimer,
    zenMode, setZenMode,
    bionicReading, setBionicReading,
    lighthouseMode, setLighthouseMode,
    ambientSound, setAmbientSound,
    eyePulse, setEyePulse,
    dailyLimitEnabled, setDailyLimitEnabled,
    dailyLimitMinutes, setDailyLimitMinutes,
    totalDailyTime,
  } = useUXStore();

  // Decompose total minutes into H + M for the two inputs
  const limitH = Math.floor(dailyLimitMinutes / 60);
  const limitM = dailyLimitMinutes % 60;

  const handleLimitHChange = (h: number) => {
    const newTotal = Math.max(0, h) * 60 + limitM;
    setDailyLimitMinutes(Math.max(1, newTotal));
  };
  const handleLimitMChange = (m: number) => {
    const newTotal = limitH * 60 + Math.min(59, Math.max(0, m));
    setDailyLimitMinutes(Math.max(1, newTotal));
  };

  const limitExceeded = dailyLimitEnabled && totalDailyTime >= dailyLimitMinutes * 60;

  const { theme, setTheme } = useTheme();

  const inElectron = useIsElectron();

  const pick = async (setter: (p: string) => void) => {
    if (!inElectron) return;
    const picked = await window.api.openDirectory();
    if (picked) setter(picked);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <IconSettings2 size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Configuración
        </span>
      </div>

      <Separator className="shrink-0" />

      <div className="flex-1 space-y-7 overflow-y-auto p-3 pb-8">

        {/* --- Apariencia --- */}
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Apariencia
          </p>
          <div className="flex gap-1.5">
            {([
              { value: "light",  icon: IconSun,           label: "Claro"    },
              { value: "dark",   icon: IconMoon,          label: "Oscuro"   },
              { value: "system", icon: IconDeviceDesktop, label: "Sistema"  },
            ] as const).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-md border py-2 text-[10px] font-medium transition-colors",
                  theme === value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
                title={`${label} (atajo: D)`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50">Atajo: presiona D en cualquier momento.</p>
        </section>

        <Separator />

        {/* --- Folder Section --- */}
        <div className="space-y-5">
          <FolderSetting
            label="Carpeta de clientes"
            description='Raíz del Dropbox compartido con clientes.'
            value={clientesFolder}
            placeholder="Sin configurar"
            onPick={() => pick(setClientesFolder)}
            onClear={() => setClientesFolder(null)}
            disabled={!inElectron}
          />

          <FolderSetting
            label="Carpeta de revisiones"
            description='Donde se guardan los JSON de revisión.'
            value={revisionesFolder}
            placeholder="Sin configurar"
            onPick={() => pick(setRevisionesFolder)}
            onClear={() => setRevisionesFolder(null)}
            disabled={!inElectron}
          />
        </div>

        <Separator />

        {/* --- UX Section --- */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Salud y Experiencia
            </p>
          </div>

          <div className="space-y-4">
            {/* Privacy Focus */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Privacy Focus</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Desenfoque automático al cambiar de ventana para evitar distracciones.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={privacyBlur} onChange={setPrivacyBlur} />
              </div>
            </div>

            {/* Foveal Focus */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Foveal Focus</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Atenúa sutilmente los archivos vecinos en el explorador.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={fovealFocus} onChange={setFovealFocus} />
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Auto Reading Mode */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium text-foreground">Modo Lectura Automático</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Filtro de descanso visual basado en la hora local (24h).</p>
                </div>
                <div className="mt-0.5">
                  <Toggle checked={autoReadingMode} onChange={setAutoReadingMode} color="amber" />
                </div>
              </div>

              {autoReadingMode && (
                <div className="flex items-center justify-between rounded-md bg-muted/30 p-2 border border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[10px] text-muted-foreground">Activar a partir de las:</p>
                  <div className="flex items-center gap-1.5 focus-within:text-foreground transition-colors">
                    <input 
                      type="number"
                      min={0} max={23}
                      value={readingModeStartHour}
                      onChange={(e) => setReadingModeStartHour(parseInt(e.target.value) || 0)}
                      className="h-5 w-8 rounded border border-border bg-background text-center text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
                    />
                    <span className="text-[10px] font-medium text-muted-foreground/60">:00h</span>
                  </div>
                </div>
              )}
            </div>

            <Separator className="opacity-50" />

            {/* Progressive Disclosure */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Progressive Disclosure</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Enfoca solo la pregunta activa en el cuestionario, atenuando el resto.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={progressiveDisclosure} onChange={setProgressiveDisclosure} />
              </div>
            </div>

            {/* Context Tinting */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Tintado de Contexto</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Colorea sutilmente la app según el tipo de expediente para reconocimiento rápido.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={contextTinting} onChange={setContextTinting} />
              </div>
            </div>

            {/* Micro Audio */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Micro-Audio Háptico</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Sonidos sutiles para confirmar interacciones (vía altavoz).</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={microAudio} onChange={setMicroAudio} />
              </div>
            </div>

            {/* Health Reminders */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Recordatorios de Salud</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Avisos de descanso automáticos cada 50 minutos de flujo profundo.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={healthReminders} onChange={setHealthReminders} />
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Session Timer (WakaTime style) */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Contador de Sesión (WakaTime)</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Muestra el tiempo total de actividad en la barra inferior.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={sessionTimer} onChange={setSessionTimer} />
              </div>
            </div>

            {/* Daily Limit */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium text-foreground">Límite Diario de Uso</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Bloquea el acceso a la app tras alcanzar el tiempo configurado.</p>
                </div>
                <div className="mt-0.5">
                  <Toggle checked={dailyLimitEnabled} onChange={setDailyLimitEnabled} color="red" />
                </div>
              </div>

              {dailyLimitEnabled && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between rounded-md bg-muted/30 p-2 border border-border/50">
                    <p className="text-[10px] text-muted-foreground">Bloquear tras:</p>
                    <div className="flex items-center gap-1 focus-within:text-foreground transition-colors">
                      <input
                        type="number"
                        min={0} max={23}
                        value={limitH}
                        onChange={(e) => handleLimitHChange(parseInt(e.target.value) || 0)}
                        className="h-5 w-8 rounded border border-border bg-background text-center text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
                      />
                      <span className="text-[10px] font-medium text-muted-foreground/60">h</span>
                      <input
                        type="number"
                        min={0} max={59}
                        value={limitM}
                        onChange={(e) => handleLimitMChange(parseInt(e.target.value) || 0)}
                        className="h-5 w-8 rounded border border-border bg-background text-center text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
                      />
                      <span className="text-[10px] font-medium text-muted-foreground/60">m</span>
                    </div>
                  </div>
                  {limitExceeded && (
                    <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
                      <IconAlertCircle size={11} className="shrink-0 text-amber-500" />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                        El tiempo de hoy ya supera este límite. La app se bloqueará al guardar.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── SECCIÓN 3: ENFOQUE AVANZADO (NEURO-UX) ─────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-amber-500/10 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              Enfoque Avanzado (Neuro-UX)
            </h3>
          </div>

          <div className="space-y-5 pl-6">
            {/* Bionic Reading */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Lectura Biónica (Bionic Fixation)</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Resalta el inicio de las palabras para acelerar el escaneo mental del texto.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={bionicReading} onChange={setBionicReading} />
              </div>
            </div>

            {/* Lighthouse Mode */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Modo Faro (Lighthouse)</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Crea una guía luminosa horizontal para no perder la línea al leer PDF.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={lighthouseMode} onChange={setLighthouseMode} />
              </div>
            </div>

            {/* Eye Pulse */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Pulso Ocular 20-20-20</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Un indicador visual sutil cada 20 minutos para prevenir fatiga.</p>
              </div>
              <div className="mt-0.5">
                <Toggle checked={eyePulse} onChange={setEyePulse} />
              </div>
            </div>

            {/* Ambient Sound */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-foreground">Ambiente Sonoro Envolvente</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'none', label: 'Sin Sonido' },
                  { id: 'rain', label: 'Lluvia' },
                  { id: 'white', label: 'Ruido Blanco' },
                  { id: 'cafe', label: 'Cafetería' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setAmbientSound(s.id as any)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[9px] font-medium transition-all border",
                      ambientSound === s.id 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
