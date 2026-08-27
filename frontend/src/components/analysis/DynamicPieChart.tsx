import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import SignalChart, { SIGNAL_CHART } from "../charts/SignalChart";

interface DynamicPieChartProps<T extends Record<string, unknown>> {
  data: T[];
  dataKey: string;
  nameKey: string;
}

function formatExactMoney(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  }).format(Number(value));
}

export function DynamicPieChart<T extends Record<string, unknown>>({
  data,
  dataKey,
  nameKey,
}: DynamicPieChartProps<T>) {
  const option = useMemo<EChartsCoreOption>(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (params: { name?: string; value?: number; percent?: number }) =>
          `<strong>${params.name ?? "Unknown"}</strong><br/>Share: ${String(params.percent ?? 0)}%<br/>Sales: ${formatExactMoney(params.value ?? 0)}`,
      },
      legend: {
        type: "scroll",
        bottom: 4,
        left: "center",
        icon: "circle",
        itemWidth: 9,
        itemHeight: 9,
        itemGap: 12,
        pageIconSize: 11,
        pageIconColor: SIGNAL_CHART.lime,
        pageIconInactiveColor: "#cbd5e1",
        pageTextStyle: {
          color: SIGNAL_CHART.text,
          fontFamily: '"Manrope Variable", Manrope, Inter, sans-serif',
          fontSize: 10,
        },
        textStyle: {
          color: SIGNAL_CHART.text,
          fontFamily: '"Manrope Variable", Manrope, Inter, sans-serif',
          fontSize: 10,
          fontWeight: 600,
        },
      },
      series: [
        {
          type: "pie",
          radius: ["48%", "74%"],
          center: ["50%", "43%"],
          padAngle: 3,
          minAngle: 4,
          itemStyle: {
            borderColor: "transparent",
            borderWidth: 0,
            borderRadius: 4,
          },
          label: { show: false },
          emphasis: {
            scaleSize: 8,
            itemStyle: { shadowBlur: 18, shadowColor: "rgba(37,99,235,.16)" },
          },
          data: data.map((item) => ({
            name: String(item[nameKey] ?? "Unknown"),
            value: Number(item[dataKey] ?? 0),
            itemStyle: { color: String(item.fill ?? SIGNAL_CHART.lime) },
          })),
        },
      ],
    }),
    [data, dataKey, nameKey],
  );

  return <SignalChart option={option} className="dynamic-pie-wrapper" ariaLabel="Distribution chart" />;
}
