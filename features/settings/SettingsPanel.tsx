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
import { useIsElectron } from "@/hooks/useIsElectron";

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

      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        <FolderSetting
          label="Carpeta de clientes"
          description='Raíz del Dropbox compartido con clientes. Se usa para calcular la ruta relativa de cada expediente, que es la clave estable entre máquinas.'
          value={clientesFolder}
          placeholder="Sin configurar — las revisiones se identifican solo por nombre de carpeta"
          onPick={() => pick(setClientesFolder)}
          onClear={() => setClientesFolder(null)}
          disabled={!inElectron}
        />

        <Separator />

        <FolderSetting
          label="Carpeta de revisiones"
          description='Dropbox del equipo donde se guardan los JSON de revisión. La estructura de carpetas aquí espeja exactamente la de Clientes.'
          value={revisionesFolder}
          placeholder="Sin configurar — las respuestas no se guardan en disco"
          onPick={() => pick(setRevisionesFolder)}
          onClear={() => setRevisionesFolder(null)}
          disabled={!inElectron}
        />
      </div>
    </div>
  );
}
