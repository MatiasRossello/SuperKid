"use client";
import "leaflet/dist/leaflet.css";
import { geoJSON, type PathOptions } from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, GeoJSON, ImageOverlay, MapContainer, useMap } from "react-leaflet";
import geo from "@/data/departamentos.json";
import { frameUrl, RADAR_BOUNDS, type FrameRef } from "@/lib/radar";

type Geo = { features: { properties: { departamento: string } }[] };

/** Zooms to the user's departamento once; after that the user owns the view. */
function FitDepto({ depto }: { depto: string }) {
  const map = useMap();
  useEffect(() => {
    const f = (geo as unknown as Geo).features.find((x) => x.properties.departamento === depto);
    if (f) map.fitBounds(geoJSON(f as unknown as Parameters<typeof geoJSON>[0]).getBounds(), { padding: [40, 40], maxZoom: 10 });
  }, [map, depto]);
  return null;
}

export type Layers = { dbz: boolean; granizo: boolean; rayos: boolean };

export default function RadarMap({ frame, layers, depto, levels, rayos, cells = [] }: {
  frame: FrameRef | undefined;
  layers: Layers;
  depto: string;
  levels: Record<string, number>;
  rayos: { lat: number; lng: number }[];
  cells?: { lat: number; lng: number; prob: number; area_km2: number }[]; // simulation: drawn instead of a radar PNG
}) {
  // Estilo de mapa de juego: mar liso, tierra color arena, contornos negros gruesos y la zona en alerta pintada de naranja a rojo.
  const ALERT = ["", "", "", "#E8873A", "#DE4B2C", "#B3121F"];
  const style = (f?: { properties?: { departamento?: string } }): PathOptions => {
    const d = f?.properties?.departamento ?? "";
    const lvl = levels[d] ?? 0;
    return {
      color: "#000",
      weight: d === depto ? 4 : 2.5,
      lineJoin: "round",
      fillColor: lvl >= 3 ? ALERT[lvl] : d === depto ? "#FFC94B" : "#D9C593",
      fillOpacity: lvl >= 3 ? 0.9 : 1,
    };
  };
  const label = (f: { properties?: { departamento?: string } }, layer: { bindTooltip: (c: string, o: object) => void }) => {
    const d = f.properties?.departamento;
    if (d) layer.bindTooltip(d, { permanent: true, direction: "center", className: d === depto ? "depto-label depto-label-me" : "depto-label" });
  };
  return (
    <MapContainer center={[-34.3, -68.5]} zoom={7} minZoom={6} maxZoom={11} zoomControl={false} attributionControl className="absolute inset-0 h-full w-full" style={{ background: "#6F8FA8" }}>
      {depto && <FitDepto depto={depto} />}
      {/* ponytail: sin mapa base (los tiles oscuros gratis pasaron a pagos); los departamentos pintados alcanzan de contexto */}
      <GeoJSON key={depto + JSON.stringify(levels)} data={geo as Parameters<typeof GeoJSON>[0]["data"]} style={style} onEachFeature={label} />
      {frame && layers.dbz && <ImageOverlay url={frameUrl(frame, "dbz")} bounds={RADAR_BOUNDS} opacity={0.75} attribution="Radar: DACC Mendoza" />}
      {frame && layers.granizo && <ImageOverlay url={frameUrl(frame, "granizo")} bounds={RADAR_BOUNDS} opacity={0.95} />}
      {layers.granizo && cells.map((c, i) => (
        // radius from the impact area, as if it were a circle
        <Circle key={`c${i}`} center={[c.lat, c.lng]} radius={Math.sqrt(c.area_km2 / Math.PI) * 1000} pathOptions={{ color: "#000", fillColor: "#FF0000", fillOpacity: 0.5 + c.prob / 400, weight: 3 }} />
      ))}
      {layers.rayos && rayos.map((r, i) => <CircleMarker key={i} center={[r.lat, r.lng]} radius={4} pathOptions={{ color: "#000", fillColor: "#FFC94B", fillOpacity: 1, weight: 2 }} />)}
    </MapContainer>
  );
}
