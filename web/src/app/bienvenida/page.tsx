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

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-night">
      <Image src="/superkid/entrada.webp" alt="SuperKid parado frente a la entrada del parque, con su paraguas" fill priority sizes="480px" className="object-cover object-top" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-night via-night/55 via-45% to-transparent to-70%" />

      <header className="relative z-10 flex flex-col items-center gap-1 pt-[max(env(safe-area-inset-top),20px)]">
        <span className="text-[11px] font-bold tracking-[4px] text-cream drop-shadow">BIENVENIDOS A</span>
        <Logo size={54} />
      </header>

      <div className="relative z-10 mt-auto flex flex-col gap-3 px-6 pb-[max(env(safe-area-inset-bottom),20px)]">
        <p className="text-base font-semibold leading-snug text-cream drop-shadow">Antes de pasar, SuperKid necesita saber dónde estás para avisarte del tiempo en tu zona.</p>

        {geo === "locating" && (
          <p role="status" className="flex h-14 items-center justify-center gap-2 rounded-full border-2 border-teal bg-night/70 font-display tracking-wider text-teal">
            <span className="size-2.5 animate-ping rounded-full bg-teal" />BUSCANDO TU UBICACIÓN…
          </p>
        )}

        {geo === "found" && (
          <p role="status" className="text-center font-display text-3xl tracking-wide text-sun">ESTÁS EN {depto.toUpperCase()}</p>
        )}

        {choosing && (
          <div className="flex gap-2">
            <label htmlFor="depto" className="sr-only">Tu departamento</label>
            <select id="depto" value={depto} onChange={(e) => setLocal(e.target.value as Departamento)} className="h-[52px] min-w-0 flex-1 rounded-[14px] border-[1.5px] border-line bg-card px-3.5 text-base text-cream">
              <option value="" disabled>Elegí tu departamento</option>
              {[...DEPARTAMENTOS].sort((a, b) => a.localeCompare(b, "es")).map((d) => <option key={d}>{d}</option>)}
            </select>
            <button onClick={locate} aria-label="Usar mi ubicación (GPS)" className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-teal bg-card">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2EE6D6" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
            </button>
          </div>
        )}

        {geo === "idle" && saved === null && (
          <button onClick={locate} className="h-14 rounded-full bg-teal font-display text-xl tracking-wider text-night">ACTIVAR UBICACIÓN (GPS)</button>
        )}

        {(geo === "found" || choosing) && (
          <>
            <button onClick={() => enter(false)} disabled={!depto || busy} className="h-14 rounded-full bg-pink font-display text-xl tracking-wider disabled:opacity-60">ENTRAR</button>
            <button onClick={() => enter(true)} disabled={!depto || busy} className="min-h-11 text-sm font-semibold text-teal underline underline-offset-4">
              {busy ? "Activando…" : "Entrar y avisarme por notificación"}
            </button>
          </>
        )}

        {msg && <p role="status" className="rounded-[14px] bg-card-2/90 px-3.5 py-3 text-sm text-lilac">{msg}</p>}
        {ios && (
          <p className="rounded-[14px] bg-card/90 px-3.5 py-3 text-[13px] leading-snug text-[#E3D6EE]">En iPhone: tocá Compartir y después “Agregar a inicio” para recibir las alertas.</p>
        )}
        <button onClick={() => { setDepto("Maipú"); freezeScenario(12); router.push("/"); }} className="min-h-11 text-sm font-semibold text-sun underline underline-offset-4">Ver simulación (lluvia, granizo y viento)</button>
        <p className="text-center text-[11px] text-muted">Datos: DACC Mendoza (radar, estaciones y pronóstico). No reemplaza las alertas oficiales.</p>
      </div>
    </main>
  );
}
