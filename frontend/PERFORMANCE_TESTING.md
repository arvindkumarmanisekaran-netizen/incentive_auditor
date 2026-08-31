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

The tests mock API responses, so PostgreSQL, FastAPI, and an LLM are not required.
Reports are written to `playwright-report/` and `test-results/`.

The normal benchmark disables Playwright trace screenshots and video because
recording them competes with `requestAnimationFrame` and distorts FPS. To retain
trace and video while diagnosing a functional failure, run:

```bash
npm run test:performance:diagnostics
```

Diagnostic recordings are intentionally not suitable for comparing FPS against
the benchmark thresholds.

Current guardrails are deliberately conservative for headless and CI browsers:

| Measurement | Threshold |
|---|---:|
| Average animation FPS | at least 45 |
| 95th-percentile frame time | at most 55 ms |
| Frames slower than 33.34 ms | at most 20% |
| Database tab response | at most 500 ms |
| Local development TTFB | at most 800 ms |
| FCP, when reported | at most 1.8 s |

FPS varies with hardware and runner load. Change thresholds only after comparing
several runs on the same class of machine. GitHub Actions runs the suite for
frontend pull requests and stores the HTML and JSON reports for 14 days.
