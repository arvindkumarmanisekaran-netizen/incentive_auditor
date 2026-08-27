import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import SignalChart, { SIGNAL_CHART } from "../charts/SignalChart";

interface DynamicPieChartProps<T extends Record<string, unknown>> {
  data: T[];
  dataKey: string;
  nameKey: string;
}

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
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
          `<strong>${params.name ?? "Unknown"}</strong><br/>Share: ${Number(params.percent ?? 0).toFixed(1)}%<br/>Sales: ${formatMoney(params.value ?? 0)}`,
      },
      legend: {
        type: "scroll",
        bottom: 0,
        icon: "circle",
        itemWidth: 7,
        itemHeight: 7,
        textStyle: { color: SIGNAL_CHART.text, fontSize: 9 },
      },
      series: [
        {
          type: "pie",
          radius: ["48%", "74%"],
          center: ["50%", "43%"],
          padAngle: 3,
          minAngle: 4,
          itemStyle: {
            borderColor: "#0a0d0b",
            borderWidth: 3,
            borderRadius: 5,
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
