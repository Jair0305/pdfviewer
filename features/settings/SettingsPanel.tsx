"use client";

import {
  IconSettings2,
  IconFolderOpen,
  IconFolderCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
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
    readingModeStartHour, setReadingModeStartHour
  } = useUXStore();

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
              <Button 
                variant={privacyBlur ? "default" : "outline"} 
                size="sm" 
                className={cn("h-6 w-10 shrink-0 px-0 transition-all", privacyBlur && "bg-primary text-primary-foreground")}
                onClick={() => setPrivacyBlur(!privacyBlur)}
              >
                <span className="text-[9px] font-bold">{privacyBlur ? "ON" : "OFF"}</span>
              </Button>
            </div>

            {/* Foveal Focus */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-foreground">Foveal Focus</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Atenúa sutilmente los archivos vecinos en el explorador.</p>
              </div>
              <Button 
                variant={fovealFocus ? "default" : "outline"} 
                size="sm" 
                className={cn("h-6 w-10 shrink-0 px-0 transition-all", fovealFocus && "bg-primary text-primary-foreground")}
                onClick={() => setFovealFocus(!fovealFocus)}
              >
                <span className="text-[9px] font-bold">{fovealFocus ? "ON" : "OFF"}</span>
              </Button>
            </div>

            <Separator className="opacity-50" />

            {/* Auto Reading Mode */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium text-foreground">Modo Lectura Automático</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Filtro de descanso visual basado en la hora local (24h).</p>
                </div>
                <Button 
                  variant={autoReadingMode ? "default" : "outline"} 
                  size="sm" 
                  className={cn("h-6 w-12 shrink-0 px-0 transition-all", autoReadingMode && "bg-amber-500 hover:bg-amber-600 text-white")}
                  onClick={() => setAutoReadingMode(!autoReadingMode)}
                >
                  <span className="text-[9px] font-bold">{autoReadingMode ? "AUTO" : "MANUAL"}</span>
                </Button>
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
          </div>
        </section>
      </div>
    </div>
  );
}
