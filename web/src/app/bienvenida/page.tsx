"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/ui";
import { ZoneWheel } from "@/components/ZoneWheel";
import { freezeScenario, useDepto } from "@/components/useApp";
import { type Departamento } from "@/lib/departamentos";

const PUSH_NOTE = "sk-push-note";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

function explainPush(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/push service not available/i.test(msg)) return "Tu navegador no pudo conectar con el servicio de notificaciones. En Firefox pasa en ventana privada, sin conexión, o con las notificaciones del sistema apagadas.";
  if (/denied|not allowed|permission/i.test(msg)) return "Sin permiso de notificaciones: podés activarlas desde los ajustes del navegador.";
  return "No pudimos registrar las alertas. Probá de nuevo en un rato.";
}

async function activeRegistration() {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (!worker) return reg;
  await Promise.race([
    new Promise<void>((resolve) => {
      if (worker.state === "activated") return resolve();
      worker.addEventListener("statechange", () => { if (worker.state === "activated" || worker.state === "redundant") resolve(); });
    }),
    sleep(4000),
  ]);
  return reg;
}

async function subscribePush(depto: Departamento): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "Este navegador no soporta notificaciones push.";
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "Las alertas push todavía no están configuradas.";
  if ((await Notification.requestPermission()) !== "granted") return "Sin permiso de notificaciones: podés activarlas desde los ajustes del navegador.";
  const reg = await activeRegistration();
  const applicationServerKey = b64ToBytes(key);
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
      const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), departamento: depto }) });
      if (r.ok) return null;
      if (r.status === 503) return "Las alertas no se pueden guardar todavía: falta conectar la base de datos.";
      return "No pudimos guardar las alertas. Probá de nuevo en un rato.";
    } catch (e) {
      last = e;
      if (!/push service not available/i.test(e instanceof Error ? e.message : "") || i === 2) break;
      await sleep(700 * (i + 1));
    }
  }
  return explainPush(last);
}

type Geo = "idle" | "locating" | "found" | "failed";

export default function Bienvenida() {
  const [saved, setDepto] = useDepto();
  const [picked, setLocal] = useState<Departamento | "">("");
  const depto = picked || saved || ""; // untouched select shows the saved one
  const [geo, setGeo] = useState<Geo>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);
  const ios = useSyncExternalStore(
    () => () => {},
    () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches,
    () => false,
  );
  const router = useRouter();

  const locate = () => {
    if (!navigator.geolocation) { setGeo("failed"); return setMsg("Tu navegador no comparte la ubicación. Elegí el departamento de la lista."); }
    setGeo("locating");
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const { departamentoAt } = await import("@/lib/geo"); // 70 KB of polygons, only when asked
        const d = departamentoAt(p.coords.latitude, p.coords.longitude);
        if (d) { setLocal(d); setGeo("found"); }
        else { setGeo("failed"); setMsg("Parece que estás fuera de Mendoza. Elegí un departamento."); }
      },
      (e) => { setGeo("failed"); setMsg(e.code === e.PERMISSION_DENIED ? "Sin permiso de ubicación. Podés elegir tu departamento a mano." : "No pudimos leer tu ubicación. Elegí el departamento de la lista."); },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  // First visit: ask for the GPS right away, as the game asks for your name at the gate.
  useEffect(() => {
    if (saved === null && !asked.current) { asked.current = true; locate(); }
  }, [saved]);

  const enter = async (withPush: boolean) => {
    if (!depto) return setMsg("Elegí tu departamento primero.");
    setDepto(depto);
    if (withPush) {
      setBusy(true);
      const err = await subscribePush(depto).catch(explainPush);
      setBusy(false);
      if (err) { try { sessionStorage.setItem(PUSH_NOTE, err); } catch { /* private mode */ } }
    }
    router.push("/");
  };

  const choosing = geo === "failed" || (geo === "idle" && saved !== null);
  const btn = "h-14 w-full rounded-md border-[3px] border-black font-display text-xl uppercase tracking-wider shadow-[4px_4px_0_#000] active:translate-x-px active:translate-y-px active:shadow-[2px_2px_0_#000] disabled:opacity-60";

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-black">
      <Image src="/superkid/entrada.webp" alt="SuperKid parado frente a la entrada del parque, con su paraguas" fill priority sizes="480px" className="object-cover object-top" />
      {/* viñeta y grano: pantalla de carga vieja, sin degradados de color */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black via-black/60 via-35% to-transparent to-60%" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.14] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>\")" }} />

      <header className="relative z-10 flex flex-col items-center gap-1 pt-[max(env(safe-area-inset-top),24px)]">
        <Logo size={150} />
      </header>

      <div className="relative z-10 mt-auto flex flex-col gap-3 px-6 pb-[max(env(safe-area-inset-bottom),20px)]">
        {geo === "found" && (
          <div role="status" className="flex flex-col">
            <span className="font-typewriter text-[11px] tracking-[3px] text-sun">ZONA DETECTADA</span>
            <span className="font-display text-5xl uppercase leading-none tracking-wide text-cream [text-shadow:3px_3px_0_#000]">{depto}</span>
          </div>
        )}
        {geo === "locating" && <p role="status" className="font-typewriter text-sm tracking-[3px] text-cream">UBICANDO<span className="animate-pulse">…</span></p>}
        {geo === "idle" && saved === null && <p className="font-typewriter text-sm text-cream/90">Necesito saber dónde estás.</p>}

        {choosing && (
          <div className="flex flex-col items-center gap-1">
            <ZoneWheel value={depto} onChange={setLocal} />
            <button onClick={locate} className="flex min-h-11 items-center gap-1.5 font-typewriter text-xs text-cream underline underline-offset-4">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
              USAR MI UBICACIÓN (GPS)
            </button>
          </div>
        )}

        {geo === "idle" && saved === null && (
          <button onClick={locate} className={`${btn} bg-cream text-black`}>Activar ubicación</button>
        )}
        {(geo === "found" || choosing) && (
          <>
            <button onClick={() => enter(false)} disabled={!depto || busy} className={`${btn} bg-cream text-black`}>Entrar</button>
            <button onClick={() => enter(true)} disabled={!depto || busy} className="min-h-11 font-typewriter text-xs text-cream/80 underline underline-offset-4">
              {busy ? "Activando…" : "Entrar y avisarme por notificación"}
            </button>
          </>
        )}

        {msg && <p role="status" className="font-typewriter text-xs text-sun">{msg}</p>}
        {ios && <p className="font-typewriter text-xs text-cream/80">iPhone: Compartir → “Agregar a inicio” para recibir alertas.</p>}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => { setDepto("Maipú"); freezeScenario(12); router.push("/"); }} className="min-h-11 font-typewriter text-[11px] text-cream/60 underline underline-offset-4">Ver simulación</button>
          <p className="text-right font-typewriter text-[10px] text-cream/50">DACC Mendoza · No reemplaza las alertas oficiales</p>
        </div>
      </div>
    </main>
  );
}
