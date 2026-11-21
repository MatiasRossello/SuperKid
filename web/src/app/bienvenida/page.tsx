"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/ui";
import { freezeScenario, useDepto } from "@/components/useApp";
import { DEPARTAMENTOS, type Departamento } from "@/lib/departamentos";

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function subscribePush(depto: Departamento): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "Este navegador no soporta notificaciones push.";
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "Las alertas push todavía no están configuradas.";
  if ((await Notification.requestPermission()) !== "granted") return "Sin permiso de notificaciones: podés activarlas desde los ajustes del navegador.";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
  const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), departamento: depto }) });
  return r.ok ? null : "No pudimos registrar las alertas. Probá de nuevo en un rato.";
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
      const err = await subscribePush(depto).catch((e: Error) => e.message);
      setBusy(false);
      if (err) return setMsg(err + " Igual te mostramos el estado en la app.");
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
          <div className="border-[3px] border-black bg-black/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="zona" className="font-display text-lg uppercase tracking-wide text-cream">Elegí tu zona</h2>
              <button onClick={locate} className="flex min-h-9 items-center gap-1.5 border-2 border-cream/70 px-2.5 font-typewriter text-[11px] text-cream active:bg-cream/10">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
                USAR GPS
              </button>
            </div>
            <div role="radiogroup" aria-labelledby="zona" className="grid max-h-[30dvh] grid-cols-3 gap-1.5 overflow-y-auto">
              {[...DEPARTAMENTOS].sort((a, b) => a.localeCompare(b, "es")).map((d) => (
                <button key={d} role="radio" aria-checked={depto === d} onClick={() => setLocal(d)}
                  className={`min-h-10 border-2 px-1 font-display text-[12px] uppercase leading-tight tracking-wide ${depto === d ? "border-sun bg-sun text-black" : "border-cream/30 text-cream"}`}>{d}</button>
              ))}
            </div>
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
