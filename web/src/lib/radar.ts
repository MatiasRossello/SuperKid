// Client-safe radar geometry, from the official DACC viewer.
const originLat = -34.0, originLon = -68.0;
const distN = 450, distS = 250, distE = 250, distW = 250; // km
const degLatKm = 110.924, degLonKm = 92.425, latNudge = 0.046;
export const RADAR_BOUNDS: [[number, number], [number, number]] = [
  [originLat - distS / degLatKm + latNudge, originLon - distW / degLonKm], // SO ≈ [-36.208, -70.705]
  [originLat + distN / degLatKm + latNudge, originLon + distE / degLonKm], // NE ≈ [-29.897, -65.295]
];

export const inBounds = (lat: number, lng: number) =>
  lat >= RADAR_BOUNDS[0][0] && lat <= RADAR_BOUNDS[1][0] && lng >= RADAR_BOUNDS[0][1] && lng <= RADAR_BOUNDS[1][1];

export type FrameRef = { date: string; time: string };
export const frameUrl = (f: FrameRef, layer: "dbz" | "granizo") => `/api/radar/radar/web/${f.date}/${f.time}_${layer}.png`;

/** "20261119","211600" → "18:16" in Mendoza */
export const frameLocal = (f: FrameRef) => {
  const h = (Number(f.time.slice(0, 2)) + 21) % 24; // UTC-3
  return `${String(h).padStart(2, "0")}:${f.time.slice(2, 4)}`;
};

/** Replay of the 18–19/11 storm (Santa Rosa hail). Virtual clock runs at 10x from here. */
export const REPLAY_START = "2026-11-19T19:00:00Z";
export const REPLAY_END = "2026-11-19T23:58:00Z";
export const REPLAY_SPEED = 10;
