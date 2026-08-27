import { useEffect, useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { BarChart, GaugeChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import type { EChartsType } from "echarts/core";

echarts.use([
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  ScatterChart,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

type SignalChartProps = {
  option: EChartsCoreOption;
  className?: string;
  height?: number | string;
  ariaLabel?: string;
};

// Shared with chart-option factories colocated in feature components.
// eslint-disable-next-line react-refresh/only-export-components
export const SIGNAL_CHART = {
  lime: "#2563eb",
  limeSoft: "#60a5fa",
  mint: "#06b6d4",
  amber: "#f59e0b",
  danger: "#ef4444",
  steel: "#64748b",
  grid: "rgba(37,99,235,0.09)",
  text: "#64748b",
  textStrong: "#0f172a",
};

const SIGNAL_FONT = '"Manrope Variable", Manrope, Inter, system-ui, sans-serif';

function mergeChartComponent(
  defaults: Record<string, unknown>,
  incoming: unknown,
): unknown {
  if (Array.isArray(incoming)) {
    return incoming.map((item) => mergeChartComponent(defaults, item));
  }

  const item = incoming && typeof incoming === "object"
    ? incoming as Record<string, unknown>
    : {};

  return {
    ...defaults,
    ...item,
    textStyle: {
      ...(defaults.textStyle as Record<string, unknown> | undefined),
      ...(item.textStyle as Record<string, unknown> | undefined),
      fontFamily: SIGNAL_FONT,
    },
    axisLine: {
      ...(defaults.axisLine as Record<string, unknown> | undefined),
      ...(item.axisLine as Record<string, unknown> | undefined),
    },
    axisLabel: {
      ...(defaults.axisLabel as Record<string, unknown> | undefined),
      ...(item.axisLabel as Record<string, unknown> | undefined),
      fontFamily: SIGNAL_FONT,
    },
    nameTextStyle: {
      color: SIGNAL_CHART.text,
      fontFamily: SIGNAL_FONT,
      fontSize: 10,
      ...(item.nameTextStyle as Record<string, unknown> | undefined),
    },
  };
}

function escapeTooltipText(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function withSignalTheme(option: EChartsCoreOption): EChartsCoreOption {
  const incoming = option as Record<string, unknown>;
  const rawSeries = Array.isArray(incoming.series) ? incoming.series : [];
  const series = rawSeries.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    const type = item.type;
    return {
      animation: true,
      animationDuration: type === "pie" ? 1100 : 900,
      animationDurationUpdate: type === "pie" ? 1200 : 950,
      animationDelay: index * 90,
      animationDelayUpdate: index * 90,
      animationEasing: "cubicOut",
      ...(type === "pie" ? { animationType: "scale", animationTypeUpdate: "transition" } : {}),
      ...item,
    };
  });
  const incomingTooltip = (incoming.tooltip ?? {}) as Record<string, unknown>;
  const valueFormatter = incomingTooltip.valueFormatter;
  const compactTooltipFormatter = (params: unknown) => {
    const items = (Array.isArray(params) ? params : [params]) as Array<Record<string, unknown>>;

    if (items.length === 0) return "";

    const heading = escapeTooltipText(items[0]?.axisValueLabel ?? items[0]?.name);
    const rows = items.map((item) => {
      const rawValue = Array.isArray(item.value) ? item.value.at(-1) : item.value;
      const formattedValue = typeof valueFormatter === "function"
        ? (valueFormatter as (value: unknown) => unknown)(rawValue)
        : rawValue;

      return `<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">${item.marker ?? ""}<span>${escapeTooltipText(item.seriesName)}</span><strong style="margin-left:3px;font-weight:750;">${escapeTooltipText(formattedValue)}</strong></div>`;
    }).join("");

    return `${heading ? `<strong style="display:block;margin-bottom:4px;">${heading}</strong>` : ""}${rows}`;
  };
  const isAxisChart = rawSeries.some((entry) => {
    const type = (entry as Record<string, unknown>).type;
    return type === "bar" || type === "line" || type === "scatter";
  });

  return {
    animation: true,
    animationDuration: 850,
    animationDurationUpdate: 1000,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicInOut",
    backgroundColor: "transparent",
    color: [
      SIGNAL_CHART.lime,
      SIGNAL_CHART.mint,
      SIGNAL_CHART.amber,
      SIGNAL_CHART.danger,
      SIGNAL_CHART.limeSoft,
    ],
    textStyle: {
      color: SIGNAL_CHART.text,
      fontFamily: SIGNAL_FONT,
      fontSize: 10,
    },
    ...option,
    grid: {
      top: 26,
      right: 18,
      bottom: 44,
      left: 52,
      containLabel: true,
      ...(incoming.grid as Record<string, unknown> | undefined),
    },
    xAxis: mergeChartComponent({
      axisLine: { show: true, lineStyle: { color: "rgba(37,99,235,0.28)", width: 1 } },
      axisTick: { show: false },
      axisLabel: { color: SIGNAL_CHART.text, fontSize: 10, hideOverlap: true },
      splitLine: { show: false },
    }, incoming.xAxis),
    yAxis: mergeChartComponent({
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: SIGNAL_CHART.text, fontSize: 10, hideOverlap: true },
      splitLine: { lineStyle: { color: SIGNAL_CHART.grid, type: "dashed" } },
    }, incoming.yAxis),
    legend: incoming.legend ? mergeChartComponent({
      textStyle: { color: SIGNAL_CHART.text, fontSize: 10, fontFamily: SIGNAL_FONT },
    }, incoming.legend) : incoming.legend,
    tooltip: { show: true, trigger: isAxisChart ? "axis" : "item", appendToBody: true, confine: false, axisPointer: { type: "shadow", shadowStyle: { color: "rgba(37,99,235,0.055)" } }, ...(option.tooltip as object),
      formatter: incomingTooltip.formatter ?? (isAxisChart ? compactTooltipFormatter : undefined),
      backgroundColor: "rgba(255,255,255,0.98)", borderColor: "rgba(37,99,235,0.16)",
      borderWidth: 1, borderRadius: 10, padding: [9, 11],
      extraCssText: `z-index:10000;max-width:260px;box-shadow:0 14px 38px rgba(15,23,42,.14);font-family:${SIGNAL_FONT};line-height:1.4;`,
      textStyle: { color: SIGNAL_CHART.textStrong, fontSize: 11, fontFamily: SIGNAL_FONT },
    },
    series,
  };
}

function createIntroOption(option: EChartsCoreOption): EChartsCoreOption {
  const themed = withSignalTheme(option) as Record<string, unknown>;
  const series = Array.isArray(themed.series) ? themed.series : [];

  return {
    ...themed,
    animation: false,
    tooltip: { ...(themed.tooltip as object), show: false },
    series: series.map((entry) => {
      const item = entry as Record<string, unknown>;
      const type = item.type;
      const data = Array.isArray(item.data) ? item.data : [];

      if (type === "scatter") {
        return { ...item, animation: false, symbolSize: 0 };
      }

      const introData = data.map((datum) => {
        if (typeof datum === "number") return 0;
        if (Array.isArray(datum)) return datum.map((value, index) => index === 0 ? value : 0);
        if (datum && typeof datum === "object") {
          return { ...(datum as Record<string, unknown>), value: type === "pie" ? 0.0001 : 0 };
        }
        return datum;
      });

      return { ...item, animation: false, data: introData };
    }),
  };
}

export default function SignalChart({
  option,
  className = "",
  height = "100%",
  ariaLabel = "Interactive data chart",
}: SignalChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const introTimerRef = useRef<number>(0);
  const hasAnimatedRef = useRef(false);
  const latestOptionRef = useRef(option);
  latestOptionRef.current = option;
  const reducedMotion = useReducedMotion();
  const isFirstView = useInView(viewportRef, { once: true, amount: 0.2 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !isFirstView) return;

    const chart = echarts.init(element, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    let resizeFrame = 0;

    const firstOption = latestOptionRef.current;
    if (reducedMotion) {
      chart.setOption(withSignalTheme(firstOption), { notMerge: true });
      hasAnimatedRef.current = true;
    } else {
      chart.setOption(createIntroOption(firstOption), { notMerge: true, lazyUpdate: false });
      introTimerRef.current = window.setTimeout(() => {
        if (chart.isDisposed()) return;
        chart.setOption(withSignalTheme(latestOptionRef.current), { notMerge: false, lazyUpdate: false });
        hasAnimatedRef.current = true;
      }, 120);
    }

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => chart.resize());
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      clearTimeout(introTimerRef.current);
      chart.dispose();
      chartRef.current = null;
    };
  }, [isFirstView, reducedMotion]);

  useEffect(() => {
    if (!isFirstView || !chartRef.current) return;
    const chart = chartRef.current;
    if (hasAnimatedRef.current) chart.setOption(withSignalTheme(option), { notMerge: true });
  }, [isFirstView, option]);

  return (
    <motion.div
      ref={viewportRef}
      className={`signal-chart ${className}`.trim()}
      style={{ height }}
      initial={{ opacity: 0, y: 10 }}
      animate={isFirstView ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="img"
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="signal-chart-canvas" />
      <span className="signal-chart-corner" aria-hidden="true" />
    </motion.div>
  );
}
