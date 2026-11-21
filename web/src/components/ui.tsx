"use client";
import Image from "next/image";
import { freezeScenario, stopScenario, type ActiveScenario } from "./useApp";
import { DEMO, SCENARIOS } from "@/lib/scenarios";
import { timeMza } from "@/lib/copy";

const STAR = "M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z";

export function Stars({ level, size = 22, on = "#FFC94B", off = "#7C6A99", stroke }: { level: number; size?: number; on?: string; off?: string; stroke?: string }) {
  return (
    <div role="img" aria-label={`Nivel ${level} de 5`} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={i <= level ? on : "none"} stroke={i <= level ? stroke ?? "none" : off} strokeWidth="1.5">
          <path d={STAR} />
        </svg>
      ))}
    </div>
  );
}

/** Logo oficial (public/superkid/logo.webp, 6:5). `size` es el alto en px. */
export function Logo({ size = 56 }: { size?: number }) {
  return <Image src="/superkid/logo.webp" alt="SuperKid" width={Math.round(size * 1.2)} height={size} priority className="drop-shadow-[0_3px_0_rgba(0,0,0,.45)]" />;
}

export function Disclaimer({ children }: { children?: React.ReactNode }) {
  return <p className="text-xs text-muted">{children}{children ? " · " : ""}No reemplaza las alertas oficiales · Emergencias: 911</p>;
}

/** Always visible during a replay or simulation, so it is never mistaken for a live alert. */
export function ScenarioBar({ scenario }: { scenario: ActiveScenario | null }) {
  if (!scenario) return null;
  const s = SCENARIOS[scenario.id];
  return (
    <div className="sticky top-0 z-[1000] bg-sun px-4 py-1.5 text-night">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm tracking-widest">{s.label} · {timeMza(scenario.at)} · {s.note}</span>
        <button onClick={stopScenario} className="min-h-11 rounded-full border-2 border-night px-3 text-xs font-bold">Salir</button>
      </div>
      {scenario.id === "maipu" && (
        <div role="group" aria-label="Clima de la simulación" className="flex gap-1.5 pb-1">
          {DEMO.map((d) => (
            <button key={d.id} onClick={() => freezeScenario(d.min)} aria-pressed={scenario.frozen === d.min}
              className={`min-h-9 flex-1 rounded-full border-2 border-night text-xs font-bold ${scenario.frozen === d.min ? "bg-night text-sun" : ""}`}>{d.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pin() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
    </svg>
  );
}

export function Sunset({ height = 300, children }: { height?: number; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden" style={{ height, background: "linear-gradient(180deg,#2A0F4A 0%,#8A1F6B 45%,#FF4F7B 72%,#FF9A3C 100%)" }}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice">
        <circle cx="270" cy="236" r="70" fill="#FFC94B" opacity="0.9" />
        <rect x="190" y="214" width="160" height="4" fill="#FF6F5E" />
        <rect x="190" y="228" width="160" height="6" fill="#FF6F5E" />
        <rect x="190" y="244" width="160" height="8" fill="#FF6F5E" />
        <path d="M0 300 L0 238 L46 196 L86 226 L132 168 L176 214 L214 186 L262 232 L300 204 L346 240 L390 214 L390 300 Z" fill="#3B1050" />
        <path d="M0 300 L0 262 L70 240 L140 258 L210 236 L290 262 L390 244 L390 300 Z" fill="#170A2B" />
      </svg>
      {children}
    </div>
  );
}

export function ForecastIcon({ name, storm }: { name: string; storm: boolean }) {
  const n = name.toLowerCase();
  if (storm)
    return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF8FB5" strokeWidth="2"><path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 15zM12 15l-2 4h3l-2 4" /></svg>;
  if (n.includes("despejado") || n.includes("soleado"))
    return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFC94B" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2EE6D6" strokeWidth="2"><path d="M7 17h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 17z" /></svg>;
}

/** Comic speech bubble ("nube de texto") with the tail pointing down at the character. */
export function SpeechBubble({ children }: { children: React.ReactNode }) {
  return (
    <div aria-live="polite" className="relative animate-[pop_.25s_ease-out] rounded-[22px] border-[3px] border-night bg-cream px-4 py-3.5 text-night shadow-[4px_4px_0_#000]">
      {children}
      <span aria-hidden="true" className="absolute -bottom-[11px] left-[38%] size-5 rotate-45 border-b-[3px] border-r-[3px] border-night bg-cream" />
    </div>
  );
}

/** GTA-style wanted level: the stars are the alert level (0–5). Pulses from level 4. */
export function Wanted({ level }: { level: number }) {
  return (
    <div className={`flex shrink-0 items-center rounded-[10px] border-[3px] border-black bg-night/90 px-2 py-2.5 shadow-[3px_3px_0_#000] ${level >= 4 ? "animate-pulse" : ""}`}>
      <Stars level={level} size={16} />
    </div>
  );
}
