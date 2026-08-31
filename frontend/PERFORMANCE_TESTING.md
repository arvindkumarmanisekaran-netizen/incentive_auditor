# Performance testing

The frontend uses four complementary tools:

- `stats.js` displays live FPS, frame time, and memory panels.
- `react-scan` highlights inefficient React renders.
- `web-vitals` records CLS, FCP, INP, LCP, and TTFB.
- Playwright automates repeatable browser performance scenarios.

## Live development monitor

Start the frontend and add `?perf=1` to the URL:

```bash
npm run dev
```

Open `http://localhost:5173/?perf=1`. The Stats panel appears at the upper-right;
click it to change panels. React Scan provides its render-analysis toolbar. These
two tools are loaded only in Vite development mode. Web Vitals remain available
in every build through `window.__WEB_VITALS__` and the `web-vital` browser event.

## Automated tests

Install Chromium once, then run the performance suite:

```bash
npm run playwright:install
npm run test:performance
```

The default suite uses the real FastAPI and PostgreSQL backend. Reports are
written to `playwright-report/` and `test-results/`. For a fast frontend-only
run with mocked API responses, use:

```bash
npm run test:performance:mocked
```

The normal benchmark disables Playwright trace screenshots and video because
recording them competes with `requestAnimationFrame` and distorts FPS. To retain
trace and video while diagnosing a functional failure, run:

```bash
npm run test:performance:diagnostics
```

Diagnostic recordings are intentionally not suitable for comparing FPS against
the benchmark thresholds.

## Tests with the real backend

The default suite includes FastAPI, PostgreSQL and the workspace data path.
Start the backend from the repository root in one terminal:

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Then run the complete desktop and mobile matrix from `frontend/` in another
terminal:

```bash
npm run test:performance
```

This mode checks backend availability before the suite, performs a real
workspace login, and waits for the real database table request to finish. Set
`PERF_BACKEND_URL` when the API is hosted elsewhere:

```bash
PERF_BACKEND_URL=http://192.168.1.10:8000 npm run test:performance:backend
```

## Desktop and mobile projects

The default suite runs each scenario on six representative configurations:

| Project | Engine | Viewport class |
|---|---|---|
| Desktop Chrome | Chromium | Desktop |
| Pixel 7 | Chromium | Standard Android |
| Galaxy S24 | Chromium | Compact flagship Android |
| Galaxy A55 | Chromium | Large mid-range Android |
| iPhone 13 | WebKit | Widely used iPhone |
| iPhone 15 | WebKit | Current iPhone form factor |
| Xiaomi 14 | Chromium | Xiaomi flagship, 1.5× CPU slowdown |
| Mi 11 Lite | Chromium | Older mid-range, 2.5× CPU slowdown |
| Redmi Note 13 | Chromium | Mainstream mid-range, 3× CPU slowdown |
| POCO M6 Pro | Chromium | Value mid-range, 3.5× CPU slowdown |
| Redmi 13C | Chromium | Low range, 4.5× CPU slowdown |
| Redmi A3 | Chromium | Entry level, 6× CPU slowdown |

The Xiaomi, Mi, Redmi and POCO projects also emulate constrained 4G latency.
CPU slowdown is applied through Chromium DevTools Protocol so these projects
exercise more than responsive layout. It remains an approximation; real-device
thermal throttling, GPU limits and vendor browser behavior require a physical
device lab for final certification.

Run only the mobile matrix:

```bash
npm run test:performance:mobile
```

Run only desktop Chromium:

```bash
npm run test:performance:desktop
```

Current guardrails are deliberately conservative for headless and CI browsers:

| Measurement | Threshold |
|---|---:|
| Average animation FPS | at least 45 |
| 95th-percentile frame time | at most 55 ms |
| Frames slower than 33.34 ms | at most 20% |
| Database tab response | at most 500 ms |
| Real database readiness | at most 5 s |
| Local development TTFB | at most 800 ms |
| FCP, when reported | at most 1.8 s |

FPS varies with hardware and runner load. Change thresholds only after comparing
several runs on the same class of machine. GitHub Actions runs the suite for
frontend pull requests and stores the HTML and JSON reports for 14 days.

Headless WebKit on Linux can throttle `requestAnimationFrame` independently of
page workload, so iPhone projects do not enforce synthetic FPS. They still test
Web Vitals initialization, responsive rendering, real backend login, the 500 ms
UI tab response and database readiness. Physical iPhones are required for a
trustworthy Safari FPS measurement.
