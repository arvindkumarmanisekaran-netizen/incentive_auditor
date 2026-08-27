import { useEffect, useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { BarChart, CustomChart, GaugeChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
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
import type { CustomSeriesRenderItem } from "echarts";

echarts.use([
  BarChart,
  CustomChart,
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
  lime: "#22d3ee",
  limeSoft: "#60a5fa",
  mint: "#2dd4bf",
  amber: "#f472b6",
  danger: "#fb7185",
  steel: "#93c5fd",
  grid: "rgba(56,189,248,0.16)",
  text: "#a9c7f7",
  textStrong: "#eaf6ff",
};

const SIGNAL_FONT = '"Manrope Variable", Manrope, Inter, system-ui, sans-serif';

const renderDimensionalBar: CustomSeriesRenderItem = (params, api) => {
  const payload = params.itemPayload as { horizontal?: boolean; barCount?: number; barIndex?: number };
  const horizontal = Boolean(payload.horizontal);
  const barCount = Math.max(1, Number(payload.barCount ?? 1));
  const barIndex = Number(payload.barIndex ?? 0);
  const value = Number(api.value(1) ?? 0);
  const category = Number(api.value(0) ?? params.dataIndex);
  const valuePoint = api.coord(horizontal ? [value, category] : [category, value]);
  const zeroPoint = api.coord(horizontal ? [0, category] : [category, 0]);
  const rawCategorySize = api.size?.(horizontal ? [0, 1] : [1, 0]);
  const categorySize = Array.isArray(rawCategorySize)
    ? Number(rawCategorySize[horizontal ? 1 : 0])
    : Number(rawCategorySize ?? 46);
  const available = Math.min(categorySize * .68, horizontal ? 28 : 82);
  const width = Math.max(9, available * (barCount > 1 ? .38 : .55));
  const projectedDepthX = Math.max(8, Math.min(19, width * .48));
  const projectedDepthY = Math.max(6, Math.min(13, width * .31));
  const zOffsetX = (barCount - 1 - barIndex) * projectedDepthX * .92;
  const zOffsetY = (barCount - 1 - barIndex) * -projectedDepthY * .92;
  const fill = (api.visual("color") ?? SIGNAL_CHART.lime) as string;
  const light = "rgba(219,234,254,.96)";
  const dark = "rgba(30,64,175,.82)";
  const depthX = projectedDepthX;
  const depthY = projectedDepthY;

  if (horizontal) {
    const startX = zeroPoint[0];
    const endX = valuePoint[0];
    const left = Math.min(startX, endX);
    const right = Math.max(startX, endX);
    const top = valuePoint[1] - width / 2 + zOffsetY;
    const bottom = top + width;
    const capX = value >= 0 ? right : left;
    const direction = value >= 0 ? 1 : -1;
    return {
      type: "group",
      children: [
        { type: "polygon", shape: { points: [[left, top], [right, top], [right, bottom], [left, bottom]] }, style: { fill, opacity: .58, stroke: "rgba(165,243,252,.78)", lineWidth: 1, shadowBlur: 10, shadowColor: "rgba(34,211,238,.3)", shadowOffsetY: 5 } },
        { type: "polygon", shape: { points: [[left, top], [right, top], [right + depthX * direction, top - depthY], [left + depthX * direction, top - depthY]] }, style: { fill: light, opacity: .7, stroke: "rgba(224,242,254,.9)", lineWidth: 1 } },
        { type: "polygon", shape: { points: [[capX, top], [capX + depthX * direction, top - depthY], [capX + depthX * direction, bottom - depthY], [capX, bottom]] }, style: { fill: dark, opacity: .5, stroke: "rgba(96,165,250,.8)", lineWidth: 1 } },
      ],
    };
  }

  const centerX = valuePoint[0] + zOffsetX;
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const top = Math.min(valuePoint[1], zeroPoint[1]);
  const bottom = Math.max(valuePoint[1], zeroPoint[1]);
  const capY = value >= 0 ? top : bottom;
  const direction = value >= 0 ? -1 : 1;
  const facadeLines = Array.from({ length: 5 }, (_, lineIndex) => {
    const y = top + ((bottom - top) * (lineIndex + 1)) / 6;
    return {
      type: "line" as const,
      shape: { x1: left + 3, y1: y, x2: right - 2, y2: y },
      style: { stroke: "rgba(207,250,254,.24)", lineWidth: .7 },
    };
  });
  return {
    type: "group",
    children: [
      { type: "polygon", shape: { points: [[left, top], [right, top], [right, bottom], [left, bottom]] }, style: { fill, opacity: .58, stroke: "rgba(165,243,252,.8)", lineWidth: 1, shadowBlur: 12, shadowColor: "rgba(34,211,238,.34)", shadowOffsetX: 6, shadowOffsetY: 8 } },
      { type: "polygon", shape: { points: [[left, capY], [left + depthX, capY + depthY * direction], [right + depthX, capY + depthY * direction], [right, capY]] }, style: { fill: light, opacity: .72, stroke: "rgba(224,242,254,.95)", lineWidth: 1 } },
      { type: "polygon", shape: { points: [[right, top], [right + depthX, top - depthY], [right + depthX, bottom - depthY], [right, bottom]] }, style: { fill: dark, opacity: .48, stroke: "rgba(96,165,250,.82)", lineWidth: 1 } },
      { type: "polygon", shape: { points: [[left - 3, zeroPoint[1] + 4], [right + depthX + 5, zeroPoint[1] + 4], [right + depthX + 11, zeroPoint[1] - 3], [left + 4, zeroPoint[1] - 3]] }, style: { fill, opacity: .16, stroke: "rgba(34,211,238,.55)", lineWidth: 1, shadowBlur: 9, shadowColor: "rgba(34,211,238,.42)" } },
      ...(value >= 0 ? [{ type: "polygon" as const, shape: { points: [[left + 4, top - 1], [left + depthX + 3, top - depthY + 2], [right + depthX - 3, top - depthY + 2], [right - 4, top - 1]] }, style: { fill: "rgba(255,255,255,.22)", stroke: "rgba(165,243,252,.72)", lineWidth: .8 } }] : []),
      ...facadeLines,
    ],
  };
};

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
  const xAxis = (Array.isArray(incoming.xAxis) ? incoming.xAxis[0] : incoming.xAxis ?? {}) as Record<string, unknown>;
  const yAxis = (Array.isArray(incoming.yAxis) ? incoming.yAxis[0] : incoming.yAxis ?? {}) as Record<string, unknown>;
  const horizontalBars = xAxis.type === "value" && yAxis.type === "category";
  const barSeries = rawSeries.filter((entry) => (entry as Record<string, unknown>).type === "bar");
  let barIndex = 0;
  const series = rawSeries.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    const type = item.type;
    const itemStyle = (item.itemStyle ?? {}) as Record<string, unknown>;
    const lineStyle = (item.lineStyle ?? {}) as Record<string, unknown>;
    const sourceColor = typeof itemStyle.color === "string"
      ? itemStyle.color
      : [SIGNAL_CHART.lime, SIGNAL_CHART.mint, SIGNAL_CHART.amber, SIGNAL_CHART.danger][index % 4];
    const dimensionalStyle = type === "bar" ? {
      showBackground: item.showBackground ?? true,
      backgroundStyle: {
        color: "rgba(37,99,235,0.035)",
        borderColor: "rgba(37,99,235,0.075)",
        borderWidth: 1,
        borderRadius: 5,
        ...((item.backgroundStyle ?? {}) as Record<string, unknown>),
      },
      itemStyle: {
        ...itemStyle,
        color: typeof itemStyle.color === "function" ? itemStyle.color : new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: "#dbeafe" },
          { offset: .18, color: sourceColor },
          { offset: .72, color: sourceColor },
          { offset: 1, color: "#1e3a8a" },
        ]),
        borderColor: "rgba(255,255,255,.78)",
        borderWidth: 1,
        borderRadius: itemStyle.borderRadius ?? [5, 5, 1, 1],
        shadowBlur: 9,
        shadowColor: "rgba(30,64,175,.25)",
        shadowOffsetX: 4,
        shadowOffsetY: 6,
      },
      emphasis: {
        ...((item.emphasis ?? {}) as Record<string, unknown>),
        itemStyle: { shadowBlur: 18, shadowColor: "rgba(14,165,233,.42)", shadowOffsetX: 5, shadowOffsetY: 8 },
      },
    } : type === "line" ? {
      symbol: item.symbol ?? "circle",
      symbolSize: item.symbolSize ?? 7,
      lineStyle: {
        ...lineStyle,
        width: lineStyle.width ?? 3,
        shadowBlur: 8,
        shadowColor: "rgba(37,99,235,.3)",
        shadowOffsetY: 5,
      },
      itemStyle: {
        ...itemStyle,
        borderColor: "#fff",
        borderWidth: 2,
        shadowBlur: 9,
        shadowColor: "rgba(37,99,235,.38)",
      },
    } : type === "pie" ? {
      padAngle: item.padAngle ?? 2,
      itemStyle: {
        ...itemStyle,
        borderColor: "rgba(255,255,255,.9)",
        borderWidth: 2,
        shadowBlur: 12,
        shadowColor: "rgba(30,64,175,.24)",
        shadowOffsetX: 5,
        shadowOffsetY: 8,
      },
    } : type === "gauge" ? {
      progress: { ...((item.progress ?? {}) as Record<string, unknown>), roundCap: true, shadowBlur: 10, shadowColor: "rgba(37,99,235,.3)" },
      axisLine: { ...((item.axisLine ?? {}) as Record<string, unknown>), roundCap: true, shadowBlur: 7, shadowColor: "rgba(37,99,235,.16)" },
    } : {};
    if (type === "bar") {
      const currentBarIndex = barIndex++;
      const data = Array.isArray(item.data) ? item.data : [];
      return {
        ...item,
        type: "custom",
        coordinateSystem: "cartesian2d",
        renderItem: renderDimensionalBar,
        clip: false,
        encode: horizontalBars ? { x: 1, y: 0, tooltip: 1 } : { x: 0, y: 1, tooltip: 1 },
        itemPayload: { isDimensionalBar: true, horizontal: horizontalBars, valueDimension: 1, barCount: barSeries.length, barIndex: currentBarIndex },
        data: data.map((datum, dataIndex) => {
          const record = datum && typeof datum === "object" && !Array.isArray(datum) ? datum as Record<string, unknown> : undefined;
          const value = Number(record?.value ?? datum ?? 0);
          return { ...record, value: [dataIndex, value] };
        }),
        animation: true,
        animationDuration: 900,
      };
    }
    return {
      animation: true,
      animationDuration: type === "pie" ? 1100 : 900,
      animationDurationUpdate: type === "pie" ? 1200 : 950,
      animationDelay: index * 90,
      animationDelayUpdate: index * 90,
      animationEasing: "cubicOut",
      ...(type === "pie" ? { animationType: "scale", animationTypeUpdate: "transition" } : {}),
      ...item,
      ...dimensionalStyle,
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
    xAxis: isAxisChart || incoming.xAxis ? mergeChartComponent({
      axisLine: { show: true, lineStyle: { color: "rgba(56,189,248,0.48)", width: 1 } },
      axisTick: { show: false },
      axisLabel: { color: SIGNAL_CHART.text, fontSize: 10, hideOverlap: true },
      splitLine: { show: false },
    }, incoming.xAxis) : undefined,
    yAxis: isAxisChart || incoming.yAxis ? mergeChartComponent({
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: SIGNAL_CHART.text, fontSize: 10, hideOverlap: true },
      splitLine: { lineStyle: { color: SIGNAL_CHART.grid, type: "dashed" } },
    }, incoming.yAxis) : undefined,
    legend: incoming.legend ? mergeChartComponent({
      textStyle: { color: SIGNAL_CHART.text, fontSize: 10, fontFamily: SIGNAL_FONT },
    }, incoming.legend) : incoming.legend,
    tooltip: { show: true, trigger: isAxisChart ? "axis" : "item", appendToBody: true, confine: false, axisPointer: { type: "shadow", shadowStyle: { color: "rgba(37,99,235,0.055)" } }, ...(option.tooltip as object),
      formatter: incomingTooltip.formatter ?? (isAxisChart ? compactTooltipFormatter : undefined),
      backgroundColor: "rgba(5,18,43,0.97)", borderColor: "rgba(34,211,238,0.38)",
      borderWidth: 1, borderRadius: 10, padding: [9, 11],
      extraCssText: `z-index:10000;max-width:260px;box-shadow:0 18px 46px rgba(2,8,23,.42),0 0 20px rgba(34,211,238,.15);font-family:${SIGNAL_FONT};line-height:1.4;`,
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

      if (type === "custom" && (item.itemPayload as Record<string, unknown> | undefined)?.isDimensionalBar) {
        const valueDimension = Number((item.itemPayload as Record<string, unknown>).valueDimension ?? 1);
        return { ...item, animation: false, data: data.map((datum) => {
          const record = datum as Record<string, unknown>;
          const value = Array.isArray(record.value) ? [...record.value] : [0, 0];
          value[valueDimension] = 0;
          return { ...record, value };
        }) };
      }

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
