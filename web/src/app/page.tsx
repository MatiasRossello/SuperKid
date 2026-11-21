"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Phone } from "@/components/Phone";
import { Logo, Pin, ScenarioBar, SpeechBubble, Wanted } from "@/components/ui";
import { useDepto, useSnapshot } from "@/components/useApp";
import { answer, moodOf, POSES, type Mood } from "@/lib/chat";
import { headline, timeMza } from "@/lib/copy";

// Animated background per weather (public/superkid/bg-*.mp4). Calm has no video: static road + warm tint.
const BG: Partial<Record<Mood, string>> = { lluvia: "lluvia", granizo: "granizo", viento: "viento" };

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeMotion = (cb: () => void) => { const m = matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

function Backdrop({ mood }: { mood: Mood }) {
  const still = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);
  const bg = BG[mood];
  if (!bg) return (
    <>
      <Image src="/superkid/fondo.webp" alt="" fill priority sizes="480px" className="object-cover object-bottom" />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,160,60,.08), rgba(23,10,43,.35))" }} />
    </>
  );
  return still
    ? <Image src={`/superkid/bg-${bg}.webp`} alt="" fill sizes="480px" className="object-cover" />
    : <video key={bg} aria-hidden="true" autoPlay loop muted playsInline preload="auto" poster={`/superkid/bg-${bg}.webp`} className="absolute inset-0 size-full animate-[fadein_.5s_ease-out] object-cover">
        <source src={`/superkid/bg-${bg}.mp4`} type="video/mp4" />
      </video>;
}

export default function Home() {
  const [depto] = useDepto();
  const { snap, error, scenario } = useSnapshot();
  const router = useRouter();
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null); // null = hasn't asked yet
  const [thinking, setThinking] = useState(false);
  const [text, setText] = useState("");
  const [phone, setPhone] = useState(false);
  const [turns, setTurns] = useState(0); // each question rotates the pose
  const [said, setSaid] = useState<{ q: string; text: string } | null>(null); // model's answer to `asked`
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<AbortController>(undefined);

  useEffect(() => { if (depto === null) router.replace("/bienvenida"); }, [depto, router]);
  useEffect(() => () => { clearTimeout(timer.current); pending.current?.abort(); }, []);
  useEffect(() => {
    try {
      const note = sessionStorage.getItem("sk-push-note");
      if (!note) return;
      sessionStorage.removeItem("sk-push-note");
      setPushNote(note);
    } catch { /* private mode */ }
  }, []);
  if (!depto) return null;

  const zone = snap?.zones[depto];
  const level = zone?.level ?? 0;
  // A real alert is never hidden behind the greeting: from level 3 the character already reacts.
  const alarming = level >= 3;
  const showing = !thinking && (asked !== null || alarming || scenario?.frozen !== undefined); // a demo preset reacts right away
  const mood: Mood = showing && zone ? moodOf(level, zone.sources) : "calma";
  const local = showing && snap ? answer(asked ?? "", depto, snap) : null;
  // The model's text replaces the rule-based one; both stand on the same official data.
  const reply = local && said && said.q === asked ? { ...local, text: said.text } : local;
  const pose = (turns % POSES[mood]) + 1;

  const ask = (q: string) => {
    const t = q.trim() || "¿Cómo está el tiempo?";
    setText(""); setAsked(t); setSaid(null); setTurns((n) => n + 1); setThinking(true);
    clearTimeout(timer.current);
    pending.current?.abort();
    const ctl = (pending.current = new AbortController());
    const minWait = new Promise((r) => setTimeout(r, 700)); // the dots always show for a beat
    const sc = scenario?.at ? { scenario: scenario.id, at: scenario.at } : {};
    const call = fetch("/api/chat", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ pregunta: t, departamento: depto, ...sc }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { text?: string } | null) => { if (j?.text) setSaid({ q: t, text: j.text }); })
      .catch(() => {}); // offline or aborted → the rule-based reply stays
    timer.current = setTimeout(() => ctl.abort(), 15_000);
    Promise.all([call, minWait]).then(() => { if (pending.current === ctl) { clearTimeout(timer.current); setThinking(false); } });
  };

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-night">
      <ScenarioBar scenario={scenario} />

      <Backdrop mood={mood} />

      <header className="relative z-10 flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <Logo size={52} />
        <Link href="/bienvenida" aria-label={`Zona: ${depto}. Tocá para cambiar`}
          className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-[10px] border-[3px] border-black bg-night/90 shadow-[3px_3px_0_#000] transition-transform active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_#000]">
          <span className="flex w-8 shrink-0 items-center justify-center bg-sun text-black"><span className="animate-pulse"><Pin /></span></span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2 py-1 leading-none">
            <span className="font-typewriter text-[9px] tracking-[2px] text-sun">ZONA</span>
            <span className="truncate font-display text-xl uppercase tracking-wide text-cream [text-shadow:2px_2px_0_#000]">{depto}</span>
          </span>
          {snap && <span className="flex shrink-0 items-end border-l-2 border-dashed border-line px-1.5 pb-1 font-typewriter text-[11px] text-teal">{timeMza(snap.at)}</span>}
        </Link>
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
          <Link href="/mapa" aria-label="Abrir el mapa" className="absolute bottom-1 left-0 flex w-24 items-center drop-shadow-[0_4px_0_rgba(0,0,0,.45)] active:scale-95">
            <Image src="/superkid/mapa.webp" alt="" width={96} height={98} sizes="96px" />
          </Link>
          <button onClick={() => setPhone(true)} aria-label="Abrir el teléfono: datos del tiempo" className="absolute bottom-1 right-0 flex w-20 items-center drop-shadow-[0_4px_0_rgba(0,0,0,.45)] active:scale-95">
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
              placeholder="PREGUNTALE A SUPERKID…" className="h-[52px] min-w-0 flex-1 bg-transparent pr-14 font-typewriter text-[15px] tracking-wide text-cream outline-none placeholder:text-muted/70" />
            <button type="submit" aria-label="Enviar pregunta" disabled={thinking}
              className="absolute right-1.5 top-1.5 flex size-10 items-center justify-center rounded-md border-2 border-black bg-pink shadow-[2px_2px_0_#000] transition-transform active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-60">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF4E8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7" /></svg>
            </button>
          </div>
        </form>
      </footer>
      {phone && <Phone depto={depto} snap={snap} onClose={() => setPhone(false)} />}
    </main>
  );
}
