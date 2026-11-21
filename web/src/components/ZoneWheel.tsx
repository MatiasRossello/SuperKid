"use client";
// Selector circular de zona, como la rueda de armas de GTA: 18 gajos, uno por departamento.
// Tocar o arrastrar el dedo por la rueda elige; con teclado, flechas + Enter.
import { useRef, useState } from "react";
import type { Departamento } from "@/lib/departamentos";

const REGIONS: { name: string; deptos: Departamento[] }[] = [
  { name: "GRAN MENDOZA", deptos: ["Capital", "Godoy Cruz", "Guaymallén", "Las Heras", "Luján de Cuyo", "Maipú"] },
  { name: "ESTE", deptos: ["Lavalle", "San Martín", "Rivadavia", "Junín", "Santa Rosa", "La Paz"] },
  { name: "VALLE DE UCO", deptos: ["Tunuyán", "Tupungato", "San Carlos"] },
  { name: "SUR", deptos: ["San Rafael", "General Alvear", "Malargüe"] },
];
const ITEMS = REGIONS.flatMap((r, ri) => r.deptos.map((d) => ({ d, region: r.name, tone: ri % 2 })));
const N = ITEMS.length;
const STEP = 360 / N;
const C = 200, R_OUT = 190, R_IN = 82, R_TXT = (R_OUT + R_IN) / 2 + 4;

// redondeado: el servidor y el navegador deben calcular exactamente los mismos números (si no, falla la hidratación)
const round = (n: number) => Math.round(n * 100) / 100;
const pt = (r: number, deg: number) => [round(C + r * Math.cos((deg * Math.PI) / 180)), round(C + r * Math.sin((deg * Math.PI) / 180))];
const wedge = (i: number) => {
  const a0 = -90 + i * STEP, a1 = a0 + STEP;
  const [x0, y0] = pt(R_OUT, a0), [x1, y1] = pt(R_OUT, a1), [x2, y2] = pt(R_IN, a1), [x3, y3] = pt(R_IN, a0);
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3}Z`;
};

export function ZoneWheel({ value, onChange }: { value: Departamento | ""; onChange: (d: Departamento) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const sel = ITEMS.findIndex((x) => x.d === value);
  const shown = ITEMS[hover ?? sel] as (typeof ITEMS)[number] | undefined;

  const at = (e: React.PointerEvent) => {
    const b = svg.current!.getBoundingClientRect();
    const k = 400 / b.width;
    const dx = (e.clientX - b.left) * k - C, dy = (e.clientY - b.top) * k - C;
    const r = Math.hypot(dx, dy);
    if (r < R_IN || r > R_OUT + 6) return null;
    const ang = (((Math.atan2(dy, dx) * 180) / Math.PI + 90) % 360 + 360) % 360;
    return Math.floor(ang / STEP) % N;
  };
  const move = (e: React.PointerEvent) => {
    const i = at(e);
    setHover(i);
    if (i !== null && e.buttons) onChange(ITEMS[i].d); // arrastrar con el dedo o con el mouse apretado
  };
  const key = (e: React.KeyboardEvent, i: number) => {
    const j = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % N : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + N) % N : -1;
    if (j >= 0) { e.preventDefault(); onChange(ITEMS[j].d); refs.current[j]?.focus(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(ITEMS[i].d); }
  };

  return (
    <div className="relative mx-auto aspect-square w-[min(88vw,340px,44dvh)]">
      <svg ref={svg} viewBox="0 0 400 400" role="radiogroup" aria-label="Elegí tu departamento" className="size-full touch-none select-none drop-shadow-[0_6px_0_rgba(0,0,0,.5)]"
        onPointerMove={move} onPointerDown={(e) => { const i = at(e); if (i !== null) onChange(ITEMS[i].d); }} onPointerLeave={() => setHover(null)}>
        <circle cx={C} cy={C} r={R_OUT + 4} fill="#000" fillOpacity=".55" />
        {ITEMS.map((it, i) => {
          const on = i === sel, hot = i === hover;
          const a = -90 + i * STEP + STEP / 2;
          const flip = ((a % 360) + 360) % 360 > 90 && ((a % 360) + 360) % 360 < 270;
          const [tx, ty] = pt(R_TXT, a);
          return (
            <g key={it.d} ref={(el) => { refs.current[i] = el; }} role="radio" aria-checked={on} aria-label={`${it.d}, ${it.region}`} tabIndex={on || (sel < 0 && i === 0) ? 0 : -1}
              onKeyDown={(e) => key(e, i)} className="cursor-pointer outline-none [&:focus-visible>path]:stroke-teal">
              <path d={wedge(i)} stroke="#000" strokeWidth="3" strokeLinejoin="round"
                fill={on ? "#FFC94B" : hot ? "#5B3A8C" : it.tone ? "#341A52" : "#241040"} />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className="font-display pointer-events-none uppercase"
                fontSize="13" letterSpacing="1" fill={on ? "#000" : "#FFF4E8"} transform={`rotate(${a + (flip ? 180 : 0)} ${tx} ${ty})`}>{it.d}</text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R_IN} fill="#0B0716" stroke="#000" strokeWidth="4" />
        <circle cx={C} cy={C} r={R_OUT + 4} fill="none" stroke="#000" strokeWidth="4" />
      </svg>
      <div aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[27%] text-center">
        <span className="font-typewriter text-[9px] tracking-[2px] text-sun">{shown ? shown.region : "ELEGÍ TU ZONA"}</span>
        <span className="mt-1 font-display text-[clamp(18px,6vw,26px)] uppercase leading-[1.05] tracking-wide text-cream [text-shadow:2px_2px_0_#000]">{shown ? shown.d : "—"}</span>
      </div>
    </div>
  );
}
