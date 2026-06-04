# P1 Dash — projectinstructies

## Git & GitHub

- **Nooit zelf pushen.** Commit lokaal, en wacht tot Rutger expliciet zegt "push" of "commit en push".
- Remote staat op HTTPS: `https://github.com/rutgersmit/p1dash`
- **README.md bijwerken** bij elke grote wijziging — nieuwe features, gewijzigde architectuur, nieuwe omgevingsvariabelen, etc.

## Architectuur

Single-page React app (Vite) + Node.js/Express server in één container.

```
src/client/   → React frontend (Vite build → dist/)
src/server/   → Express + WebSocket server (Node.js, draait in productie)
public/       → Statische assets
dist/         → Vite output (niet in git)
```

### Data flow

```
P1-meter (WebSocket wss://<IP>/api/ws)
  → src/server/index.js  (Node WebSocket client)
  → Browser (WebSocket /ws)
  → useP1Data.js hook
  → PowerGraph / HourGraph / EnergyCards etc.
```

### Verbinding met P1-meter

- Server maakt een persistente WebSocket naar de meter
- Autoriseert met token, abonneert op `measurement`
- **Heartbeat (ping/pong) elke 30 seconden** — als er geen pong terugkomt, wordt de verbinding afgebroken en herverbonden. Dit voorkomt dat de grafiek verdwijnt na ~4 dagen door een stil gestorven TCP-verbinding.
- Reconnect met exponentiële backoff (1s → max 30s)

### Versie-informatie

De footer toont git SHA + builddatum. Dit werkt als volgt:

- `vite.config.js` injecteert `__BUILD_SHA__` en `__BUILD_DATE__` via `define`
- De Dockerfile geeft `ARG COMMIT_SHA` door als `ENV` vóór `npm run build`
- GitHub Actions geeft `build-args: COMMIT_SHA=${{ github.sha }}` mee

Zo is in de footer altijd zichtbaar welk image draait.

## Docker

```dockerfile
# Multi-stage: builder → productie-image
# Dockerfile in root
# Draait op poort 3000
```

GitHub Actions (`.github/workflows/docker.yml`) bouwt en pusht automatisch bij elke push naar `main` of `v*` tag naar `ghcr.io/rutgersmit/p1dash`.

## Configuratie

Runtime config (IP + token van de P1-meter) wordt opgeslagen in een JSON-bestand via de setup wizard. Valt terug op `P1_METER_IP` / `P1_METER_TOKEN` omgevingsvariabelen.
