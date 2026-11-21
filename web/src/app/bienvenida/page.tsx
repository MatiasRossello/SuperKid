"use client";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/ui";
import { useDepto } from "@/components/useApp";
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

export default function Bienvenida() {
  const [saved, setDepto] = useDepto();
  const [picked, setLocal] = useState<Departamento | "">("");
  const depto = picked || saved || ""; // untouched select shows the saved one
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ios = useSyncExternalStore(
    () => () => {},
    () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches,
    () => false,
  );
  const router = useRouter();


  const locate = () => {
    if (!navigator.geolocation) return setMsg("Tu navegador no comparte la ubicación. Elegí el departamento de la lista.");
    setMsg("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const { departamentoAt } = await import("@/lib/geo"); // 70 KB of polygons, only when asked
        const d = departamentoAt(p.coords.latitude, p.coords.longitude);
        if (d) { setLocal(d); setMsg(`Estás en ${d}.`); } else setMsg("Parece que estás fuera de Mendoza. Elegí un departamento.");
      },
      () => setMsg("No pudimos leer tu ubicación. Elegí el departamento de la lista."),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const activate = async (withPush: boolean) => {
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

  return (
    <main className="flex flex-col pb-10">
      <div className="relative mx-5 mt-14 h-[330px] overflow-hidden rounded-[20px] border-[6px] border-cream" style={{ background: "linear-gradient(180deg,#3B1462 0%,#B0246F 42%,#FF5E6C 66%,#FFA040 100%)" }}>
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 366 318" preserveAspectRatio="xMidYMax slice">
          <circle cx="250" cy="196" r="64" fill="#FFD25A" />
          <rect x="170" y="176" width="170" height="4" fill="#FF6F5E" />
          <rect x="170" y="190" width="170" height="6" fill="#FF6F5E" />
          <path d="M0 318 L0 210 L40 168 L74 196 L120 128 L150 160 L186 118 L232 176 L270 150 L312 196 L366 160 L366 318 Z" fill="#4A1259" />
          <path d="M120 128 L132 146 L142 140 L150 160 M186 118 L196 134 L208 130" fill="none" stroke="#FFF4E8" strokeWidth="3" strokeLinejoin="round" />
          <path d="M0 318 L0 246 L366 226 L366 318 Z" fill="#2A0D3E" />
          <path d="M0 268 L366 250 M0 286 L366 270 M0 304 L366 290" stroke="#5E8C3A" strokeWidth="3" strokeDasharray="2 8" />
        </svg>
        <div className="absolute left-[22px] top-[22px] flex flex-col">
          <span className="text-[13px] font-bold tracking-[3px]">BIENVENIDOS A</span>
          <span className="font-display text-[58px] leading-[0.95]" style={{ textShadow: "4px 4px 0 #2A0D3E" }}>MENDOZA</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 pt-7">
        <Logo size={40} />
        <p className="text-base leading-snug text-lilac">Te avisamos cuando el radar y las alertas oficiales de Mendoza marcan granizo o tormenta en tu zona.</p>

        <label htmlFor="depto" className="mt-1.5 text-[13px] font-semibold text-sun">Tu departamento</label>
        <div className="flex gap-2">
          <select id="depto" value={depto} onChange={(e) => setLocal(e.target.value as Departamento)} className="h-[52px] flex-1 rounded-[14px] border-[1.5px] border-line bg-card px-3.5 text-base text-cream">
            <option value="" disabled>Elegí uno</option>
            {[...DEPARTAMENTOS].sort((a, b) => a.localeCompare(b, "es")).map((d) => <option key={d}>{d}</option>)}
          </select>
          <button onClick={locate} aria-label="Usar mi ubicación" className="flex size-[52px] items-center justify-center rounded-[14px] border-[1.5px] border-teal bg-card">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2EE6D6" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          </button>
        </div>

        <button onClick={() => activate(true)} disabled={busy} className="mt-1 h-14 rounded-full bg-pink font-display text-xl tracking-wider disabled:opacity-60">
          {busy ? "ACTIVANDO…" : "ACTIVAR ALERTAS"}
        </button>
        <button onClick={() => activate(false)} className="min-h-11 text-sm font-semibold text-teal underline underline-offset-4">Seguir sin notificaciones</button>
        {msg && <p role="status" className="rounded-[14px] bg-card-2 px-3.5 py-3 text-sm text-lilac">{msg}</p>}

        {ios && (
          <div className="flex items-center gap-2.5 rounded-[14px] bg-card px-3.5 py-3">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2EE6D6" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
            <span className="text-[13px] leading-snug text-[#E3D6EE]">En iPhone: tocá Compartir y después “Agregar a inicio” para recibir las alertas.</span>
          </div>
        )}
        <p className="text-xs text-muted">Datos: DACC Mendoza (radar, estaciones y pronóstico). No reemplaza las alertas oficiales.</p>
      </div>
    </main>
  );
}
