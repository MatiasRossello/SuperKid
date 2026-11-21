import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTINGENCIES, contingencyByCode, contingencyFromReasons } from "./contingencies.ts";

test("catalog is code plus label", () => {
  assert.deepEqual(CONTINGENCIES.map((c) => c.code), ["tormenta", "granizo", "zonda"]);
  assert.equal(contingencyByCode("zonda")?.label, "Zonda");
  assert.equal(contingencyByCode("lluvia"), undefined);
});

test("a reason maps to one contingency without a push-side switch", () => {
  assert.equal(contingencyFromReasons([{ level: 5, dato: { fenomeno: "granizo", paraje: "Russell" } }])?.code, "granizo");
  assert.equal(contingencyFromReasons([{ level: 3, dato: { alerta: "naranja", evento: "viento zonda" } }])?.code, "zonda");
  assert.equal(contingencyFromReasons([{ level: 5, dato: { alerta: "roja", evento: "tormenta" } }])?.code, "tormenta");
  assert.equal(contingencyFromReasons([{ level: 2, dato: { estacion: "Russel", precipitacion_mm: 6.8 } }]), undefined);
});

test("hail outranks a forecast that also mentions tormentas", () => {
  const code = contingencyFromReasons([
    { level: 1, dato: { pronostico: "Tormentas fuertes y posible caída de granizo." } },
    { level: 4, dato: { fenomeno: "granizo", paraje: "Lunlunta" } },
  ])?.code;
  assert.equal(code, "granizo");
});

test("a forecast that names tormenta and zonda stays tormenta", () => {
  const code = contingencyFromReasons([
    { level: 1, dato: { pronostico: "Tormentas en el sur. Zonda en Malargüe." } },
  ])?.code;
  assert.equal(code, "tormenta");
});
