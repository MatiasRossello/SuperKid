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
