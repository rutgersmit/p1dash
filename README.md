# P1 Dash

Real-time HomeWizard P1 Meter dashboard. Connects to your meter over its local API, proxies the WebSocket through a small Node.js server (to handle the self-signed certificate), and serves a live React dashboard.

## Features

- Built-in pairing wizard — enter your meter's IP, press the button, done
- Live power reading with animated value transitions
- Scrolling 60-second power graph — orange for import, green for export
- Graph fullscreen button with native fullscreen when supported, plus an in-app fallback for browsers like iPhone Safari pinned apps
- Hourly graph — averaged per minute over the last hour
- Per-phase breakdown (L1 / L2 / L3) when available
- Import & export energy totals with T1/T2 split
- Active tariff indicator
- Dark/light mode (follows `prefers-color-scheme`, with manual toggle)
- Auto-reconnect with exponential backoff
- Heartbeat (ping/pong every 30s) — auto-reconnects on silent TCP disconnect
- Build version in footer (git SHA + build date) — easy to verify which image is running

## Requirements

- Node.js 20+ (or Docker)
- A HomeWizard P1 Meter on your local network

## Running with Docker

```bash
docker compose up --build
```

Open <http://localhost:3000> and follow the pairing wizard.

Pairing data (IP + token) is stored in `./data/local.json` on the host, mounted into the container at `/app/config`. This means your pairing survives restarts and rebuilds — the wizard only runs once.

To re-pair, remove the file and restart:

```bash
rm data/local.json && docker compose restart
```

### Using the pre-built image

```bash
docker run -d \
  --name p1dash \
  --restart unless-stopped \
  -p 3000:3000 \
  -e P1_METER_IP=192.168.1.x \
  -e P1_METER_TOKEN=your-token \
  ghcr.io/rutgersmit/p1dash:main
```

GitHub Actions builds and pushes automatically on every push to `main`:

```bash
ghcr.io/rutgersmit/p1dash:main
ghcr.io/rutgersmit/p1dash:sha-<short sha>
```

## Running locally

```bash
npm install
npm run dev     # backend on :3000, Vite dev server on :5173
```

Open <http://localhost:5173>.

### Production build

```bash
npm run build   # bundles frontend into dist/
npm start       # serves everything from port 3000
```

Pairing data is stored in `config/local.json` (gitignored).

## Project structure

```plain
p1dash/
├── data/                        # Persisted pairing config (Docker volume, gitignored)
├── src/
│   ├── client/                  # React frontend (Vite)
│   │   ├── components/          # PowerDisplay, PhaseCards, EnergyCards, PowerGraph, HourGraph, StatusBar, SetupWizard
│   │   ├── hooks/               # useP1Data — WebSocket state management
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── index.html
│   │   └── main.jsx
│   └── server/
│       ├── index.js             # Express + ws proxy to the P1 meter
│       └── setup.js             # Pairing wizard API endpoints
├── public/
├── .github/workflows/docker.yml # Builds and pushes Docker image on push to main
├── .gitignore
├── CLAUDE.md                    # Project instructions for Claude Code
├── docker-compose.yml
├── Dockerfile
├── package.json
└── vite.config.js
```

## API field mapping

| Field | Description |
| --- | --- |
| `power_w` | Active total power (W) — positive = import, negative = export |
| `power_l1_w` / `power_l2_w` / `power_l3_w` | Per-phase power |
| `energy_import_t1_kwh` / `_t2_kwh` / `_kwh` | Cumulative import totals |
| `energy_export_t1_kwh` / `_t2_kwh` / `_kwh` | Cumulative export totals |
| `tariff` | Active tariff (1 or 2) |
| `timestamp` | Unix timestamp from the meter |

All fields are optional — missing values display as `—`.
