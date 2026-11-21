"use client";
import "leaflet/dist/leaflet.css";
import type { PathOptions } from "leaflet";
import { CircleMarker, GeoJSON, ImageOverlay, MapContainer } from "react-leaflet";
import geo from "@/data/departamentos.json";
import { frameUrl, RADAR_BOUNDS, type FrameRef } from "@/lib/radar";

export type Layers = { dbz: boolean; granizo: boolean; rayos: boolean };

export default function RadarMap({ frame, layers, depto, levels, rayos }: {
  frame: FrameRef | undefined;
  layers: Layers;
  depto: string;
  levels: Record<string, number>;
  rayos: { lat: number; lng: number }[];
}) {
  const style = (f?: { properties?: { departamento?: string } }): PathOptions => {
    const d = f?.properties?.departamento ?? "";
    const lvl = levels[d] ?? 0;
    return {
      color: d === depto ? "#FFF4E8" : lvl >= 3 ? "#FF2E88" : "#3E5A7E",
      weight: d === depto ? 2.5 : lvl >= 3 ? 2 : 1,
      fillColor: "#FF2E88",
      fillOpacity: lvl >= 3 ? 0.08 + (lvl - 3) * 0.05 : 0,
    };
  };
  return (
    <MapContainer center={[-34.3, -68.5]} zoom={7} minZoom={6} maxZoom={11} zoomControl={false} attributionControl className="absolute inset-0 h-full w-full" style={{ background: "#101A2E" }}>
      {/* ponytail: no basemap (keyless dark tiles went paid); deptos outline is enough context */}
      <GeoJSON key={depto + JSON.stringify(levels)} data={geo as Parameters<typeof GeoJSON>[0]["data"]} style={style} />
      {frame && layers.dbz && <ImageOverlay url={frameUrl(frame, "dbz")} bounds={RADAR_BOUNDS} opacity={0.75} attribution="Radar: DACC Mendoza" />}
      {frame && layers.granizo && <ImageOverlay url={frameUrl(frame, "granizo")} bounds={RADAR_BOUNDS} opacity={0.95} />}
      {layers.rayos && rayos.map((r, i) => <CircleMarker key={i} center={[r.lat, r.lng]} radius={4} pathOptions={{ color: "#FFC94B", fillColor: "#FFC94B", fillOpacity: 0.9, weight: 1 }} />)}
    </MapContainer>
  );
}
