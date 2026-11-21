// The single poller. pg_cron calls it every 2 min (see supabase/cron.sql); nobody else should.
import { db, tryWrite } from "@/lib/db.ts";
import type { LevelInputs } from "@/lib/level.ts";
import { runPipeline } from "@/lib/pipeline.ts";
import * as src from "@/lib/sources.ts";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET)
    return new Response("unauthorized", { status: 401 });

  const [frames, stations, forecasts, smn] = await Promise.all([src.latestFrames(), src.stations(), src.forecasts(), src.smnRaw()]);
  const last = frames?.at(-1) ?? null;
  const items = last ? await src.frameImpacts(last) : null;
  const now = Date.now();

  // Store what we got. Each write is independent; failures are logged and skipped.
  await Promise.all([
    frames && tryWrite("radar_frames", db().from("radar_frames").upsert(frames.slice(-30).map((f) => ({ date: f.date, time_utc: f.time, types: f.types })))),
    last && items?.length && tryWrite("hail_impacts", db().from("hail_impacts").upsert(
      items.map((i) => {
        const hhmm = `${last.time.slice(0, 2)}:${last.time.slice(2, 4)}`;
        return { departamento: i.departamento, paraje: i.paraje_referencia, prob_max: i.prob_max, area_km2: i.area_impacto_km2, hora_inicio: hhmm, hora_fin: hhmm, frame_date: last.date, source: "frame" };
      }),
      { onConflict: "departamento,hora_inicio,hora_fin,frame_date", ignoreDuplicates: true },
    )),
    stations && tryWrite("station_readings", db().from("station_readings").upsert(
      stations.map(({ estacion, nombre, departamento, lat, lng, temp, humedad, viento, precipitacion, read_at }) => ({ estacion, nombre, departamento, lat, lng, temp, humedad, viento, precipitacion, read_at })),
      { ignoreDuplicates: true },
    )),
    forecasts && tryWrite("forecasts", db().from("forecasts").upsert(forecasts.map((f) => ({ ...f, updated_at: new Date().toISOString() })))),
    smn && tryWrite("smn_alerts", db().from("smn_alerts").insert({ raw: smn })),
  ]);

  const today = forecasts?.find((f) => f.fecha === src.mendozaToday());
  const inputs: LevelInputs = {
    impacts: last && items ? { at: src.frameIso(last.date, last.time), items } : null,
    forecast: today ? { at: new Date().toISOString(), texto: today.texto } : null,
    // ponytail: unknown whether `precipitacion` is hourly or daily; only trust readings from the last hour
    rain: (stations ?? [])
      .filter((s) => s.departamento && s.precipitacion && now - Date.parse(s.read_at) < 3600_000)
      .map((s) => ({ at: s.read_at, departamento: s.departamento!, estacion: s.nombre, mm: s.precipitacion! })),
    smn: [], // mapping pending a real SMN payload
  };

  const result = await runPipeline(inputs);
  return Response.json({
    ok: { radar: !!frames, stations: !!stations, forecast: !!forecasts, smn: smn !== null },
    frame: last && `${last.date} ${last.time}`,
    ...result,
  });
}
