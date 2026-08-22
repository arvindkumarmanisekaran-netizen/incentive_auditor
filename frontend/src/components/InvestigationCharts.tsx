import { useEffect, useRef, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Finding } from "../types/investigation";

import { AnimateOnView } from "./AnimateOnView";

type Props = {
  findings?: Finding[];
};

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  blue: "#2563EB",
  indigo: "#7C3AED",
  green: "#16A34A",
  red: "#DC2626",
};

const DOCTOR_COLORS = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#F59E0B",
  "#7C3AED",
  "#0891B2",
  "#EA580C",
  "#DB2777",
];

const TERRITORY_COLORS = ["#0891B2", "#F97316", "#4F46E5", "#65A30D", "#E11D48", "#9333EA"];

/* =========================================================
   HELPERS
========================================================= */

function ChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;

  if (!item) {
    return null;
  }

  return (
    <div className="chart-custom-tooltip visible">
      <span>{item.name ?? item.doctor_name ?? item.territory_name ?? "Value"}</span>

      <strong>{formatMoney(Number(item.amount ?? item.sales ?? 0))}</strong>
    </div>
  );
}

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function getFinding(findings: Finding[] = [], type: string) {
  return findings.find((finding) => finding.type === type);
}

function getProductContext(finding?: Finding) {
  if (!finding) {
    return {
      id: "",
      name: "",
    };
  }

  const findingWithProduct = finding as Finding & {
    product_name?: string;
  };

  return {
    id: String(finding.product_id ?? ""),

    name: String(
      findingWithProduct.product_name ??
        finding.evidence?.product_name ??
        finding.evidence?.product ??
        "",
    ),
  };
}

function ProductLabel({ productId, productName }: { productId?: string; productName?: string }) {
  console.log(productId, productName);

  if (!productId && !productName) {
    return null;
  }

  return (
    <div className="chart-product-context">
      {productId && <span className="chart-product-id">{productId}</span>}

      {productId && productName && <span className="chart-product-separator">•</span>}

      {productName && (
        <span className="chart-product-name" title={productName}>
          {productName}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   DYNAMIC PIE CHART
========================================================= */

interface DynamicPieChartProps<T extends Record<string, unknown>> {
  data: T[];
  dataKey: string;
  nameKey: string;
}

function DynamicPieChart<T extends Record<string, unknown>>({
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

  /* -------------------------------------------------------
     Measure chart area
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Measure legend height
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Dynamic pie geometry
  ------------------------------------------------------- */

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
      {/* ================================================
          PIE AREA
      ================================================ */}

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
              />
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

      {/* ================================================
          DYNAMIC LEGEND
      ================================================ */}

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

/* =========================================================
   CUSTOM BAR SHAPE
========================================================= */

interface HoverBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  index?: number;

  payload?: {
    name?: string;
    amount?: number;
    fill?: string;
  };

  activeIndex: number | null;

  onHover: (index: number | null) => void;
}

function HoverBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  index = 0,
  payload,
  activeIndex,
  onHover,
}: HoverBarShapeProps) {
  const active = activeIndex === index;

  return (
    <g
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      style={{
        cursor: "pointer",

        transformBox: "fill-box",

        transformOrigin: "center bottom",

        transition: "transform 160ms ease, filter 160ms ease, opacity 160ms ease",

        transform: active ? "scaleX(1.07) scaleY(1.035)" : "scale(1)",

        filter: active ? "brightness(1.15)" : "none",
      }}
    >
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload?.fill ?? fill ?? "#7C3AED"}
        radius={[8, 8, 0, 0]}
      />
    </g>
  );
}

/* =========================================================
   INVESTIGATION CHARTS
========================================================= */

function InvestigationCharts({ findings = [] }: Props) {
  const [activeSalesBar, setActiveSalesBar] = useState<number | null>(null);

  const [activePayoutBar, setActivePayoutBar] = useState<number | null>(null);

  /* -------------------------------------------------------
     Findings
  ------------------------------------------------------- */

  const salesFinding = getFinding(findings, "sales_deviation");

  const doctorFinding = getFinding(findings, "doctor_concentration");

  const territoryFinding = getFinding(findings, "cross_territory_concentration");

  const payoutFinding = getFinding(findings, "payout_discrepancy");

  /* -------------------------------------------------------
     Product context
  ------------------------------------------------------- */

  const salesProduct = getProductContext(salesFinding);

  const payoutProduct = getProductContext(payoutFinding);

  /* -------------------------------------------------------
     Sales
  ------------------------------------------------------- */

  const salesData = salesFinding
    ? [
        {
          name: "Historical Avg",

          amount: Number(salesFinding.evidence.historical_average) || 0,

          fill: COLORS.blue,
        },

        {
          name: "Current Sales",

          amount: Number(salesFinding.evidence.current_sales) || 0,

          fill: COLORS.indigo,
        },
      ]
    : [];

  /* -------------------------------------------------------
     Doctor
  ------------------------------------------------------- */

  const doctorBreakdown =
    (doctorFinding?.evidence.doctor_breakdown as Array<{
      doctor_id: string;
      doctor_name: string;
      sales: number;
    }>) ?? [];

  const doctorChartData = doctorBreakdown.map((doctor, index) => ({
    ...doctor,

    fill: DOCTOR_COLORS[index % DOCTOR_COLORS.length],
  }));

  /* -------------------------------------------------------
     Territory
  ------------------------------------------------------- */

  const territoryBreakdown =
    (territoryFinding?.evidence.territory_breakdown as Array<{
      territory_id: string;
      territory_name: string;
      sales: number;
    }>) ?? [];

  const territoryChartData = territoryBreakdown.map((territory, index) => ({
    ...territory,

    fill: TERRITORY_COLORS[index % TERRITORY_COLORS.length],
  }));

  /* -------------------------------------------------------
     Payout
  ------------------------------------------------------- */

  const payoutData = payoutFinding
    ? [
        {
          name: "Expected",

          amount: Number(payoutFinding.evidence.expected_payout) || 0,

          fill: COLORS.green,
        },

        {
          name: "Actual",

          amount: Number(payoutFinding.evidence.actual_payout) || 0,

          fill: COLORS.red,
        },
      ]
    : [];

  return (
    <section className="charts-grid">
      {/* ==================================================
          SALES PERFORMANCE
      ================================================== */}

      <div className="chart-card">
        <div className="chart-heading">
          <div>
            <h3>Sales Performance</h3>

            <ProductLabel productId={salesProduct.id} productName={salesProduct.name} />

            <p>Current sales vs historical baseline</p>
          </div>
        </div>

        {salesData.length > 0 ? (
          <div className="chart-container">
            <AnimateOnView>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesData}
                  margin={{
                    top: 15,
                    right: 15,
                    left: 10,
                    bottom: 5,
                  }}
                  onMouseLeave={() => setActiveSalesBar(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />

                  <XAxis dataKey="name" tickLine={false} axisLine={false} />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${Number(value) / 1000}k`}
                  />

                  <Tooltip
                    cursor={{
                      fill: "transparent",
                    }}
                    offset={14}
                    isAnimationActive={false}
                    wrapperStyle={{
                      transition: "none",

                      pointerEvents: "none",
                    }}
                    content={<ChartTooltip />}
                  />

                  <Bar
                    dataKey="amount"
                    maxBarSize={80}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={900}
                    shape={(props) => (
                      <HoverBarShape
                        {...props}
                        activeIndex={activeSalesBar}
                        onHover={setActiveSalesBar}
                      />
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
          </div>
        ) : (
          <p className="chart-empty">No sales comparison available.</p>
        )}
      </div>

      {/* ==================================================
          PAYOUT
      ================================================== */}

      <div className="chart-card">
        <div className="chart-heading">
          <div>
            <h3>Payout Comparison</h3>

            <ProductLabel productId={payoutProduct.id} productName={payoutProduct.name} />

            <p>Expected incentive vs actual payout</p>
          </div>
        </div>

        {payoutData.length > 0 ? (
          <div className="chart-container">
            <AnimateOnView>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={payoutData}
                  margin={{
                    top: 15,
                    right: 15,
                    left: 10,
                    bottom: 5,
                  }}
                  onMouseLeave={() => setActivePayoutBar(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />

                  <XAxis dataKey="name" tickLine={false} axisLine={false} />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${Number(value) / 1000}k`}
                  />

                  <Tooltip
                    cursor={{
                      fill: "transparent",
                    }}
                    offset={14}
                    isAnimationActive={false}
                    wrapperStyle={{
                      transition: "none",

                      pointerEvents: "none",
                    }}
                    content={<ChartTooltip />}
                  />

                  <Bar
                    dataKey="amount"
                    maxBarSize={80}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={900}
                    shape={(props) => (
                      <HoverBarShape
                        {...props}
                        activeIndex={activePayoutBar}
                        onHover={setActivePayoutBar}
                      />
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            </AnimateOnView>
          </div>
        ) : (
          <p className="chart-empty">No payout comparison available.</p>
        )}
      </div>

      {/* ==================================================
          DOCTOR CONCENTRATION
      ================================================== */}

      <div className="chart-card pie-chart-card">
        <div className="chart-heading">
          <div>
            <h3>Doctor Concentration</h3>

            <div className="chart-product-context">
              <span className="chart-product-id">ALL PRODUCTS</span>
            </div>

            <p>Sales contribution by doctor</p>
          </div>
        </div>

        {doctorChartData.length > 0 ? (
          <div className="chart-container pie-chart-container">
            <AnimateOnView>
              <DynamicPieChart data={doctorChartData} dataKey="sales" nameKey="doctor_name" />
            </AnimateOnView>
          </div>
        ) : (
          <p className="chart-empty">No doctor concentration data.</p>
        )}
      </div>

      {/* ==================================================
          TERRITORY DISTRIBUTION
      ================================================== */}

      <div className="chart-card pie-chart-card">
        <div className="chart-heading">
          <div>
            <h3>Territory Distribution</h3>

            <div className="chart-product-context">
              <span className="chart-product-id">ALL PRODUCTS</span>
            </div>

            <p>Attributed sales by selling territory</p>
          </div>
        </div>

        {territoryChartData.length > 0 ? (
          <div className="chart-container pie-chart-container">
            <AnimateOnView>
              <DynamicPieChart data={territoryChartData} dataKey="sales" nameKey="territory_name" />
            </AnimateOnView>
          </div>
        ) : (
          <p className="chart-empty">No territory data available.</p>
        )}
      </div>
    </section>
  );
}

export default InvestigationCharts;
