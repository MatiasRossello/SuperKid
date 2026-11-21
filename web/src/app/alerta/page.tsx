"use client";
import Link from "next/link";
import { useState } from "react";
import { Disclaimer, ScenarioBar, Stars } from "@/components/ui";
import { useDepto, useSnapshot } from "@/components/useApp";
import { headline, LEVEL_NAME, mission, timeMza, topReason } from "@/lib/copy";

export default function Alerta() {
  const [depto] = useDepto();
  const { snap, scenario } = useSnapshot();
  const [done, setDone] = useState<Set<number>>(new Set());
  if (!depto) return null;
  const zone = snap?.zones[depto];
  const top = zone && topReason(zone.sources);

  return (
    <main className="flex flex-col pb-10">
      <ScenarioBar scenario={scenario} />
      <div className="px-5 pt-14">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-teal">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
          Inicio
        </Link>
      </div>

      <section className="mt-4 flex flex-col gap-1.5 px-6 py-6" style={{ background: "linear-gradient(160deg,#FF2E88 0%,#FF6F5E 55%,#FF9A3C 100%)" }}>
        <span className="font-display text-base tracking-[3px] text-night">{zone && zone.level >= 3 ? "ALERTA ACTIVA" : "ESTADO ACTUAL"}</span>
        <h1 className="font-display text-[52px] leading-[0.95]" style={{ textShadow: "4px 4px 0 #170A2B" }}>
          {zone ? headline(zone.level, zone.sources, depto) : "CARGANDO…"}
        </h1>
        {top?.dato.paraje && <span className="text-[15px] font-semibold text-night">Cerca de {top.dato.paraje}</span>}
        <div className="mt-2.5"><Stars level={zone?.level ?? 0} size={28} on="#170A2B" off="rgba(23,10,43,0.4)" /></div>
      </section>

      {zone && (
        <div className="flex flex-col gap-3.5 px-5 pt-6">
          <p className="text-[15px] leading-snug text-lilac">{zone.summary}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-card px-3.5 py-3">
              <span className="text-xs text-muted">Detectado</span>
              <span className="text-lg font-bold">{top ? timeMza(top.at) : "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-card px-3.5 py-3">
              <span className="text-xs text-muted">{top?.dato.probabilidad !== undefined ? "Probabilidad" : "Nivel"}</span>
              <span className="text-lg font-bold">{top?.dato.probabilidad !== undefined ? `${top.dato.probabilidad} %` : LEVEL_NAME[zone.level]}</span>
            </div>
          </div>

          {mission(zone.sources).length > 0 && (
            <>
              <h2 className="font-display text-[15px] tracking-[2px] text-sun">TU MISIÓN</h2>
              <ul className="flex flex-col gap-1">
                {mission(zone.sources).map((m, i) => (
                  <li key={m}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
                      <input type="checkbox" className="peer sr-only" checked={done.has(i)} onChange={() => setDone((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-teal peer-checked:bg-teal peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-teal">
                        {done.has(i) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#170A2B" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>}
                      </span>
                      <span className={done.has(i) ? "text-muted line-through" : ""}>{m}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Link href="/mapa" className="mt-1.5 flex h-[52px] items-center justify-center rounded-full bg-teal font-display text-lg tracking-wider text-night">VER EN EL RADAR</Link>
          <Disclaimer>Fuente: {[...new Set(zone.sources.map((s) => s.fuente))].join(", ") || "DACC"}</Disclaimer>
        </div>
      )}
    </main>
  );
}
