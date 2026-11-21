# SuperKid · API para bots

Consulta de solo lectura con la misma información que muestra la app: nivel de alerta, resumen, qué hacer y de dónde sale cada dato, por departamento de Mendoza.

## Acceso

```
GET https://<dominio-de-superkid>/api/v1/zonas
Authorization: Bearer <GROKBOT_TOKEN>
```

El token lo da el equipo de SuperKid. Sin token o con uno inválido la API responde `401`.

## Parámetros (todos opcionales)

| Parámetro | Ejemplo | Qué hace |
| --- | --- | --- |
| `departamento` | `maipu` | Devuelve solo ese departamento. Acepta mayúsculas, minúsculas y sin tildes. |
| `min_nivel` | `3` | Devuelve solo los departamentos con ese nivel o más (0 a 5). |
| `escenario` | `maipu` o `replay` | Datos de prueba en vez de datos en vivo: `maipu` es una simulación ficticia (lluvia → granizo → zonda, de 15:00 a 16:10) y `replay` es la tormenta real del 19/11. Requiere `hora`. |
| `hora` | `15:26` | Hora de Mendoza dentro del escenario. |

## Ejemplos

```bash
# ¿Cómo está Maipú ahora?
curl -H "Authorization: Bearer $TOKEN" "https://<dominio>/api/v1/zonas?departamento=maipu"

# ¿Dónde hay alerta (nivel 3 o más)?
curl -H "Authorization: Bearer $TOKEN" "https://<dominio>/api/v1/zonas?min_nivel=3"

# Probar con la simulación en el pico del granizo
curl -H "Authorization: Bearer $TOKEN" "https://<dominio>/api/v1/zonas?escenario=maipu&hora=15:26"
```

## Respuesta

```json
{
  "modo": "en_vivo",
  "generado": "2026-11-21T18:26:00.000Z",
  "aviso": "Datos oficiales de la DACC Mendoza resumidos por SuperKid. No reemplaza las alertas oficiales. Emergencias: 911.",
  "zona_horaria": "America/Argentina/Mendoza (UTC-3)",
  "escala": "nivel 0 a 5: ...",
  "departamentos": [
    {
      "departamento": "Maipú",
      "nivel": 4,
      "nivel_nombre": "Peligro",
      "titulo": "Granizo en Maipú",
      "resumen": "El radar marca granizo cerca de Lunlunta (Maipú) a las 15:22, con 90 % de probabilidad. Guardá el auto bajo techo.",
      "que_hacer": ["Guardá el auto bajo techo", "Evitá la ruta mientras dure", "Quedate lejos de ventanas"],
      "fuentes": [
        { "fuente": "Radar DACC", "hora": "15:22", "hora_iso": "2026-11-21T18:22:00Z",
          "datos": { "fenomeno": "granizo", "paraje": "Lunlunta", "probabilidad": 90, "area_km2": 60 } }
      ],
      "estaciones": [{ "nombre": "Russel", "precipitacion_mm": 12.1, "temperatura": 21, "hora": "15:22" }],
      "rayos_ultimos_5_min": 14,
      "actualizado": "2026-11-21T18:22:00Z"
    }
  ],
  "pronostico": [{ "fecha": "2026-11-21", "texto": "...", "maxima": 32, "minima": 16, "fuente": "Pronóstico DACC" }]
}
```

- `modo`: `en_vivo`, `simulacion` o `replay`. **Con `simulacion` los datos son inventados**: no los publiques como reales.
- `departamentos` viene ordenado de mayor a menor nivel.
- Las horas (`hora`) están en hora de Mendoza; `hora_iso` está en UTC.

## Niveles

| Nivel | Nombre | Cuándo |
| --- | --- | --- |
| 0 | Sin alerta | Nada |
| 1 | Atento | El pronóstico anuncia tormentas para la zona |
| 2 | Precaución | Lluvia medida en una estación, o alerta amarilla del SMN |
| 3 | Alerta | Granizo posible (menos de 70 %), o alerta naranja |
| 4 | Peligro | Granizo probable (70 % o más) |
| 5 | Peligro extremo | Granizo probable en más de 100 km², o alerta roja |

## Reglas para usar estos datos

1. Citá siempre la fuente y la hora (`fuentes[].fuente` y `fuentes[].hora`).
2. Incluí el `aviso`: SuperKid no reemplaza las alertas oficiales.
3. No agregues datos que no estén en la respuesta: nada de pronósticos propios ni horarios inventados.
4. Los datos se actualizan cada 2 minutos. Consultar más seguido no trae nada nuevo; con una consulta por minuto alcanza.
