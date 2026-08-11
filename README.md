# Stream Sentinel

**Production-grade RTSP dual-stream health monitor and config generator** for multi-camera NVR fleets (Lorex, Reolink, ONVIF, generic).

Built for real surveillance deployments: main stream for recording, sub stream for live view / AI detection.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why this exists

Managing 10–30+ commercial cameras means:

- Different vendors, different RTSP path schemes
- Dual streams (high-res record vs low-res detect)
- Silent failures when a channel dies at 3 AM
- Hand-written Frigate / go2rtc YAML that drifts from reality

Stream Sentinel turns a single camera inventory JSON into:

1. **Live health reports** (main + sub, latency, codec, resolution)
2. **Correct dual-stream configs** for go2rtc, Frigate, and MediaMTX

---

## Install

```bash
git clone https://github.com/mikeisintheclouds-ux/stream-sentinel.git
cd stream-sentinel
npm install
npm run build
npm link   # optional: global `stream-sentinel` command
```

Requires Node 18+. Optional but recommended: `ffprobe` (from FFmpeg) for full media probes.

---

## Quick start

### 1. Define your fleet

Copy `cameras.example.json` and fill in real hosts / credentials:

```json
[
  {
    "id": "gate-01",
    "name": "Front Gate",
    "vendor": "lorex",
    "host": "192.168.1.10",
    "username": "admin",
    "password": "secret",
    "channel": 1,
    "site": "warehouse"
  }
]
```

Supported vendors: `lorex` · `reolink` · `onvif` · `generic`

### 2. Health check the fleet

```bash
npx tsx src/cli.ts check -f cameras.json
# or after build:
stream-sentinel check -f cameras.json -o report.json
```

Exit codes: `0` all healthy · `1` degraded · `2` any down — ready for cron / monitoring.

### 3. Generate dual-stream configs

```bash
stream-sentinel generate -f cameras.json --format go2rtc -o go2rtc.yaml
stream-sentinel generate -f cameras.json --format frigate -o frigate.yml
stream-sentinel generate -f cameras.json --format mediamtx -o mediamtx.yml
```

Frigate output wires **detect → sub-stream**, **record → main-stream** automatically.

---

## Library API

```ts
import {
  checkFleet,
  buildStreamUrls,
  generateFrigate,
  type CameraConfig,
} from "stream-sentinel";

const cameras: CameraConfig[] = [/* ... */];
const report = await checkFleet(cameras, { concurrency: 8 });
const yaml = generateFrigate(cameras);
```

---

## Architecture

| Module | Role |
|--------|------|
| `urls.ts` | Vendor-specific dual-stream RTSP path builders |
| `probe.ts` | ffprobe media probe + TCP fallback |
| `fleet.ts` | Concurrent fleet health aggregation |
| `generate.ts` | go2rtc / Frigate / MediaMTX / JSON emitters |
| `cli.ts` | Production CLI with exit codes for automation |

**Design principles**

- Credentials never appear in health report URLs (redacted)
- Bounded concurrency so a 30-camera check doesn’t melt the network
- Detect on sub / record on main by default
- Zero heavy runtime deps beyond `commander` + `yaml`

---

## Security notes

- Keep `cameras.json` out of git (it holds passwords)
- Prefer network isolation for camera VLANs
- This tool only *reads* stream endpoints; it does not modify camera firmware

---

## License

MIT © Mike O'Connor

---

Built for real multi-site camera fleets. Inventory → health → config, end to end.
