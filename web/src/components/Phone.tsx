"use client";
// El teléfono de SuperKid: solo datos reales del snapshot (estación, radar, pronóstico diario de la DACC).
// No hay pronóstico por hora en ninguna fuente oficial, así que acá no se muestra ninguno.
import { useEffect, useRef } from "react";
import { ForecastIcon, Stars } from "@/components/ui";
import { timeMza } from "@/lib/copy";
import { frameLocal } from "@/lib/radar";
import type { Snapshot } from "@/lib/status";

const DAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const NA = "—";

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border border-teal/40 bg-teal/5 px-1.5 py-1.5">
      <span className="truncate font-typewriter text-[10px] tracking-[1px] text-teal/80">{k}</span>
      <span className="font-mono text-[15px] font-bold tabular-nums text-cream">{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 px-3 pt-2.5">
      <h3 className="font-typewriter text-[12px] tracking-[2px] text-sun">{title}</h3>
      {children}
    </section>
  );
}

export function Phone({ depto, snap, onClose }: { depto: string; snap: Snapshot | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const zone = snap?.zones[depto as keyof Snapshot["zones"]];
  const station = snap?.stations.find((s) => s.departamento === depto && s.temp !== null) ?? snap?.stations.find((s) => s.departamento === depto);
  const rayos = snap ? snap.rayos.filter((r) => r.departamento === depto).length : null;
  const frame = snap?.frames.at(-1);
  const hails = zone?.sources.filter((r) => r.dato.fenomeno === "granizo") ?? [];
  const today = snap ? new Date(Date.parse(snap.at) - 3 * 3600_000).toISOString().slice(0, 10) : "";
  const todays = snap?.forecast.find((f) => f.fecha === today) ?? snap?.forecast[0];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Teléfono de SuperKid: datos del tiempo" onClick={(e) => e.stopPropagation()}
        className="relative w-[320px] max-w-full animate-[pop_.25s_ease-out]">
        <div className="rounded-[44px] border-[3px] border-black bg-[#1b1b1f] p-[7px] shadow-[0_0_0_2px_rgba(255,244,232,.18)]">
          <div className="relative flex h-[min(620px,82dvh)] flex-col overflow-hidden rounded-[36px] bg-[#0B0716]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 opacity-[.07]" style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px)" }} />
            <span aria-hidden="true" className="absolute left-1/2 top-2 z-30 h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-black" />

            <div className="flex items-center justify-between px-6 pb-1 pt-2.5 font-mono text-[13px] font-bold text-cream">
              <span>{snap ? timeMza(snap.at) : NA}</span>
              <button ref={closeRef} onClick={onClose} aria-label="Cerrar el teléfono" className="relative z-40 -mr-2 flex size-11 items-center justify-center text-cream">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <div className="flex items-end justify-between border-b-2 border-teal/50 px-4 pb-2">
                <div className="flex flex-col leading-none">
                  <span className="font-typewriter text-[11px] tracking-[3px] text-teal">SUPERKID · METEO</span>
                  <span className="mt-1 font-display text-[32px] uppercase tracking-wide text-cream">{depto}</span>
                </div>
                <div className="flex flex-col items-end leading-none">
                  <span className="font-mono text-[42px] font-bold tabular-nums text-sun">{station?.temp != null ? `${station.temp}°` : NA}</span>
                  <span className="max-w-[150px] truncate font-typewriter text-[11px] text-muted">{station ? `${station.nombre.toUpperCase()} · ${timeMza(station.read_at)}` : "SIN ESTACIÓN"}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1 px-3 pt-2.5">
                <Cell k="HUMEDAD" v={station?.humedad != null ? `${station.humedad}%` : NA} />
                <Cell k="LLUVIA" v={station?.precipitacion != null ? `${station.precipitacion}mm` : NA} />
                <Cell k="RAYOS 5′" v={rayos === null || snap?.mode === "replay" ? NA : String(rayos)} />
                <div className="flex min-w-0 flex-col justify-between border border-teal/40 bg-teal/5 px-1.5 py-1.5">
                  <span className="font-typewriter text-[10px] tracking-[1px] text-teal/80">NIVEL</span>
                  <Stars level={zone?.level ?? 0} size={12} />
                </div>
              </div>

              <Section title="RADAR · GRANIZO">
                <p className="font-mono text-[13px] leading-snug text-cream">
                  {frame ? `Último cuadro ${frameLocal(frame)}` : "Sin cuadros de radar"}
                </p>
                {hails.length ? hails.map((h) => (
                  <p key={String(h.dato.paraje)} className="border-l-4 border-pink bg-pink/10 px-2 py-1 font-mono text-[13px] leading-snug text-cream">
                    {String(h.dato.paraje)} · prob. {String(h.dato.probabilidad)} % · {String(h.dato.area_km2)} km²
                  </p>
                )) : <p className="font-mono text-[13px] text-muted">Sin impactos de granizo en {depto}.</p>}
              </Section>

              {todays && (
                <Section title="PRONÓSTICO DACC · HOY">
                  <p className="font-mono text-[13px] leading-snug text-cream">{todays.texto.replace(/\s+/g, " ")}</p>
                </Section>
              )}

              <Section title="PRÓXIMOS DÍAS">
                {snap?.forecast.length ? (
                  <ul className="flex flex-col">
                    {snap.forecast.slice(0, 4).map((f) => (
                      <li key={f.fecha} className="grid grid-cols-[40px_26px_1fr] items-center gap-2 border-b border-white/10 py-1 font-mono text-[14px] tabular-nums">
                        <span className="font-bold text-cream">{DAYS[new Date(f.fecha + "T12:00:00-03:00").getDay()]}</span>
                        <ForecastIcon name={f.imagen} storm={/tormenta|granizo/i.test(f.texto)} />
                        <span className="text-right text-cream">{f.maxima}° <span className="text-muted">/ {f.minima}°</span></span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="font-mono text-[13px] text-muted">Sin pronóstico disponible.</p>}
              </Section>
            </div>
            <span aria-hidden="true" className="mx-auto my-2 h-1 w-24 shrink-0 rounded-full bg-cream/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
