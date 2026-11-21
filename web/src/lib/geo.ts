import geo from "../data/departamentos.json" with { type: "json" };
import type { Departamento } from "./departamentos.ts";

type Ring = number[][];
type Feature = { properties: { departamento: string }; geometry: { type: string; coordinates: unknown } };

// Even-odd ray casting over every ring: holes resolve themselves.
function inRings(lng: number, lat: number, rings: Ring[]): boolean {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

export function departamentoAt(lat: number, lng: number): Departamento | null {
  for (const f of (geo as { features: Feature[] }).features) {
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
    if (polys.some((rings) => inRings(lng, lat, rings))) return f.properties.departamento as Departamento;
  }
  return null;
}

const centers = new Map<string, [number, number]>();

/** Rough centroid of a departamento, used to place demo cells/lightning. */
export function departamentoCenter(d: Departamento): [number, number] {
  const hit = centers.get(d);
  if (hit) return hit;
  const f = (geo as { features: Feature[] }).features.find((x) => x.properties.departamento === d);
  const polys = f ? ((f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][]) : [];
  const ring = polys[0]?.[0] ?? [];
  const sum = ring.reduce(([lat, lng], [x, y]) => [lat + y, lng + x], [0, 0]);
  const c: [number, number] = ring.length ? [sum[0] / ring.length, sum[1] / ring.length] : [-34.3, -68.5];
  centers.set(d, c);
  return c;
}
