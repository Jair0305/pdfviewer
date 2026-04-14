"use client";

import { useEffect, useState } from "react";
import { useUXStore } from "@/state/ux.store";
import { IconBellRinging, IconX, IconCoffee } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REMINDER_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes

export function HealthMonitor() {
  const { healthReminders } = useUXStore();
  const [show, setShow] = useState(false);
  const [lastReset, setLastReset] = useState(Date.now());

  useEffect(() => {
    if (!healthReminders) {
      setShow(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastReset >= REMINDER_INTERVAL_MS) {
        setShow(true);
      }
    }, 1000 * 60); // Check every minute

    return () => clearInterval(interval);
  }, [healthReminders, lastReset]);

  if (!show) return null;

  return (
    <div className="fixed bottom-12 right-6 z-[10000] animate-in slide-in-from-right-10 duration-500 ease-out">
      <div className="flex w-72 flex-col gap-3 rounded-xl border border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-primary/10">
        <div className="flex items-start justify-between">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconCoffee size={18} />
          </div>
          <button 
            onClick={() => { setShow(false); setLastReset(Date.now()); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconX size={14} />
          </button>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-tight">Tiempo de descanso</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Has estado en flujo profundo por 50 minutos. 
            Tómate 5 minutos para estirarte y descansar la vista.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button 
            size="sm" 
            className="h-7 flex-1 text-[11px] font-bold uppercase tracking-wider"
            onClick={() => { setShow(false); setLastReset(Date.now()); }}
          >
            Entendido
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[11px] text-muted-foreground"
            onClick={() => { setShow(false); setLastReset(Date.now() + 10 * 60 * 1000); }} // Postpone 10 min
          >
            En 10 min
          </Button>
        </div>
      </div>
    </div>
  );
}
