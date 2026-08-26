import { useEffect, useRef } from "react";
import { motion, useInView } from "motion/react";
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
  lime: "#b9ff66",
  limeSoft: "#82b94d",
  mint: "#64d8b4",
  amber: "#f5c96a",
  danger: "#ff766e",
  steel: "#7d8a78",
  grid: "rgba(185,255,102,0.08)",
  text: "#778178",
  textStrong: "#dce4da",
};

function withSignalTheme(option: EChartsCoreOption): EChartsCoreOption {
  return {
    animation: true,
    animationDuration: 850,
    animationDurationUpdate: 480,
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
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
      fontSize: 10,
    },
    grid: {
      top: 26,
      right: 18,
      bottom: 44,
      left: 52,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(8,11,9,0.96)",
      borderColor: "rgba(185,255,102,0.24)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: SIGNAL_CHART.textStrong, fontSize: 11 },
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(185,255,102,0.035)" } },
    },
    xAxis: {
      axisLine: { lineStyle: { color: "rgba(185,255,102,0.12)" } },
      axisTick: { show: false },
      axisLabel: { color: SIGNAL_CHART.text, fontSize: 9 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: SIGNAL_CHART.text, fontSize: 9 },
      splitLine: { lineStyle: { color: SIGNAL_CHART.grid, type: "dashed" } },
    },
    ...option,
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
  const isFirstView = useInView(viewportRef, { once: true, amount: 0.2 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !isFirstView) return;

    const chart = echarts.init(element, undefined, { renderer: "canvas" });
    chart.setOption(withSignalTheme(option), { notMerge: true });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [isFirstView, option]);

  return (
    <motion.div
      ref={viewportRef}
      className={`signal-chart ${className}`.trim()}
      style={{ height }}
      initial={{ opacity: 0, scale: 0.985, filter: "blur(4px)" }}
      animate={isFirstView ? { opacity: 1, scale: 1, filter: "blur(0px)" } : undefined}
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
