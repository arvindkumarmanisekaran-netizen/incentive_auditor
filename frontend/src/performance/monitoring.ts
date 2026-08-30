import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

function publishMetric(metric: Metric) {
  const snapshot = {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
  };

  window.__WEB_VITALS__ ??= {};
  window.__WEB_VITALS__[metric.name] = snapshot;
  window.dispatchEvent(new CustomEvent("web-vital", { detail: snapshot }));

  if (import.meta.env.DEV) console.info(`[performance] ${metric.name}`, snapshot);
}

function monitorWebVitals() {
  onCLS(publishMetric, { reportAllChanges: true });
  onFCP(publishMetric);
  onINP(publishMetric, { reportAllChanges: true });
  onLCP(publishMetric, { reportAllChanges: true });
  onTTFB(publishMetric);
  window.__PERFORMANCE_TOOLS__ ??= {};
  window.__PERFORMANCE_TOOLS__.webVitals = true;
}

async function monitorDevelopmentRendering() {
  if (!import.meta.env.DEV || !new URLSearchParams(location.search).has("perf")) return;

  const [{ scan }, { default: Stats }] = await Promise.all([
    import("react-scan"),
    import("stats.js"),
  ]);
  scan({ enabled: true, showToolbar: true, animationSpeed: "fast" });

  const stats = new Stats();
  stats.showPanel(0);
  stats.dom.dataset.performanceMonitor = "stats";
  Object.assign(stats.dom.style, {
    position: "fixed", left: "auto", right: "8px", top: "8px", zIndex: "100000",
  });
  stats.dom.title = "Click to switch FPS, frame time and memory panels";
  document.body.appendChild(stats.dom);

  let animationFrame = 0;
  const update = () => {
    stats.update();
    animationFrame = requestAnimationFrame(update);
  };
  animationFrame = requestAnimationFrame(update);

  window.__PERFORMANCE_TOOLS__ ??= {};
  Object.assign(window.__PERFORMANCE_TOOLS__, {
    stats: true,
    reactScan: true,
    stop: () => {
      cancelAnimationFrame(animationFrame);
      stats.dom.remove();
    },
  });
}

export function initializePerformanceMonitoring() {
  monitorWebVitals();
  void monitorDevelopmentRendering().catch((error: unknown) => {
    console.error("Unable to initialize development performance tools", error);
  });
}
