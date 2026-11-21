"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Layers } from "@/components/RadarMap";
import { ScenarioBar } from "@/components/ui";
import { useDepto, useSnapshot } from "@/components/useApp";
import { answer } from "@/lib/chat";
import { headline, timeMza, topReason } from "@/lib/copy";
import { frameLocal } from "@/lib/radar";

const RadarMap = dynamic(() => import("@/components/RadarMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-[#8E8266]" /> });

const PILLS: [keyof Layers, string][] = [["dbz", "Radar"], ["granizo", "Granizo"], ["rayos", "Rayos"]];

// Mismo lenguaje que el resto de la app: bordes negros gruesos y sombras duras, sin redondeados ni rosa.
const HARD = "border-[3px] border-black shadow-[3px_3px_0_#000]";

export default function Mapa() {
  const [depto] = useDepto();
  const { snap, scenario, demo } = useSnapshot();
  const replayAt = scenario?.at ?? null;
  const [layers, setLayers] = useState<Layers>({ dbz: true, granizo: true, rayos: true });
  const [idx, setIdx] = useState<number | null>(null); // null = follow the latest frame
  const [playing, setPlaying] = useState(false);
  // Next (cacheComponents) conserva la pantalla anterior oculta y, al volver, "reconecta" sus efectos.
  // Leaflet no sobrevive a eso (el mapa ya se destruyó y las capas se agregan a la nada: "appendChild of undefined"),
  // así que el mapa se monta de cero cada vez que la pantalla se muestra y se desmonta cuando se oculta.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(true); // eslint-disable-line react-hooks/set-state-in-effect
    return () => setShown(false);
  }, []);
  const frames = snap?.frames ?? [];
  const current = idx ?? frames.length - 1;

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(() => setIdx((i) => ((i ?? 0) + 1) % frames.length), 600);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const levels = Object.fromEntries(Object.entries(snap?.zones ?? {}).map(([d, z]) => [d, z.level]));
  const zone = depto ? snap?.zones[depto] : undefined;
  const top = zone && topReason(zone.sources);
  const frame = frames[current];
  const reply = depto && snap ? answer("", depto, snap) : null; // mismo texto que SuperKid: solo datos, sin consejos

  return (
    <main className="relative h-dvh overflow-hidden bg-[#8E8266]">
      {shown && <RadarMap frame={frame} layers={layers} depto={depto ?? ""} levels={levels} rayos={snap?.rayos ?? []} cells={snap?.cells ?? []} />}

      <div className="absolute inset-x-0 top-0 z-[1000]">
        <ScenarioBar scenario={scenario} demo={demo} />
        <div className="flex items-center justify-between px-3 pt-3">
          <Link href="/" aria-label="Volver" className={`flex size-11 items-center justify-center rounded-[10px] bg-cream text-black ${HARD} active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_#000]`}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </Link>
          <div className={`flex items-center gap-2 rounded-[10px] bg-black px-3 py-2 ${HARD}`}>
            <span className={`size-2.5 bg-[#E4202E] ${idx === null && !replayAt ? "animate-pulse" : ""}`} />
            <span className="font-typewriter text-sm tracking-[1.5px] text-cream">
              {scenario ? (scenario.id === "replay" ? "REPLAY" : "SIMULACIÓN") : idx === null ? "EN VIVO" : "HISTORIAL"} · {frame ? frameLocal(frame) : scenario && snap ? timeMza(snap.at) : "--:--"}
            </span>
          </div>
          <span className="size-11" />
        </div>
        <div className="flex gap-2 px-3 pt-3" role="group" aria-label="Capas del mapa">
          {PILLS.map(([k, label]) => (
            <button key={k} aria-pressed={layers[k]} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              className={`min-h-10 rounded-[8px] px-3.5 font-display text-sm uppercase tracking-wider ${HARD} active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_#000] ${layers[k] ? "bg-sun text-black" : "bg-black/80 text-cream"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className={`absolute right-3 top-[calc(100%+12px)] flex flex-col gap-1.5 rounded-[10px] bg-cream p-2.5 text-black ${HARD}`}>
          <span className="font-typewriter text-[10px] tracking-[1.5px]">REFLECTIVIDAD</span>
          <span aria-hidden="true" className="h-2.5 w-24 border-2 border-black" style={{ background: "linear-gradient(90deg,#1E7A1E,#2F6FE0,#F5D10A,#F03C1E,#C42AD0)" }} />
          <div className="flex justify-between font-typewriter text-[10px]"><span>débil</span><span>fuerte</span></div>
          <div className="flex items-center gap-1.5 font-typewriter text-[11px]"><span className="h-2.5 w-3.5 border-2 border-black bg-[#FF0000]" />Granizo</div>
          <div className="flex items-center gap-1.5 font-typewriter text-[11px]"><span className="size-2.5 rounded-full border-2 border-black bg-sun" />Rayo (5 min)</div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col gap-3 border-t-[4px] border-black bg-night px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        {frames.length > 0 && <div className="flex items-center gap-3">
          <button onClick={() => { if (!playing && idx === null) setIdx(0); setPlaying((p) => !p); }} disabled={frames.length < 2}
            aria-label={playing ? "Pausar" : "Reproducir los últimos 30 minutos"} className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-sun ${HARD} active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_#000] disabled:opacity-50`}>
            {playing
              ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
              : <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M7 4l13 8-13 8z" /></svg>}
          </button>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="frame" className="sr-only">Momento del radar</label>
            <input id="frame" type="range" min={0} max={Math.max(frames.length - 1, 0)} value={Math.max(current, 0)}
              onChange={(e) => { setPlaying(false); const v = Number(e.target.value); setIdx(v === frames.length - 1 ? null : v); }}
              className="w-full accent-[#FFC94B]" />
            <div className="flex justify-between font-typewriter text-[11px] text-muted">
              <span>{frames[0] ? frameLocal(frames[0]) : ""}</span>
              <span>{frames.at(-1) ? frameLocal(frames.at(-1)!) : ""}</span>
            </div>
          </div>
        </div>}
        {zone && depto && reply && (
          <Link href="/" className={`flex flex-col gap-1 rounded-[10px] bg-cream px-4 py-3 text-black ${HARD}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-2xl uppercase leading-none tracking-wide">{headline(zone.level, zone.sources, depto, false)}</span>
              {top?.dato.probabilidad !== undefined && <span className="font-display text-xl text-[#C1121F]">{top.dato.probabilidad} %</span>}
            </div>
            <span className="text-sm font-semibold leading-snug">{reply.text}</span>
            <span className="font-typewriter text-[11px] text-black/60">{top ? `${top.fuente} · ${timeMza(top.at)}` : `DACC · ${timeMza(zone.updated_at)}`} · No reemplaza las alertas oficiales</span>
          </Link>
        )}
      </div>
    </main>
  );
}
