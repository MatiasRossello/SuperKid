import { test } from "node:test";
import assert from "node:assert/strict";
import { stormDeptosFromForecast } from "./departamentos.ts";
import { departamentoAt } from "./geo.ts";
import { computeLevels } from "./level.ts";

test("point in polygon", () => {
  assert.equal(departamentoAt(-32.8895, -68.8458), "Capital");
  assert.equal(departamentoAt(-34.6177, -68.3301), "San Rafael");
  assert.equal(departamentoAt(-33.2539, -68.1528), "Santa Rosa");
  assert.equal(departamentoAt(-35.4755, -69.5843), "Malargüe");
  assert.equal(departamentoAt(-31.0, -60.0), null);
});

test("forecast zones (real DACC text 21/11/2026)", () => {
  const t = "Nubosidad variable con ascenso de la temperatura, vientos algo fuertes del sector sur. \nTormentas afectando el sur provincial, La Paz y Santa Rosa.\nZonda en Malargue y precordillera.";
  assert.deepEqual([...stormDeptosFromForecast(t)].sort(), ["General Alvear", "La Paz", "Malargüe", "San Rafael", "Santa Rosa"]);
  assert.equal(stormDeptosFromForecast("Tormentas aisladas.").size, 18);
  assert.equal(stormDeptosFromForecast("Este fin de semana, cielo despejado.").size, 0);
});

test("levels (real impact 19/11 Santa Rosa)", () => {
  const at = "2026-11-19T21:16:00Z";
  const l = computeLevels({
    impacts: { at, items: [
      { departamento: "Santa Rosa", paraje_referencia: "Comandante Salas", prob_max: 95, area_impacto_km2: 404 },
      { departamento: "La Paz", paraje_referencia: "Colonia Japonesa", prob_max: 95, area_impacto_km2: 81 },
      { departamento: "Lavalle", paraje_referencia: "X", prob_max: 50, area_impacto_km2: 10 },
    ] },
    forecast: { at, texto: "Tormentas en el este provincial." },
    rain: [{ at, departamento: "Junín", estacion: "Junín", mm: 2.4 }],
    smn: [{ at, departamento: "Malargüe", nivel: "roja", evento: "tormenta" }],
  });
  assert.equal(l["Santa Rosa"].level, 5);
  assert.equal(l["La Paz"].level, 4);
  assert.equal(l["Lavalle"].level, 3);
  assert.equal(l["Junín"].level, 2);
  assert.equal(l["Rivadavia"].level, 1);
  assert.equal(l["Malargüe"].level, 5);
  assert.equal(l["Capital"].level, 0);
  assert.equal(l["Santa Rosa"].reasons.length, 2);
});

test("invented facts detector", async () => {
  const { inventedFacts } = await import("./summary.ts");
  const input = { departamento: "Santa Rosa", nivel: 5, datos: [{ fuente: "Radar DACC", hora: "18:16", paraje: "Comandante Salas", probabilidad: 95, area_km2: 404 }] };
  assert.deepEqual(inventedFacts("Granizo cerca de Comandante Salas a las 18:16, 95 % de probabilidad. Guardá el auto.", input), []);
  assert.deepEqual(inventedFacts("Granizo en 15 minutos, hasta las 19:30.", input), ["15", "19:30"]);
});

test("simulación Maipú: lluvia → granizo → zonda", async () => {
  const { STEPS, simMaipuSnapshot } = await import("./sim-maipu.ts");
  const { SCENARIOS } = await import("./scenarios.ts");
  const { headline } = await import("./copy.ts");
  const start = Date.parse(SCENARIOS.maipu.start);
  const at = (m: number) => new Date(start + m * 60_000 + 30_000).toISOString();
  const levels = STEPS.map((s) => simMaipuSnapshot(at(s.min)).zones["Maipú"].level);
  assert.deepEqual(levels, [1, 2, 2, 3, 4, 5, 2, 0, 2, 3, 2]);
  const z = simMaipuSnapshot(at(54)).zones["Maipú"];
  assert.equal(headline(z.level, z.sources, "Maipú"), "ZONDA EN MAIPÚ");
  assert.equal(simMaipuSnapshot(at(26)).zones["Capital"].level, 1); // forecast covers all Gran Mendoza
  assert.equal(simMaipuSnapshot(at(26)).zones["San Rafael"].level, 0);
});
