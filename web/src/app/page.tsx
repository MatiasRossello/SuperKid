"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo, Pin, ScenarioBar, SpeechBubble, Wanted } from "@/components/ui";
import { useDepto, useSnapshot } from "@/components/useApp";
import { answer, moodOf, POSES, type Mood } from "@/lib/chat";
import { headline, timeMza } from "@/lib/copy";

// Weather tint over the background road scene.
const TINT: Record<Mood, string> = {
  calma: "linear-gradient(180deg, rgba(255,160,60,.08), rgba(23,10,43,.35))",
  lluvia: "linear-gradient(180deg, rgba(20,30,70,.72), rgba(30,60,110,.55))",
  granizo: "linear-gradient(180deg, rgba(25,22,45,.82), rgba(60,60,85,.6))",
  viento: "linear-gradient(180deg, rgba(120,60,20,.5), rgba(200,120,50,.35))",
};
const FX: Record<Mood, string> = { calma: "", lluvia: "fx-rain", granizo: "fx-hail", viento: "fx-wind" };

export default function Home() {
  const [depto] = useDepto();
  const { snap, error, scenario } = useSnapshot();
  const router = useRouter();
  const [asked, setAsked] = useState<string | null>(null); // null = hasn't asked yet
  const [thinking, setThinking] = useState(false);
  const [text, setText] = useState("");
  const [turns, setTurns] = useState(0); // each question rotates the pose
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { if (depto === null) router.replace("/bienvenida"); }, [depto, router]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!depto) return null;

  const zone = snap?.zones[depto];
  const level = zone?.level ?? 0;
  // A real alert is never hidden behind the greeting: from level 3 the character already reacts.
  const alarming = level >= 3;
  const showing = !thinking && (asked !== null || alarming || scenario?.frozen !== undefined); // a demo preset reacts right away
  const mood: Mood = showing && zone ? moodOf(level, zone.sources) : "calma";
  const reply = showing && snap ? answer(asked ?? "", depto, snap) : null;
  const pose = (turns % POSES[mood]) + 1;

  const ask = (q: string) => {
    const t = q.trim() || "¿Cómo está el tiempo?";
    setText(""); setAsked(t); setTurns((n) => n + 1); setThinking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setThinking(false), 1100);
  };

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-night">
      <ScenarioBar scenario={scenario} />

      {/* fondo: la entrada al parque, teñida según el clima */}
      <Image src="/superkid/fondo.webp" alt="" fill priority sizes="480px" className="object-cover object-bottom" />
      <div aria-hidden="true" className="absolute inset-0 transition-[background] duration-700" style={{ background: TINT[mood] }} />
      {FX[mood] && <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${FX[mood]}`} />}

      <header className="relative z-10 flex items-start justify-between px-4 pt-[max(env(safe-area-inset-top),14px)]">
        <div className="flex flex-col gap-1.5">
          <Logo size={28} />
          <Link href="/bienvenida" aria-label={`Ubicación: ${depto}. Cambiar`} className="flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-night/70 px-3 text-sm font-semibold backdrop-blur-sm">
            <Pin />{depto}{snap && <span className="text-xs font-normal text-muted">· {timeMza(snap.at)}</span>}
          </Link>
        </div>
        <Wanted level={level} />
      </header>

      <section className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pt-3">
        <SpeechBubble>
          {thinking ? (
            <p className="flex h-10 items-center gap-1.5" aria-label="SuperKid está pensando">
              {[0, 1, 2].map((i) => <span key={i} className="size-2.5 animate-bounce rounded-full bg-night" style={{ animationDelay: `${i * 120}ms` }} />)}
            </p>
          ) : reply && zone ? (
            <div className="flex flex-col gap-1">
              
              {reply.intent === "general" && <h1 className="font-display text-2xl leading-none tracking-wide text-pink">{headline(level, zone.sources, depto)}</h1>}
              <p className="text-sm font-semibold leading-snug">{reply.text}</p>
            </div>
          ) : error && !snap ? (
            <p className="text-[15px] font-semibold leading-snug">No pude traer los datos oficiales. Reintento en un minuto.</p>
          ) : asked !== null ? (
            <p className="text-[15px] font-semibold leading-snug">Dame un segundo, estoy trayendo los datos oficiales…</p>
          ) : (
            <p className="text-[15px] font-semibold leading-snug">¡Ey! Soy SuperKid. Preguntame cómo está el tiempo en <b>{depto}</b>.</p>
          )}
        </SpeechBubble>

        <div className="relative mt-3 min-h-0 flex-1">
          <Image key={`${mood}-${pose}`} src={`/superkid/${mood}-${pose}.webp`} alt={`SuperKid, ${mood === "calma" ? "tranquilo" : `con ${mood}`}`} fill priority sizes="480px"
            className="animate-[fadein_.4s_ease-out] object-contain object-bottom drop-shadow-[0_8px_0_rgba(0,0,0,.35)]" />
          <nav aria-label="Acciones" className="absolute bottom-2 right-0 flex flex-col gap-3">
            <Link href="/mapa" aria-label="Abrir el mapa" className="flex size-14 flex-col items-center justify-center rounded-full border-2 border-teal bg-night/80 text-teal backdrop-blur-sm">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7zM9 4v13M15 7v13" /></svg>
              <span className="font-display text-[10px] tracking-wider">MAPA</span>
            </Link>
          </nav>
        </div>
      </section>

      <footer className="relative z-10 flex flex-col gap-2.5 bg-gradient-to-t from-night via-night/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-4">
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2">
          <label htmlFor="pregunta" className="sr-only">Preguntale a SuperKid sobre el tiempo</label>
          <input id="pregunta" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} enterKeyHint="send" autoComplete="off"
            placeholder="Preguntale a SuperKid…" className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-card px-4 text-base text-cream placeholder:text-muted" />
          <button type="submit" aria-label="Enviar pregunta" disabled={thinking} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pink disabled:opacity-60">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF4E8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l16-8-6 16-3-7z" /></svg>
          </button>
        </form>
        <p className="text-center text-[10px] text-muted">Datos oficiales DACC · No reemplaza las alertas oficiales · 911</p>
      </footer>
    </main>
  );
}
