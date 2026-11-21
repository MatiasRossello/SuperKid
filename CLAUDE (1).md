# SuperKid

PWA de alertas de granizo, tormenta y lluvia para Mendoza, Argentina. Proyecto de hackathon (noviembre 2026), contexto: el "Súper Niño".

SuperKid combina datos oficiales (radar y granizo de la DACC, pronóstico provincial, alertas del SMN), los resume en una frase simple por departamento y manda notificaciones push cuando sube el nivel de alerta.

## Stack

- Next.js (App Router) + TypeScript + Tailwind, deploy en Vercel
- Supabase: Postgres, Edge Functions (Deno), pg_cron, Storage
- Mapa: Leaflet con react-leaflet
- Push: Web Push con claves VAPID y la librería `web-push`
- Resúmenes: API de Claude, modelo `claude-haiku-5-5`

## Reglas

- **Nunca pegarle a las fuentes desde el navegador.** Ni la DACC ni agrometeo tienen CORS abierto. Todo pasa por el poller (Edge Function) o por el proxy `/api/radar`.
- **Respetar las fuentes:** máximo una consulta cada 2 minutos por endpoint, con cache. Un solo poller sirve a todos los usuarios.
- **El modelo no pronostica.** Solo recibe los datos oficiales del departamento y los reescribe en máximo 2 frases, en español rioplatense, con una acción concreta. Si un dato no está en el input, no aparece en la salida.
- **Siempre mostrar la fuente y la hora** de cada dato, y aclarar que no reemplaza las alertas oficiales.
- **Tolerancia a fallas:** si una fuente falla, loguear y seguir con las demás. La app nunca se rompe porque el SMN no responda.
- Las horas de la DACC vienen en UTC. Mendoza es UTC-3. Convertir solo al mostrar.
- Los easter eggs nunca tocan datos reales ni tapan una alerta real.
- La UI se inspira en el estilo de GTA VI (atardecer neón, HUD), pero sin logos, tipografías, personajes ni arte de Rockstar.

## Diseño

Pantallas de referencia (Home, Mapa del radar, Nueva alerta, Bienvenida): https://claude.ai/artifact/JWcdxDyra1mmjSMSV47Zyh

Seguir esa paleta (fondo `#170A2B`, magenta `#FF2E88`, amarillo `#FFC94B`, turquesa `#2EE6D6`, texto `#FFF4E8`) y las tipografías Anton (títulos) e Inter (texto).

## Fuentes de datos

Endpoints no documentados, sacados de las páginas oficiales el 21/11/2026. Pueden cambiar.

### DACC — radar y granizo

Base: `https://www2.contingencias.mendoza.gov.ar`

| Endpoint | Contenido |
| --- | --- |
| `/radar/web/file_list.json` | `{ "YYYYMMDD": ["HHMMSS_dbz.png", ...] }`, últimos 4 días |
| `/radar/web/{YYYYMMDD}/{HHMMSS}_dbz.png` | Reflectividad, PNG 500×700 px |
| `/radar/web/{YYYYMMDD}/{HHMMSS}_granizo.png` | Capa de granizo |
| `/radar/web/{YYYYMMDD}/{HHMMSS}_dbz_manga.png` y `_granizo_manga.png` | Recorrido acumulado |
| `/radar/web/{YYYYMMDD}/{HHMMSS}_afectacion.json` | Impactos de granizo del frame (`[]` si no hay). No figura en file_list pero existe para cada hora |
| `/radar/web/{YYYYMMDD}/manga_afectacion_diaria.json` | Impactos acumulados del día operativo (11:00 a 10:59 UTC) |
| `/rayos/rayos.json` | Rayos GOES/GLM: `[{ id, lat, lng, e, fecha }]` |

Hay un frame cada 2 minutos y la hora del nombre está en UTC.

Formato de afectación:

```json
{
  "departamento": "Santa Rosa",
  "paraje_referencia": "Comandante Salas",
  "prob_max": 95.0,
  "area_impacto_km2": 404,
  "intervalo": "21:16 - 22:10",
  "hora_inicio": "21:16",
  "hora_fin": "22:10",
  "distancia_min_km": 0.4,
  "altitud_m": 540
}
```

Bounds del PNG del radar (sacados del visor oficial):

```ts
const originLat = -34.0, originLon = -68.0;
const distN = 450, distS = 250, distE = 250, distW = 250; // km
const degLatKm = 110.924, degLonKm = 92.425, latNudge = 0.046;
export const RADAR_BOUNDS: [[number, number], [number, number]] = [
  [originLat - distS / degLatKm + latNudge, originLon - distW / degLonKm], // SO ≈ [-36.208, -70.705]
  [originLat + distN / degLatKm + latNudge, originLon + distE / degLonKm], // NE ≈ [-29.897, -65.295]
];
```

Leaflet dibuja el `imageOverlay` en Web Mercator. Para leer el píxel de un punto, calcular `x` lineal en longitud e `y` en Mercator entre los bounds.

### DACC — agrometeo

Base: `https://agrometeo.mendoza.gov.ar`

| Endpoint | Contenido |
| --- | --- |
| `/api/todas_instantaneas.json` | 60 estaciones: `estacion, Nombre, lat, lng, fecha, tempAire, humedad, velocidadViento, direccionViento, precipitacion, ...` (lat/lng como string) |
| `/api/pronostico.php` | `[{ fecha, pronostico, maxima, minima, alerta, imagenNombre }]`, 4 días |

### SMN — alertas (fuente secundaria)

`https://ws1.smn.gob.ar/v1/warning/alert/area?mode=alert&compact=true` (también acepta `&date=` y `&event=`).

Pide un header `Authorization: JWT <token>` que genera la página `smn.gob.ar/alertas`, y el sitio está detrás de Cloudflare. Implementar como fuente opcional detrás de un flag. Si falla, seguir sin el SMN.

### Defensa Civil

No tiene feed usable. No implementar.

## Modelo de datos

- `radar_frames` (date, time_utc, types[])
- `hail_impacts` (departamento, paraje, prob_max, area_km2, hora_inicio, hora_fin, frame_date, source) — único por departamento + intervalo + día
- `station_readings` (estacion, nombre, lat, lng, temp, humedad, viento, precipitacion, read_at)
- `forecasts` (fecha, texto, maxima, minima, alerta)
- `smn_alerts` (zona, nivel, evento, desde, hasta, raw)
- `zone_status` (departamento PK, level 0-5, summary, sources jsonb, valid_until, updated_at)
- `push_subscriptions` (id, endpoint, p256dh, auth, departamento, created_at)
- `notifications_log` (subscription_id, departamento, level, sent_at)

## Nivel de alerta (0-5 "estrellas")

Punto de partida, ajustable:

- 0: nada
- 1: pronóstico con tormentas para la zona
- 2: alerta amarilla del SMN, o lluvia medida en una estación del departamento
- 3: alerta naranja, o impacto de granizo con `prob_max` < 70
- 4: impacto de granizo con `prob_max` ≥ 70
- 5: alerta roja, o impacto de granizo ≥ 70 con `area_impacto_km2` > 100

Mandar push solo cuando el nivel sube. Dedupe con `notifications_log`.

## Departamentos

Los 18 de Mendoza: Capital, Godoy Cruz, Guaymallén, Las Heras, Luján de Cuyo, Maipú, Lavalle, San Martín, Rivadavia, Junín, Santa Rosa, La Paz, Tunuyán, Tupungato, San Carlos, San Rafael, General Alvear, Malargüe. Para ubicar al usuario, usar un GeoJSON de departamentos y hacer punto-en-polígono.

## Etapa futura: reportes de la gente desde X (NO implementar todavía)

Idea para más adelante. No construir nada de esto hasta que se pida explícitamente.

Grokbot (el bot de Igna) se conecta a X, busca posts de gente avisando que graniza o hay tormenta en Mendoza y publica esos reportes en SuperKid. SuperKid no habla con X: solo recibe lo que manda Grokbot.

Flujo previsto:

1. Grokbot busca en X solo cuando el radar de la DACC muestra actividad, por ejemplo con `(granizo OR "cae piedra" OR tormenta OR "está granizando") (Mendoza OR Maipú OR Guaymallén OR ...) -is:retweet lang:es`.
2. Grokbot clasifica cada post: si es de primera mano y de ahora (no una noticia ni un chiste), el fenómeno (granizo, lluvia fuerte, viento) y el departamento. "Rodeo de la Cruz" cuenta como Guaymallén.
3. Grokbot manda cada reporte a SuperKid por un endpoint autenticado, por ejemplo `POST /api/community-reports` con un token de servicio.
4. SuperKid agrupa por departamento y muestra secciones como "3 personas avisaron que está granizando en Maipú · hace 5 min".

Reglas para cuando se implemente:

- Tabla `community_reports` (departamento, fenomeno, reported_at, source = 'x' | 'app', source_hash, confidence). Guardar un hash del autor para contar personas distintas, nunca el usuario ni el texto del post.
- Mostrar solo cantidades, nunca nombres de usuario.
- Mostrar la sección recién con 2 o más reportes de autores distintos en los últimos 30 minutos.
- Cruzar con el radar: si hay una celda sobre ese departamento, mostrar "confirmado por el radar"; si no, "sin confirmar".
- Los reportes de la gente nunca disparan push. Las push salen solo de fuentes oficiales.
- Más adelante se pueden sumar reportes dentro de la app ("¿Está granizando donde estás?") con `source = 'app'`.

## Modo replay

Datos guardados del 18 y 19/11/2026 (granizo en Santa Rosa) en Supabase Storage. El replay pasa por el mismo pipeline (`zone_status` → `notify`) a 10x de velocidad. Activarlo con el código Konami o con `?replay=1`.
