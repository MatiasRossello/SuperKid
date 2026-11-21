"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Disclaimer, ForecastIcon, Logo, Pin, ReplayBar, Stars, Sunset } from "@/components/ui";
import { useDepto, useSnapshot } from "@/components/useApp";
import { headline, timeMza, topReason } from "@/lib/copy";
import { frameLocal } from "@/lib/radar";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Home() {
  const [depto] = useDepto();
  const { snap, error, replayAt } = useSnapshot();
  const router = useRouter();
  useEffect(() => { if (depto === null) router.replace("/bienvenida"); }, [depto, router]);
  if (!depto) return null;

  const zone = snap?.zones[depto];
  const top = zone && topReason(zone.sources);
  const lastFrame = snap?.frames.at(-1);
  const stations = snap?.stations.filter((s) => s.departamento === depto) ?? [];
  const wettest = stations.sort((a, b) => (b.precipitacion ?? 0) - (a.precipitacion ?? 0))[0];
  const rayos = snap?.rayos.filter((r) => r.departamento === depto).length ?? 0;
  const hot = (zone?.level ?? 0) >= 3;

  return (
    <main className="pb-10">
      <ReplayBar at={replayAt} />
      <Sunset>
        <div className="absolute inset-x-6 top-14 flex items-center justify-between">
          <Logo />
          <Link href="/bienvenida" aria-label="Cambiar departamento y alertas" className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-cream/50 bg-night/35">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF4E8" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
          </Link>
        </div>
        <div className="absolute left-6 top-28 flex items-center gap-2">
          <Pin />
          <span className="text-sm font-semibold">{depto}</span>
          {snap && <span className="text-[13px] text-[#FFE3D0]">· {timeMza(snap.at)}</span>}
        </div>
      </Sunset>

      <section aria-live="polite" className={`relative mx-4 -mt-16 flex flex-col gap-3 rounded-[20px] border-[1.5px] bg-card p-5 ${hot ? "border-pink shadow-[0_0_0_4px_rgba(255,46,136,0.15)]" : "border-line"}`}>
        <div className="flex items-center justify-between">
          <span className="font-display text-[15px] tracking-[2px] text-sun">NIVEL DE ALERTA</span>
          <Stars level={zone?.level ?? 0} />
        </div>
        {!zone ? (
          <p className="text-muted">{error ? "No pudimos cargar los datos. Reintentamos en un minuto." : "Cargando datos oficiales…"}</p>
        ) : (
          <>
            <h1 className="font-display text-[34px] leading-[1.05] tracking-wide">{headline(zone.level, zone.sources, depto)}</h1>
            <p className="text-[15px] leading-snug text-lilac">{zone.summary}</p>
            <p className="text-xs text-muted">
              {top ? `Fuente: ${zone.sources.map((s) => `${s.fuente} ${timeMza(s.at)}`).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}` : `Fuentes: radar DACC, estaciones y pronóstico DACC · ${timeMza(zone.updated_at)}`}
            </p>
            {zone.level >= 3 && (
              <Link href="/alerta" className="flex h-12 items-center justify-center rounded-full bg-pink font-display text-lg tracking-wider">VER QUÉ HACER</Link>
            )}
          </>
        )}
      </section>

      <div className="flex gap-3 px-4 pt-5">
        <Link href="/mapa" aria-label="Abrir el mapa del radar" className="relative block size-[150px] shrink-0 overflow-hidden rounded-full border-[3px] border-teal" style={{ background: "radial-gradient(circle,#1D2F4A 0%,#121A30 70%)" }}>
          <svg aria-hidden="true" width="150" height="150" viewBox="0 0 150 150" className="absolute inset-0">
            <path d="M10 60 L40 40 L80 50 L120 30 L140 70 L120 120 L70 135 L30 110 Z" fill="none" stroke="#3E5A7E" strokeWidth="1.5" />
            <circle cx="75" cy="75" r="60" fill="none" stroke="#2C4363" />
            <circle cx="75" cy="75" r="35" fill="none" stroke="#2C4363" />
            <circle cx="75" cy="75" r="6" fill="#FFF4E8" stroke="#170A2B" strokeWidth="2" />
          </svg>
          <span className="absolute inset-x-0 bottom-3.5 text-center font-display text-xs tracking-[2px] text-teal">
            {replayAt ? "RADAR REPLAY" : "RADAR EN VIVO"}
            {lastFrame && <span className="block text-[11px] text-cream">{frameLocal(lastFrame)}</span>}
          </span>
        </Link>
        <div className="flex flex-1 flex-col gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-card px-3.5 py-3">
            <span className="text-xs text-muted">{wettest ? `Estación ${wettest.nombre}` : "Estaciones DACC"}</span>
            <span className="text-lg font-bold">{wettest?.precipitacion != null ? `${wettest.precipitacion} mm` : "Sin dato"}</span>
            <span className="text-xs text-muted">{wettest ? `precipitación · ${timeMza(wettest.read_at)}` : replayAt ? "no guardadas en el replay" : "sin estación en el depto"}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-[14px] bg-card px-3.5 py-3">
            <span className="text-xs text-muted">Rayos en {depto}</span>
            <span className="text-lg font-bold">{replayAt ? "Sin dato" : rayos}</span>
            <span className="text-xs text-muted">últimos 5 min · GOES/GLM</span>
          </div>
        </div>
      </div>

      {!!snap?.forecast.length && (
        <section className="flex flex-col gap-2.5 px-4 pt-5">
          <h2 className="font-display text-[15px] tracking-[2px] text-sun">PRÓXIMOS DÍAS</h2>
          <div className="grid grid-cols-4 gap-2">
            {snap.forecast.slice(0, 4).map((f) => (
              <div key={f.fecha} className="flex flex-col items-center gap-1 rounded-xl bg-card px-2 py-2.5" title={f.texto}>
                <span className="text-xs font-semibold">{DAYS[new Date(f.fecha + "T12:00:00-03:00").getDay()]}</span>
                <ForecastIcon name={f.imagen} storm={/tormenta|granizo/i.test(f.texto)} />
                <span className="text-[13px]">{f.maxima}°/{f.minima}°</span>
              </div>
            ))}
          </div>
          <Disclaimer>Pronóstico DACC</Disclaimer>
        </section>
      )}
      {!snap?.forecast.length && <div className="px-4 pt-5"><Disclaimer /></div>}
    </main>
  );
}
