import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, intentOf, moodOf } from "./chat.ts";
import { scenarioSnapshot } from "./status.ts";

test("intent from free text", () => {
  assert.equal(intentOf("¿Cae granizo hoy?"), "granizo");
  assert.equal(intentOf("hay zonda?"), "viento");
  assert.equal(intentOf("Necesito el paraguas?"), "lluvia");
  assert.equal(intentOf("¿Y mañana?"), "manana");
  assert.equal(intentOf("¿Qué hago con el auto?"), "general");
  assert.equal(intentOf("hola"), "general");
});

test("simulación Maipú: la pose y la respuesta siguen los datos", () => {
  const at = (min: number) => new Date(Date.parse("2026-11-21T18:00:00Z") + min * 60_000).toISOString();
  const z = (min: number) => scenarioSnapshot("maipu", at(min));

  let s = z(12); // lluvia fuerte
  assert.equal(moodOf(s.zones["Maipú"].level, s.zones["Maipú"].sources), "lluvia");
  assert.match(answer("¿llueve?", "Maipú", s).text, /midió 6.8 mm/);

  s = z(26); // granizo fuerte
  assert.equal(moodOf(s.zones["Maipú"].level, s.zones["Maipú"].sources), "granizo");
  assert.match(answer("hay granizo", "Maipú", s).text, /Fray Luis Beltrán.*95 %/);
  assert.match(answer("hay granizo", "Maipú", s).source, /^Simulación/);

  s = z(54); // zonda
  assert.equal(moodOf(s.zones["Maipú"].level, s.zones["Maipú"].sources), "viento");

  s = z(40); // calma
  assert.equal(moodOf(s.zones["Maipú"].level, s.zones["Maipú"].sources), "calma");
  assert.match(answer("hay granizo", "Maipú", s).text, /no marca granizo/);
});

test("nunca inventa: sin datos, lo dice", () => {
  const s = scenarioSnapshot("replay", "2026-11-19T19:00:00Z");
  assert.match(answer("¿qué temperatura hay?", "Capital", s).text, /No tengo temperatura/);
  assert.match(answer("¿y mañana?", "Capital", s).text, /No tengo el pronóstico/);
});

test("sin consejos ni referencias al SMN en ninguna respuesta de la simulación", () => {
  for (let min = 0; min <= 70; min += 2) {
    const s = scenarioSnapshot("maipu", new Date(Date.parse("2026-11-21T18:00:00Z") + min * 60_000).toISOString());
    for (const q of ["hola", "¿llueve?", "¿hay granizo?", "¿hace viento?", "¿qué hago?", "temperatura", "¿y mañana?"]) {
      const r = answer(q, "Maipú", s);
      assert.doesNotMatch(r.text + r.source, /SMN|Guardá|Manejá|Seguí|Quedate|Evitá|Alejate/, `${min} min · ${q}`);
    }
  }
});
