"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Layers } from "@/components/RadarMap";
import { ReplayBar } from "@/components/ui";
import { useDepto, useSnapshot } from "@/components/useApp";
import { headline, timeMza, topReason } from "@/lib/copy";
import { frameLocal } from "@/lib/radar";

const RadarMap = dynamic(() => import("@/components/RadarMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-map" /> });

const PILLS: [keyof Layers, string][] = [["dbz", "Radar"], ["granizo", "Granizo"], ["rayos", "Rayos"]];

export default function Mapa() {
  const [depto] = useDepto();
  const { snap, replayAt } = useSnapshot();
  const [layers, setLayers] = useState<Layers>({ dbz: true, granizo: true, rayos: true });
  const [idx, setIdx] = useState<number | null>(null); // null = follow the latest frame
  const [playing, setPlaying] = useState(false);
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

  return (
    <main className="relative h-dvh overflow-hidden bg-map">
      <RadarMap frame={frame} layers={layers} depto={depto ?? ""} levels={levels} rayos={snap?.rayos ?? []} />

      <div className="absolute inset-x-0 top-0 z-[1000]">
        <ReplayBar at={replayAt} />
        <div className="flex items-center justify-between px-4 pt-3">
          <Link href="/" aria-label="Volver" className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-teal bg-map/85">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2EE6D6" strokeWidth="2.2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
          </Link>
          <div className="flex items-center gap-2 rounded-full border-[1.5px] border-pink bg-map/85 px-4 py-2.5">
            <span className={`size-2 rounded-full bg-pink ${idx === null && !replayAt ? "animate-pulse" : ""}`} />
            <span className="font-display text-sm tracking-[1.5px]">
              {replayAt ? "REPLAY" : idx === null ? "EN VIVO" : "HISTORIAL"} · {frame ? frameLocal(frame) : "--:--"}
            </span>
          </div>
          <span className="size-11" />
        </div>
        <div className="flex gap-2 px-4 pt-3" role="group" aria-label="Capas del mapa">
          {PILLS.map(([k, label]) => (
            <button key={k} aria-pressed={layers[k]} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              className={`h-9 rounded-full px-3.5 text-[13px] font-bold ${layers[k] ? "bg-teal text-map" : "border-[1.5px] border-[#5B6F8E] bg-map/85 text-cream"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="absolute right-4 top-[calc(100%+12px)] flex flex-col gap-1.5 rounded-xl bg-map/85 p-2.5 text-[11px]">
          <span className="text-[#C2CEE0]">Reflectividad</span>
          <span aria-hidden="true" className="h-2.5 w-24 rounded" style={{ background: "linear-gradient(90deg,#1E7A1E,#2F6FE0,#F5D10A,#F03C1E,#C42AD0)" }} />
          <div className="flex justify-between text-[#C2CEE0]"><span>débil</span><span>fuerte</span></div>
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm bg-[#FF0000]" />Granizo</div>
          <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sun" />Rayo (5 min)</div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col gap-3.5 rounded-t-3xl border-t-2 border-pink bg-night px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { if (!playing && idx === null) setIdx(0); setPlaying((p) => !p); }} disabled={frames.length < 2}
            aria-label={playing ? "Pausar" : "Reproducir los últimos 30 minutos"} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sun disabled:opacity-50">
            {playing
              ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#170A2B"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
              : <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#170A2B"><path d="M7 4l13 8-13 8z" /></svg>}
          </button>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="frame" className="sr-only">Momento del radar</label>
            <input id="frame" type="range" min={0} max={Math.max(frames.length - 1, 0)} value={Math.max(current, 0)}
              onChange={(e) => { setPlaying(false); const v = Number(e.target.value); setIdx(v === frames.length - 1 ? null : v); }}
              className="w-full accent-pink" />
            <div className="flex justify-between text-[11px] text-muted">
              <span>{frames[0] ? frameLocal(frames[0]) : ""}</span>
              <span>{frames.at(-1) ? frameLocal(frames.at(-1)!) : ""}</span>
            </div>
          </div>
        </div>
        {zone && depto && (
          <Link href={zone.level >= 3 ? "/alerta" : "/"} className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-bold">{headline(zone.level, zone.sources, depto, false)}</span>
              {top?.dato.probabilidad !== undefined && <span className="font-display text-lg text-pink">{top.dato.probabilidad} %</span>}
            </div>
            <span className="text-[13px] text-[#E3D6EE]">{zone.summary}</span>
            <span className="text-xs text-muted">Radar DACC · {top ? timeMza(top.at) : timeMza(zone.updated_at)} · No reemplaza las alertas oficiales</span>
          </Link>
        )}
      </div>
    </main>
  );
}
