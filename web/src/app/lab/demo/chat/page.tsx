"use client";
// Scripted demo: one question walks SuperKid through lluvia → tormenta → granizo → Zonda → calma in Godoy Cruz.
// Same look as the home (animated backgrounds, map, phone). Each stage builds a fictitious snapshot with the same
// code the /lab/demo uses, so the phone and the map show data that matches what SuperKid is saying.
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Backdrop } from "@/components/Backdrop";
import { Phone } from "@/components/Phone";
import { Logo, Pin, SpeechBubble, Wanted } from "@/components/ui";
import { startDemo } from "@/components/useApp";
import { POSES, type Mood } from "@/lib/chat";
import { addDays, mendozaToday, type DemoConfig, type DemoDay } from "@/lib/demo";
import { demoSnapshot } from "@/lib/demo-snapshot";
import type { Snapshot } from "@/lib/status";

const DEPTO = "Godoy Cruz";

type Stage = { text: string; level: number; mood: Mood; day: Omit<DemoDay, "date"> };

const STAGES: Stage[] = [
  { text: "En Godoy Cruz, de 13 a 15 hay lluvias leves.", level: 2, mood: "lluvia", day: { condition: "lluvia", mm: 4, max: 24, min: 15 } },
  { text: "De 15 a 20, lluvias fuertes y posibles tormentas.", level: 4, mood: "lluvia", day: { condition: "lluvia", mm: 38, max: 22, min: 14 } },
  { text: "También puede caer granizo fuerte en la zona.", level: 5, mood: "granizo", day: { condition: "granizo", prob: 95, area_km2: 220, max: 21, min: 13 } },
  { text: "Más tarde entra viento Zonda con ráfagas fuertes.", level: 3, mood: "viento", day: { condition: "zonda", max: 33, min: 18 } },
  { text: "Al final mejora y queda todo tranqui en Godoy Cruz.", level: 0, mood: "calma", day: { condition: "calma", max: 27, min: 16 } },
];
const CALM: Stage["day"] = { condition: "calma", max: 27, min: 16 };

/** Fictitious 3-day config for a stage: today follows the script, the next two days are calm. */
function stageConfig(day: Stage["day"]): DemoConfig {
  const today = mendozaToday();
  return {
    departamento: DEPTO,
    days: [{ ...day, date: today }, { ...CALM, date: addDays(today, 1) }, { condition: "calma", max: 29, min: 18, date: addDays(today, 2) }],
  };
}

/** The scripted level wins over the computed one, so the phone's stars match the WANTED badge. */
function stageSnapshot(stage: Stage | null): Snapshot {
  const snap = demoSnapshot(stageConfig(stage?.day ?? CALM));
  if (stage) snap.zones[DEPTO] = { ...snap.zones[DEPTO], level: stage.level };
  return snap;
}

export default function DemoChat() {
  const router = useRouter();
  const [asked, setAsked] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<number>(-1);
  const [turns, setTurns] = useState(0);
  const [phone, setPhone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  const showing = !thinking && stage >= 0;
  const current = showing ? STAGES[stage] : null;
  const mood: Mood = current?.mood ?? "calma";
  const level = current?.level ?? 0;
  const pose = (turns % POSES[mood]) + 1;
  // Only built after a tap (phone open or a stage running): reading the clock at build time breaks the prerender.
  const snap = phone ? stageSnapshot(current) : null;

  const ask = (q: string) => {
    const t = q.trim() || "Dame el clima en Godoy Cruz para hoy";
    clearTimers();
    setText("");
    setAsked(t);
    setStage(-1);
    setThinking(true);
    setTurns((n) => n + 1);

    timers.current.push(setTimeout(() => {
      setThinking(false);
      setStage(0);
      setTurns((n) => n + 1);
    }, 900));

    // Auto-advance through all animation stages.
    STAGES.slice(1).forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setStage(i + 1);
        setTurns((n) => n + 1);
      }, 900 + (i + 1) * 3200));
    });
  };

  // The map reads the global demo state: start it with the stage on screen, then open /mapa.
  const openMap = () => {
    clearTimers();
    startDemo(stageConfig((current ?? STAGES[0]).day));
    router.push("/mapa");
  };

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-night">
      <Backdrop mood={mood} />

      <header className="relative z-10 flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <Logo size={52} />
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-[10px] border-[3px] border-black bg-night/90 shadow-[3px_3px_0_#000]">
          <span className="flex w-8 shrink-0 items-center justify-center bg-sun text-black"><span className="animate-pulse"><Pin /></span></span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2 py-1 leading-none">
            <span className="truncate font-display text-xl uppercase tracking-wide text-cream [text-shadow:2px_2px_0_#000]">{DEPTO}</span>
          </span>
          <span className="flex shrink-0 items-end border-l-2 border-dashed border-line px-1.5 pb-1 font-typewriter text-[11px] text-pink">DEMO</span>
        </div>
        <Wanted level={level} />
      </header>

      <section className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pt-3">
        <SpeechBubble>
          {thinking ? (
            <p className="flex h-10 items-center gap-1.5" aria-label="SuperKid está pensando">
              {[0, 1, 2].map((i) => <span key={i} className="size-2.5 animate-bounce rounded-full bg-night" style={{ animationDelay: `${i * 120}ms` }} />)}
            </p>
          ) : current ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold leading-snug">{current.text}</p>
            </div>
          ) : asked !== null ? (
            <p className="text-[15px] font-semibold leading-snug">Dame un segundo, estoy trayendo los datos oficiales…</p>
          ) : (
            <p className="text-[15px] font-semibold leading-snug">¡Ey! Soy SuperKid. Preguntame cómo está el tiempo en <b>{DEPTO}</b>.</p>
          )}
        </SpeechBubble>

        <div className="relative mt-3 min-h-0 flex-1">
          <Image key={`${mood}-${pose}`} src={`/superkid/${mood}-${pose}.webp`} alt={`SuperKid, ${mood === "calma" ? "tranquilo" : `con ${mood}`}`} fill priority sizes="480px"
            className="animate-[fadein_.4s_ease-out] object-contain object-bottom drop-shadow-[0_8px_0_rgba(0,0,0,.35)]" />
          <button onClick={openMap} aria-label="Abrir el mapa (demo)" className="absolute bottom-1 left-0 flex w-24 items-center drop-shadow-[0_4px_0_rgba(0,0,0,.45)] active:scale-95">
            <Image src="/superkid/mapa.webp" alt="" width={96} height={98} sizes="96px" />
          </button>
          <button onClick={() => setPhone(true)} aria-label="Abrir el teléfono: datos del tiempo (demo)" className="absolute bottom-1 right-0 flex w-20 items-center drop-shadow-[0_4px_0_rgba(0,0,0,.45)] active:scale-95">
            <Image src="/superkid/telefono.webp" alt="" width={80} height={80} sizes="80px" />
          </button>
        </div>
      </section>

      <footer className="relative z-10 flex flex-col gap-2.5 bg-gradient-to-t from-night via-night/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-4">
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <label htmlFor="pregunta" className="sr-only">Preguntale a SuperKid sobre el tiempo</label>
          <div className="relative flex items-center rounded-[10px] border-[3px] border-black bg-[#120824]/95 shadow-[4px_4px_0_#000] transition-shadow focus-within:shadow-[4px_4px_0_#2EE6D6]">
            <span aria-hidden="true" className="flex w-11 shrink-0 items-center justify-center text-sun">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg>
            </span>
            <input id="pregunta" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} enterKeyHint="send" autoComplete="off"
              placeholder="DAME EL CLIMA EN GODOY CRUZ…" className="h-[52px] min-w-0 flex-1 bg-transparent pr-14 font-typewriter text-[15px] tracking-wide text-cream outline-none placeholder:text-muted/70" />
            <button type="submit" aria-label="Enviar pregunta" disabled={thinking}
              className="absolute right-1.5 top-1.5 flex size-10 items-center justify-center rounded-md border-2 border-black bg-pink shadow-[2px_2px_0_#000] transition-transform active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-60">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF4E8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7" /></svg>
            </button>
          </div>
        </form>
        <p className="text-center text-[10px] text-muted">Demo con datos ficticios · No reemplaza las alertas oficiales · 911</p>
      </footer>
      {phone && snap && <Phone depto={DEPTO} snap={snap} onClose={() => setPhone(false)} />}
    </main>
  );
}
