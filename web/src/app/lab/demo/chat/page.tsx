"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Logo, Pin, SpeechBubble, Wanted } from "@/components/ui";
import { POSES, type Mood } from "@/lib/chat";

type Stage = { text: string; level: number; mood: Mood };

const STAGES: Stage[] = [
  { text: "En Godoy Cruz, de 13 a 15 hay lluvias leves.", level: 2, mood: "lluvia" },
  { text: "De 15 a 20, lluvias fuertes y posibles tormentas.", level: 4, mood: "lluvia" },
  { text: "También puede caer granizo fuerte en la zona.", level: 5, mood: "granizo" },
  { text: "Más tarde entra viento Zonda con ráfagas fuertes.", level: 3, mood: "viento" },
  { text: "Al final mejora y queda todo tranqui en Godoy Cruz.", level: 0, mood: "calma" },
];

const TINT: Record<Mood, string> = {
  calma: "linear-gradient(180deg, rgba(255,160,60,.08), rgba(23,10,43,.35))",
  lluvia: "linear-gradient(180deg, rgba(20,30,70,.72), rgba(30,60,110,.55))",
  granizo: "linear-gradient(180deg, rgba(25,22,45,.82), rgba(60,60,85,.6))",
  viento: "linear-gradient(180deg, rgba(120,60,20,.5), rgba(200,120,50,.35))",
};
const FX: Record<Mood, string> = { calma: "", lluvia: "fx-rain", granizo: "fx-hail", viento: "fx-wind" };

export default function DemoChat() {
  const depto = "Godoy Cruz";
  const [asked, setAsked] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<number>(-1);
  const [turns, setTurns] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  const showing = !thinking && stage >= 0;
  const current = showing ? STAGES[stage] : null;
  const mood: Mood = current?.mood ?? "calma";
  const level = current?.level ?? 0;
  const pose = (turns % POSES[mood]) + 1;

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

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-night">
      <Image src="/superkid/fondo.webp" alt="" fill priority sizes="480px" className="object-cover object-bottom" />
      <div aria-hidden="true" className="absolute inset-0 transition-[background] duration-700" style={{ background: TINT[mood] }} />
      {FX[mood] && <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${FX[mood]}`} />}

      <header className="relative z-10 flex items-start justify-between px-4 pt-[max(env(safe-area-inset-top),14px)]">
        <div className="flex flex-col gap-1.5">
          <Logo size={28} />
          <div className="flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-night/70 px-3 text-sm font-semibold backdrop-blur-sm">
            <Pin />{depto}
          </div>
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
            <p className="text-[15px] font-semibold leading-snug">¡Ey! Soy SuperKid. Preguntame cómo está el tiempo en <b>{depto}</b>.</p>
          )}
        </SpeechBubble>

        <div className="relative mt-3 min-h-0 flex-1">
          <Image key={`${mood}-${pose}`} src={`/superkid/${mood}-${pose}.webp`} alt={`SuperKid, ${mood === "calma" ? "tranquilo" : `con ${mood}`}`} fill priority sizes="480px"
            className="animate-[fadein_.4s_ease-out] object-contain object-bottom drop-shadow-[0_8px_0_rgba(0,0,0,.35)]" />
        </div>
      </section>

      <footer className="relative z-10 flex flex-col gap-2.5 bg-gradient-to-t from-night via-night/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-4">
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2">
          <label htmlFor="pregunta" className="sr-only">Preguntale a SuperKid sobre el tiempo</label>
          <input id="pregunta" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} enterKeyHint="send" autoComplete="off"
            placeholder="Dame el clima en Godoy Cruz para hoy" className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-card px-4 text-base text-cream placeholder:text-muted" />
          <button type="submit" aria-label="Enviar pregunta" disabled={thinking} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pink disabled:opacity-60">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF4E8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l16-8-6 16-3-7z" /></svg>
          </button>
        </form>
        <p className="text-center text-[10px] text-muted">Datos oficiales DACC · No reemplaza las alertas oficiales · 911</p>
      </footer>
    </main>
  );
}
