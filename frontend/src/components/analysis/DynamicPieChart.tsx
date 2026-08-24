import { useEffect, useRef, useState } from "react";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

/* =========================================================
   DYNAMIC PIE CHART
========================================================= */

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
  const chartAreaRef = useRef<HTMLDivElement | null>(null);

  const legendRef = useRef<HTMLDivElement | null>(null);

  const [chartDimensions, setChartDimensions] = useState({
    width: 0,
    height: 0,
  });

  const [legendHeight, setLegendHeight] = useState(0);

  useEffect(() => {
    const element = chartAreaRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;

      setChartDimensions({
        width,
        height,
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const element = legendRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      setLegendHeight(entry.contentRect.height);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [data]);

  const availableDiameter = Math.min(chartDimensions.width, chartDimensions.height);

  const outerRadius = availableDiameter > 0 ? availableDiameter / 2.25 : 0;

  const innerRadius = outerRadius * 0.62;

  const centerX = chartDimensions.width / 2;

  const centerY = chartDimensions.height / 2;

  return (
    <div
      className="dynamic-pie-wrapper"
      style={
        {
          "--pie-legend-height": `${legendHeight}px`,
        } as React.CSSProperties
      }
    >
      <div ref={chartAreaRef} className="dynamic-pie-chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {outerRadius > 0 && (
              <Pie
                data={data}
                dataKey={dataKey}
                nameKey={nameKey}
                cx={centerX}
                cy={centerY}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={3}
                stroke="#FFFFFF"
                strokeWidth={2}
                isAnimationActive
                animationBegin={0}
                animationDuration={900}
              >
                {data.map((item, index) => (
                  <Cell key={`slice-${index}`} fill={String(item.fill ?? "#7C3AED")} />
                ))}
              </Pie>
            )}

            <Tooltip
              offset={14}
              isAnimationActive={false}
              wrapperStyle={{
                transition: "none",
                pointerEvents: "none",
              }}
              formatter={(value) => formatMoney(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div ref={legendRef} className="dynamic-pie-legend">
        {data.map((item, index) => {
          const name = String(item[nameKey] ?? "Unknown");

          const fill = String(item.fill ?? "#7C3AED");

          return (
            <div key={`${name}-${index}`} className="dynamic-pie-legend-item" title={name}>
              <span
                className="dynamic-pie-legend-dot"
                style={{
                  backgroundColor: fill,
                }}
                aria-hidden="true"
              />

              <span className="dynamic-pie-legend-label">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
