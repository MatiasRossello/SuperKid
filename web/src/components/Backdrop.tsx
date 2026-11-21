"use client";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import type { Mood } from "@/lib/chat";

// Animated background per weather (public/superkid/bg-*.mp4). Calm has no video: static road + warm tint.
const BG: Partial<Record<Mood, string>> = { lluvia: "lluvia", granizo: "granizo", viento: "viento" };

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeMotion = (cb: () => void) => { const m = matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

export function Backdrop({ mood }: { mood: Mood }) {
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

