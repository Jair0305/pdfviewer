"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useUXStore } from "@/state/ux.store";
import { useAudioFeedback } from "@/hooks/useAudioFeedback";
import { IconX, IconCoffee, IconClock, IconLock } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REMINDER_INTERVAL_S = 50 * 60; // 50 minutes in seconds

/** Format seconds to H:MM:SS */
function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

export function HealthMonitor() {
  const { 
    healthReminders, 
    sessionTimer, 
    dailyLimitEnabled, 
    dailyLimitHours, 
    totalDailyTime, 
    lastSessionReset,
    ambientSound,
    eyePulse,
    addTime,
    resetTotalTime 
  } = useUXStore();

  const { playEyePulse } = useAudioFeedback();

  const [mounted, setMounted] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showEyePulse, setShowEyePulse] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());
  const [internalTime, setInternalTime] = useState(0);

  // Audio Context Ref for Ambient Sounds
  const ambientCtxRef = useRef<AudioContext | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const ambientSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    setMounted(true);
    setInternalTime(totalDailyTime);
  }, [totalDailyTime]);

  // Check for daily reset
  useEffect(() => {
    const lastReset = new Date(lastSessionReset);
    const now = new Date();
    if (lastReset.toDateString() !== now.toDateString()) {
      resetTotalTime();
    }
  }, [lastSessionReset, resetTotalTime]);

  // Main time tracking pulse (every second)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaS = Math.floor((now - lastCheckTime) / 1000);
      
      if (deltaS >= 1) {
        addTime(deltaS);
        setInternalTime(prev => prev + deltaS);
        setLastCheckTime(now);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastCheckTime, addTime]);

  // 20-20-20 Eye Pulse Logic
  useEffect(() => {
    if (!eyePulse || !mounted) return;
    
    const interval = setInterval(() => {
      setShowEyePulse(true);
      playEyePulse();
      setTimeout(() => setShowEyePulse(false), 20000); // 20s pulse
    }, 20 * 60 * 1000); // 20 mins

    return () => clearInterval(interval);
  }, [eyePulse, mounted, playEyePulse]);

  // Ambient Sound Logic
  useEffect(() => {
    if (!mounted) return;

    const stopAmbient = () => {
      if (ambientSourceRef.current) {
        ambientSourceRef.current.stop();
        ambientSourceRef.current = null;
      }
    };

    if (ambientSound === 'none') {
      stopAmbient();
      return;
    }

    try {
      if (!ambientCtxRef.current) {
        ambientCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        ambientGainRef.current = ambientCtxRef.current.createGain();
        ambientGainRef.current.connect(ambientCtxRef.current.destination);
      }

      const ctx = ambientCtxRef.current;
      const gain = ambientGainRef.current!;
      
      stopAmbient();

      // Simple Noise Generator
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        // High-pass / Low-pass filtering for different sounds
        const white = Math.random() * 2 - 1;
        
        if (ambientSound === 'rain') {
          // Brownian noise (approx)
          const brown = (lastOut + (0.02 * white)) / 1.02;
          output[i] = brown * 3.5;
          lastOut = brown;
        } else if (ambientSound === 'white') {
          output[i] = white * 0.5;
        } else if (ambientSound === 'cafe') {
          // Mid-range pinkish noise
          const pink = (lastOut + (0.1 * white)) / 1.1;
          output[i] = pink * 2;
          lastOut = pink;
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      source.connect(gain);
      
      // Low volume for ambient
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 2);
      
      source.start();
      ambientSourceRef.current = source;

    } catch (e) {
      console.error("Ambient sound failed", e);
    }

    return () => stopAmbient();
  }, [ambientSound, mounted]);

  // 50-minute break reminder logic
  useEffect(() => {
    if (!healthReminders) {
      setShowReminder(false);
      return;
    }
    
    // sessionSeconds tracks current focus session since load
    const sessionSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
    if (sessionSeconds > 0 && sessionSeconds % REMINDER_INTERVAL_S === 0) {
      setShowReminder(true);
    }
  }, [internalTime, healthReminders, sessionStartTime]);

  if (!mounted) return null;

  const isLocked = dailyLimitEnabled && internalTime >= dailyLimitHours * 3600;

  return (
    <>
      {/* ── Eye Pulse Indicator (20-20-20) ────────────────────────────── */}
      {showEyePulse && (
        <div className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-full bg-blue-500/10 px-2 py-1 backdrop-blur-sm border border-blue-500/20 animate-in fade-in duration-500">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          <span className="text-[10px] font-medium text-blue-500/80">Regla 20-20-20: Mira lejos</span>
        </div>
      )}

      {/* ── Lock Screen Overlay ────────────────────────────────────────── */}
      {isLocked && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-background/80 backdrop-blur-2xl animate-in fade-in duration-1000">
          <div className="flex max-w-md flex-col items-center gap-6 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-500/10 text-red-500 shadow-inner">
              <IconLock size={40} strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Límite Diario Alcanzado</h2>
              <p className="text-muted-foreground leading-relaxed">
                Has alcanzado tu límite de trabajo de <span className="font-bold text-foreground">{dailyLimitHours} horas</span>. 
                Tu salud mental es prioridad. La aplicación se ha bloqueado para fomentar un descanso real.
              </p>
            </div>
            <div className="w-full rounded-xl bg-muted/50 p-4 border border-border/50">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Tiempo de hoy</p>
              <p className="font-mono text-xl font-bold">{formatDuration(internalTime)}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">Vuelve mañana para continuar con nuevas energías.</p>
          </div>
        </div>
      )}

      {/* ── Floating WakaTime-style Timer ─────────────────────────────── */}
      {sessionTimer && !isLocked && (
        <div className="fixed bottom-3 right-3 z-[9999] group">
          <div className="flex items-center gap-2.5 rounded-full border border-border/40 bg-background/80 px-3 py-1.5 shadow-lg backdrop-blur-md transition-all hover:pr-4 hover:border-primary/30">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <IconClock size={12} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/60 leading-none">Hoy</span>
              <span className="font-mono text-[11px] font-bold tabular-nums leading-tight">
                {formatDuration(internalTime)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Health Reminder Popup ────────────────────────────────────── */}
      {showReminder && !isLocked && (
        <div className="fixed bottom-16 right-6 z-[10000] animate-in slide-in-from-right-10 duration-500 ease-out">
          <div className="flex w-72 flex-col gap-3 rounded-xl border border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-primary/10">
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconCoffee size={18} />
              </div>
              <button 
                onClick={() => setShowReminder(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconX size={14} />
              </button>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">Tiempo de descanso</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Has estado enfocado sin parar. 
                Tómate 5 minutos para estirarte y descansar la vista.
              </p>
            </div>

            <Button 
              size="sm" 
              className="h-7 w-full text-[11px] font-bold uppercase tracking-wider"
              onClick={() => setShowReminder(false)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
