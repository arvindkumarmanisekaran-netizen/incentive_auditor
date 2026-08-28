import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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

type FloatingTooltip = {
  x: number;
  y: number;
  title: string;
  context?: string;
  value: string;
  color?: string;
  rows?: Array<{ label: string; value: string; color: string }>;
};

function safeTooltipPosition(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(150, Math.min(window.innerWidth - 150, x)),
    y: Math.max(96, Math.min(window.innerHeight - 18, y)),
  };
}

function ChartTooltipPortal({ tooltip }: { tooltip: FloatingTooltip | null }) {
  if (!tooltip || typeof document === "undefined") return null;
  return createPortal(
    <div className="chart-tooltip-portal" style={{ left: tooltip.x, top: tooltip.y }} role="tooltip">
      <strong>{tooltip.title}</strong>
      {tooltip.context && <span>{tooltip.context}</span>}
      {tooltip.rows?.length
        ? tooltip.rows.map((row) => <b key={row.label}><i style={{ background: row.color }} />{row.label}: {row.value}</b>)
        : <b><i style={{ background: tooltip.color }} />{tooltip.value}</b>}
    </div>,
    document.body,
  );
}

// Shared with chart-option factories colocated in feature components.
// eslint-disable-next-line react-refresh/only-export-components
export const SIGNAL_CHART = {
  lime: "#2563eb",
  limeSoft: "#60a5fa",
  mint: "#06b6d4",
  amber: "#d946ef",
  danger: "#e11d48",
  steel: "#64748b",
  grid: "rgba(37,99,235,0.10)",
  text: "#64748b",
  textStrong: "#0f172a",
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
      color: "#334155",
      fontFamily: SIGNAL_FONT,
    },
    axisLine: {
      ...(defaults.axisLine as Record<string, unknown> | undefined),
      ...(item.axisLine as Record<string, unknown> | undefined),
    },
    axisLabel: {
      ...(defaults.axisLabel as Record<string, unknown> | undefined),
      ...(item.axisLabel as Record<string, unknown> | undefined),
      color: "#334155",
      fontFamily: SIGNAL_FONT,
      fontSize: 11,
      fontWeight: 600,
    },
    nameTextStyle: {
      ...(item.nameTextStyle as Record<string, unknown> | undefined),
      color: "#334155",
      fontFamily: SIGNAL_FONT,
      fontSize: 11,
      fontWeight: 650,
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
  const themedSeries = rawSeries.map((entry, index) => {
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
        opacity: itemStyle.opacity ?? .84,
        shadowBlur: 16,
        shadowColor: "rgba(14,165,233,.34)",
        shadowOffsetX: 6,
        shadowOffsetY: 10,
      },
      emphasis: {
        ...((item.emphasis ?? {}) as Record<string, unknown>),
        scale: true,
        scaleSize: 5,
        itemStyle: { opacity: .96, shadowBlur: 24, shadowColor: "rgba(37,99,235,.42)" },
      },
    } : type === "gauge" ? {
      progress: { ...((item.progress ?? {}) as Record<string, unknown>), roundCap: true, shadowBlur: 16, shadowColor: "rgba(14,165,233,.38)" },
      axisLine: { ...((item.axisLine ?? {}) as Record<string, unknown>), roundCap: true, shadowBlur: 10, shadowColor: "rgba(37,99,235,.20)" },
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
  const series = themedSeries.flatMap((entry) => {
    const item = entry as Record<string, unknown>;
    if (item.type !== "pie") return [item];

    const center = Array.isArray(item.center) ? item.center : ["50%", "50%"];
    const verticalCenter = center[1] ?? "50%";
    const extrusionCenter = [
      center[0] ?? "50%",
      typeof verticalCenter === "number"
        ? verticalCenter + 8
        : `${Number.parseFloat(String(verticalCenter)) + 3}%`,
    ];

    const extrusion = {
      ...item,
      name: `${String(item.name ?? "Radial chart")} depth`,
      center: extrusionCenter,
      z: 0,
      zlevel: 0,
      silent: true,
      tooltip: { show: false },
      label: { show: false },
      labelLine: { show: false },
      animation: false,
      itemStyle: {
        ...((item.itemStyle ?? {}) as Record<string, unknown>),
        opacity: .28,
        borderWidth: 0,
        shadowBlur: 18,
        shadowColor: "rgba(30,64,175,.32)",
        shadowOffsetX: 7,
        shadowOffsetY: 12,
      },
      emphasis: { disabled: true },
    };

    return [extrusion, { ...item, z: 3, zlevel: 1 }];
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
      axisLine: { show: true, lineStyle: { color: "rgba(37,99,235,0.30)", width: 1 } },
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
      backgroundColor: "rgba(255,255,255,0.98)", borderColor: "rgba(37,99,235,0.18)",
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

function isVerticalBarOption(option: EChartsCoreOption) {
  const incoming = option as Record<string, unknown>;
  const xAxis = (Array.isArray(incoming.xAxis) ? incoming.xAxis[0] : incoming.xAxis ?? {}) as Record<string, unknown>;
  const series = Array.isArray(incoming.series) ? incoming.series : [];
  return xAxis.type === "category" && series.some((entry) => (entry as Record<string, unknown>).type === "bar");
}

function isHorizontalBarOption(option: EChartsCoreOption) {
  const incoming = option as Record<string, unknown>;
  const yAxis = (Array.isArray(incoming.yAxis) ? incoming.yAxis[0] : incoming.yAxis ?? {}) as Record<string, unknown>;
  const series = Array.isArray(incoming.series) ? incoming.series : [];
  return yAxis.type === "category" && series.some((entry) => (entry as Record<string, unknown>).type === "bar");
}

function isRadialOption(option: EChartsCoreOption) {
  const incoming = option as Record<string, unknown>;
  const series = Array.isArray(incoming.series) ? incoming.series : [];
  return series.some((entry) => {
    const type = (entry as Record<string, unknown>).type;
    return type === "pie" || type === "gauge";
  });
}

function isGaugeOption(option: EChartsCoreOption) {
  const incoming = option as Record<string, unknown>;
  const series = Array.isArray(incoming.series) ? incoming.series : [];
  return series.some((entry) => (entry as Record<string, unknown>).type === "gauge");
}

function isPieOption(option: EChartsCoreOption) {
  const incoming = option as Record<string, unknown>;
  const series = Array.isArray(incoming.series) ? incoming.series : [];
  return series.some((entry) => (entry as Record<string, unknown>).type === "pie");
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function donutSegmentPath(startAngle: number, endAngle: number, outerRadius = 68, innerRadius = 42) {
  const cx = 120;
  const cy = 88;
  const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, endAngle);
  const innerEnd = polarPoint(cx, cy, innerRadius, endAngle);
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function HolographicPieChart({ option, height, ariaLabel, className }: SignalChartProps) {
  const incoming = option as Record<string, unknown>;
  const pie = ((Array.isArray(incoming.series) ? incoming.series : [])
    .find((entry) => (entry as Record<string, unknown>).type === "pie") ?? {}) as Record<string, unknown>;
  const data = (Array.isArray(pie.data) ? pie.data : []).map((datum, index) => {
    const record = datum && typeof datum === "object" ? datum as Record<string, unknown> : {};
    const style = (record.itemStyle ?? {}) as Record<string, unknown>;
    return {
      name: String(record.name ?? `Segment ${index + 1}`),
      value: Math.max(0, Number(record.value ?? 0)),
      color: typeof style.color === "string"
        ? style.color
        : [SIGNAL_CHART.lime, SIGNAL_CHART.mint, SIGNAL_CHART.amber, SIGNAL_CHART.danger][index % 4],
    };
  });
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  let cursor = -90;
  const segments = data.map((item) => {
    const sweep = (item.value / total) * 360;
    const padding = Math.min(2.4, sweep * .12);
    const start = cursor + padding / 2;
    const end = cursor + sweep - padding / 2;
    cursor += sweep;
    return { ...item, path: donutSegmentPath(start, Math.max(start + .1, end)), percent: item.value / total * 100 };
  });
  const [tooltip, setTooltip] = useState<FloatingTooltip | null>(null);

  return (
    <div className={`signal-chart holographic-pie-chart radial-hologram-chart ${className ?? ""}`.trim()} style={{ height }} role="img" aria-label={ariaLabel}>
      <span className="radial-hologram-platform" aria-hidden="true" />
      <svg className="holographic-pie-svg" viewBox="0 0 240 190" aria-hidden="true">
        {[16, 12, 8, 4].map((depth, layerIndex) => (
          <g className="holographic-pie-depth" data-layer={layerIndex} transform={`translate(0 ${depth})`} key={`depth-layer-${depth}`}>
            {segments.map((segment) => <path key={`depth-${depth}-${segment.name}`} d={segment.path} fill={segment.color} />)}
          </g>
        ))}
        <g className="holographic-pie-surface">
          {segments.map((segment, index) => (
            <path
              className="holographic-pie-segment"
              key={segment.name}
              d={segment.path}
              fill={segment.color}
              style={{ "--pie-enter-delay": `${index * 75}ms` } as CSSProperties}
            />
          ))}
        </g>
        <g className="holographic-pie-hit-targets">
          {segments.map((segment) => (
            <path
              key={`hit-${segment.name}`}
              d={segment.path}
              tabIndex={0}
              aria-label={`${segment.name}: ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 }).format(segment.value)}, ${segment.percent.toFixed(2)}%`}
              onMouseMove={(event) => setTooltip({ ...safeTooltipPosition(event.clientX, event.clientY), title: segment.name, context: `${segment.percent.toFixed(2)}%`, value: new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 }).format(segment.value), color: segment.color })}
              onMouseLeave={() => setTooltip(null)}
              onFocus={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setTooltip({ ...safeTooltipPosition(rect.left + rect.width / 2, rect.top), title: segment.name, context: `${segment.percent.toFixed(2)}%`, value: new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 }).format(segment.value), color: segment.color });
              }}
              onBlur={() => setTooltip(null)}
            />
          ))}
        </g>
        <ellipse className="holographic-pie-inner-glow" cx="120" cy="96" rx="39" ry="18" />
      </svg>
      <span className="holographic-pie-beam" aria-hidden="true" />
      <div className="holographic-pie-legend">
        {segments.map((segment) => <span key={`legend-${segment.name}`}><i style={{ background: segment.color }} />{segment.name}</span>)}
      </div>
      <ChartTooltipPortal tooltip={tooltip} />
    </div>
  );
}

function HolographicGaugeChart({ option, height, ariaLabel, className }: SignalChartProps) {
  const incoming = option as Record<string, unknown>;
  const gauge = ((Array.isArray(incoming.series) ? incoming.series : [])
    .find((entry) => (entry as Record<string, unknown>).type === "gauge") ?? {}) as Record<string, unknown>;
  const datum = (Array.isArray(gauge.data) ? gauge.data[0] : {}) as Record<string, unknown>;
  const value = Math.max(0, Math.min(100, Number(datum?.value ?? 0)));
  const label = String(datum?.name ?? ariaLabel ?? "Value");
  const progress = (gauge.progress ?? {}) as Record<string, unknown>;
  const progressStyle = (progress.itemStyle ?? {}) as Record<string, unknown>;
  const color = typeof progressStyle.color === "string" ? progressStyle.color : SIGNAL_CHART.lime;
  const gaugeId = useId().replaceAll(":", "");
  const [tooltip, setTooltip] = useState<FloatingTooltip | null>(null);
  const showTooltip = (x: number, y: number) => setTooltip({
    ...safeTooltipPosition(x, y),
    title: label,
    value: `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 }).format(value)}%`,
    color,
  });

  return (
    <div
      className={`signal-chart holographic-gauge-chart radial-hologram-chart ${className ?? ""}`.trim()}
      style={{ height }}
      role="img"
      aria-label={`${ariaLabel}: ${value}%`}
      tabIndex={0}
      onMouseMove={(event) => showTooltip(event.clientX, event.clientY)}
      onMouseLeave={() => setTooltip(null)}
      onFocus={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        showTooltip(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }}
      onBlur={() => setTooltip(null)}
    >
      <span className="radial-hologram-platform" aria-hidden="true" />
      <svg className="holographic-gauge-svg" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <filter id={`gauge-glow-${gaugeId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={`gauge-shine-${gaugeId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e0f2fe" stopOpacity=".95" />
            <stop offset=".28" stopColor={color} stopOpacity=".86" />
            <stop offset="1" stopColor="#2563eb" stopOpacity=".72" />
          </linearGradient>
        </defs>
        <circle className="gauge-depth" cx="100" cy="106" r="70" pathLength="100" />
        <circle className="gauge-track" cx="100" cy="100" r="70" pathLength="100" />
        <circle className="gauge-progress-glow" cx="100" cy="100" r="70" pathLength="100" style={{ "--gauge-progress": `${value * .6667}` } as CSSProperties} />
        <circle className="gauge-progress" cx="100" cy="100" r="70" pathLength="100" style={{ "--gauge-progress": `${value * .6667}`, stroke: `url(#gauge-shine-${gaugeId})`, filter: `url(#gauge-glow-${gaugeId})` } as CSSProperties} />
      </svg>
      <div className="holographic-gauge-value"><strong>{value.toFixed(value % 1 === 0 ? 0 : 2)}%</strong><span>{label}</span></div>
      <ChartTooltipPortal tooltip={tooltip} />
    </div>
  );
}

function SkyscraperChart({ option, height, ariaLabel, className }: SignalChartProps) {
  const incoming = option as Record<string, unknown>;
  const xAxis = (Array.isArray(incoming.xAxis) ? incoming.xAxis[0] : incoming.xAxis ?? {}) as Record<string, unknown>;
  const categories = Array.isArray(xAxis.data) ? xAxis.data.map(String) : [];
  const series = (Array.isArray(incoming.series) ? incoming.series : [])
    .filter((entry) => (entry as Record<string, unknown>).type === "bar") as Array<Record<string, unknown>>;
  const values = series.flatMap((item) => (Array.isArray(item.data) ? item.data : []).map((datum) => {
    const record = datum && typeof datum === "object" ? datum as Record<string, unknown> : undefined;
    return Math.abs(Number(record?.value ?? datum ?? 0));
  }));
  const maximum = Math.max(1, ...values);
  const tooltip = (incoming.tooltip ?? {}) as Record<string, unknown>;
  const valueFormatter = tooltip.valueFormatter;
  const palette = [SIGNAL_CHART.lime, SIGNAL_CHART.amber, SIGNAL_CHART.mint, SIGNAL_CHART.limeSoft];
  const compactGroupedBars = categories.length >= 4 && series.length > 1;
  const towerWidth = compactGroupedBars ? 20 : 34;
  const towerSpacing = compactGroupedBars ? 30 : 52;
  const [tooltipPortal, setTooltipPortal] = useState<FloatingTooltip | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(() => new Set());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useInView(viewportRef, { once: true, amount: .18 });
  const sampleFormatted = typeof valueFormatter === "function"
    ? String((valueFormatter as (raw: unknown) => unknown)(maximum))
    : "";
  const valueKind = sampleFormatted.includes("%") ? "percent" : sampleFormatted.includes("₹") ? "money" : "number";
  const formatAxisValue = (value: number) => {
    if (valueKind === "percent") return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)}%`;
    if (valueKind === "money") return `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
    return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  };
  const axisTicks = [1, .75, .5, .25, 0].map((ratio) => ({ ratio, label: formatAxisValue(maximum * ratio) }));

  const categoryRows = (categoryIndex: number) => series.map((item, seriesIndex) => {
    const data = Array.isArray(item.data) ? item.data : [];
    const datum = data[categoryIndex];
    const record = datum && typeof datum === "object" ? datum as Record<string, unknown> : undefined;
    const value = Number(record?.value ?? datum ?? 0);
    const itemStyle = (record?.itemStyle ?? item.itemStyle ?? {}) as Record<string, unknown>;
    const color = typeof itemStyle.color === "string" ? itemStyle.color : palette[seriesIndex % palette.length];
    const formatted = typeof valueFormatter === "function"
      ? String((valueFormatter as (raw: unknown) => unknown)(value))
      : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 }).format(value);
    return { label: String(item.name ?? "Value"), value: formatted, color };
  });

  return (
    <div ref={viewportRef} className={`signal-chart skyscraper-chart${compactGroupedBars ? " is-compact-grouped" : ""}${isVisible ? " is-entered" : ""}${selectedCategories.size > 0 ? " has-selected-categories" : ""} ${className ?? ""}`.trim()} style={{ height }} role="img" aria-label={ariaLabel}>
      <div className="skyscraper-value-axis" aria-hidden="true">
        {axisTicks.map((tick) => <span key={tick.ratio} style={{ top: `${(1 - tick.ratio) * 100}%` }}>{tick.label}</span>)}
      </div>
      <div className="skyscraper-floor" aria-hidden="true" />
      <div className="skyscraper-city">
        {categories.map((category, categoryIndex) => (
          <div
            className={`skyscraper-block${selectedCategories.has(categoryIndex) ? " is-selected-category" : ""}`}
            key={`${category}-${categoryIndex}`}
            style={{
              left: `${(categoryIndex / Math.max(1, categories.length)) * 100}%`,
              width: `${100 / Math.max(1, categories.length)}%`,
            }}
            role="button"
            tabIndex={0}
            aria-pressed={selectedCategories.has(categoryIndex)}
            aria-label={`${selectedCategories.has(categoryIndex) ? "Deselect" : "Select"} all bars for ${category}`}
            onMouseMove={(event) => setTooltipPortal({
              ...safeTooltipPosition(event.clientX, event.clientY),
              title: category,
              context: series.length > 1 ? "Paired comparison" : String(series[0]?.name ?? "Value"),
              value: "",
              rows: categoryRows(categoryIndex),
            })}
            onMouseLeave={() => setTooltipPortal(null)}
            onFocus={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setTooltipPortal({ ...safeTooltipPosition(rect.left + rect.width / 2, rect.top), title: category, context: series.length > 1 ? "Paired comparison" : String(series[0]?.name ?? "Value"), value: "", rows: categoryRows(categoryIndex) });
            }}
            onBlur={() => setTooltipPortal(null)}
            onClick={() => setSelectedCategories((current) => {
              const next = new Set(current);
              if (next.has(categoryIndex)) next.delete(categoryIndex); else next.add(categoryIndex);
              return next;
            })}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.currentTarget.click();
            }}
          >
            <div className="skyscraper-cluster">
              {series.map((item, seriesIndex) => {
                const data = Array.isArray(item.data) ? item.data : [];
                const datum = data[categoryIndex];
                const record = datum && typeof datum === "object" ? datum as Record<string, unknown> : undefined;
                const value = Number(record?.value ?? datum ?? 0);
                const itemStyle = (record?.itemStyle ?? item.itemStyle ?? {}) as Record<string, unknown>;
                const color = typeof itemStyle.color === "string" ? itemStyle.color : palette[seriesIndex % palette.length];
                const formatted = typeof valueFormatter === "function"
                  ? String((valueFormatter as (raw: unknown) => unknown)(value))
                  : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 }).format(value);
                return (
                  <div
                    className={`skyscraper-tower${value < 0 ? " is-negative" : ""}`}
                    key={`${String(item.name ?? seriesIndex)}-${categoryIndex}-${value}`}
                    style={{
                      "--tower-height": `${Math.max(22, Math.abs(value) / maximum * 148)}px`,
                      "--tower-color": color,
                      "--tower-depth-index": seriesIndex,
                      "--tower-x": `${(seriesIndex - (series.length - 1) / 2) * towerSpacing - towerWidth / 2}px`,
                      "--tower-y": "0px",
                      "--tower-z": "0px",
                      "--tower-enter-delay": `${categoryIndex * 70 + seriesIndex * 55}ms`,
                      zIndex: 3,
                    } as CSSProperties}
                    aria-label={`${String(item.name ?? "Value")}, ${category}: ${formatted}`}
                  >
                    <span className="tower-face tower-front" />
                    <span className="tower-face tower-side" />
                    <span className="tower-face tower-roof" />
                    <span className="tower-windows" />
                  </div>
                );
              })}
            </div>
            <span className="skyscraper-label">{category}</span>
          </div>
        ))}
      </div>
      <ChartTooltipPortal tooltip={tooltipPortal} />
    </div>
  );
}

function HolographicHorizontalBarChart({ option, height, ariaLabel, className }: SignalChartProps) {
  const incoming = option as Record<string, unknown>;
  const xAxis = (Array.isArray(incoming.xAxis) ? incoming.xAxis[0] : incoming.xAxis ?? {}) as Record<string, unknown>;
  const yAxis = (Array.isArray(incoming.yAxis) ? incoming.yAxis[0] : incoming.yAxis ?? {}) as Record<string, unknown>;
  const categories = Array.isArray(yAxis.data) ? yAxis.data.map(String) : [];
  const series = ((Array.isArray(incoming.series) ? incoming.series : [])
    .find((entry) => (entry as Record<string, unknown>).type === "bar") ?? {}) as Record<string, unknown>;
  const data = Array.isArray(series.data) ? series.data : [];
  const values = data.map((datum) => Number(datum && typeof datum === "object" ? (datum as Record<string, unknown>).value : datum) || 0);
  const maximum = Math.max(Number(xAxis.max ?? 0), 1, ...values);
  const markLine = (series.markLine ?? {}) as Record<string, unknown>;
  const markData = Array.isArray(markLine.data) ? markLine.data : [];
  const peerValue = Number((markData[0] as Record<string, unknown> | undefined)?.xAxis ?? 100);
  const itemStyle = (series.itemStyle ?? {}) as Record<string, unknown>;
  const color = typeof itemStyle.color === "string" ? itemStyle.color : SIGNAL_CHART.lime;
  const [tooltip, setTooltip] = useState<FloatingTooltip | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useInView(viewportRef, { once: true, amount: .18 });

  return (
    <div ref={viewportRef} className={`signal-chart holographic-horizontal-chart${isVisible ? " is-entered" : ""} ${className ?? ""}`.trim()} style={{ height }} role="img" aria-label={ariaLabel}>
      <div className="horizontal-chart-grid" aria-hidden="true" />
      <span className="horizontal-peer-marker" style={{ left: `${Math.min(100, peerValue / maximum * 100)}%` }}>Peer 100</span>
      <div className="horizontal-chart-rows">
        {categories.map((category, index) => {
          const value = values[index] ?? 0;
          const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 20 }).format(value);
          return (
            <div className="horizontal-chart-row" key={category}>
              <span className="horizontal-chart-label">{category}</span>
              <div
                className="horizontal-tower-track"
                tabIndex={0}
                onMouseMove={(event) => setTooltip({ ...safeTooltipPosition(event.clientX, event.clientY), title: category, context: String(series.name ?? "Representative index"), value: formatted, color })}
                onMouseLeave={() => setTooltip(null)}
                onFocus={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setTooltip({ ...safeTooltipPosition(rect.left + rect.width / 2, rect.top), title: category, context: String(series.name ?? "Representative index"), value: formatted, color }); }}
                onBlur={() => setTooltip(null)}
              >
                <span className="horizontal-tower" style={{ "--horizontal-width": `${Math.min(100, value / maximum * 100)}%`, "--horizontal-color": color, "--horizontal-delay": `${index * 100}ms` } as CSSProperties}><i /></span>
              </div>
            </div>
          );
        })}
      </div>
      <ChartTooltipPortal tooltip={tooltip} />
    </div>
  );
}

export default function SignalChart({
  option,
  className = "",
  height = "100%",
  ariaLabel = "Interactive data chart",
}: SignalChartProps) {
  const useSkyscraperRenderer = isVerticalBarOption(option);
  const useHorizontalBarRenderer = isHorizontalBarOption(option);
  const useCustomBarRenderer = useSkyscraperRenderer || useHorizontalBarRenderer;
  const useGaugeRenderer = isGaugeOption(option);
  const usePieRenderer = isPieOption(option);
  const useRadialPresentation = isRadialOption(option);
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
    if (!element || !isFirstView || useCustomBarRenderer) return;

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
      }, 16);
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
  }, [isFirstView, reducedMotion, useCustomBarRenderer]);

  useEffect(() => {
    if (!isFirstView || !chartRef.current || useCustomBarRenderer) return;
    const chart = chartRef.current;
    if (hasAnimatedRef.current) chart.setOption(withSignalTheme(option), { notMerge: true });
  }, [isFirstView, option, useCustomBarRenderer]);

  if (useSkyscraperRenderer) {
    return <SkyscraperChart option={option} className={className} height={height} ariaLabel={ariaLabel} />;
  }

  if (useHorizontalBarRenderer) {
    return <HolographicHorizontalBarChart option={option} className={className} height={height} ariaLabel={ariaLabel} />;
  }

  if (useGaugeRenderer) {
    return <HolographicGaugeChart option={option} className={className} height={height} ariaLabel={ariaLabel} />;
  }

  if (usePieRenderer) {
    return <HolographicPieChart option={option} className={className} height={height} ariaLabel={ariaLabel} />;
  }

  return (
    <motion.div
      ref={viewportRef}
      className={`signal-chart${useRadialPresentation ? " radial-hologram-chart" : ""} ${className}`.trim()}
      style={{ height }}
      initial={{ opacity: 0, y: 10 }}
      animate={isFirstView ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="img"
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="signal-chart-canvas" />
      {useRadialPresentation && <span className="radial-hologram-platform" aria-hidden="true" />}
      <span className="signal-chart-corner" aria-hidden="true" />
    </motion.div>
  );
}
