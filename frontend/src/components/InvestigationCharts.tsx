import { useEffect, useMemo, useRef, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Finding } from "../types/investigation";

import { AnimateOnView } from "./AnimateOnView";

import { DynamicPieChart } from "./analysis/DynamicPieChart";

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

function getProductFinding(findings: Finding[] = [], type: string, productId: string) {
  return findings.find(
    (finding) => finding.type === type && String(finding.product_id ?? "") === productId,
  );
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

/* =========================================================
   PRODUCT OPTION
========================================================= */

type ProductOption = {
  id: string;
  name: string;
};

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

  const [selectedProductId, setSelectedProductId] = useState("");

  /* =======================================================
     AVAILABLE PRODUCTS
  ======================================================= */

  const productOptions = useMemo<ProductOption[]>(() => {
    const products = new Map<string, ProductOption>();

    findings.forEach((finding) => {
      const context = getProductContext(finding);

      if (!context.id || context.id.toUpperCase() === "ALL") {
        return;
      }

      const existing = products.get(context.id);

      /*
       * First occurrence of
       * the product.
       */
      if (!existing) {
        products.set(context.id, {
          id: context.id,
          name: context.name,
        });

        return;
      }

      /*
       * Another finding may
       * contain the product
       * name even when the
       * first one did not.
       */
      if (!existing.name && context.name) {
        products.set(context.id, {
          ...existing,
          name: context.name,
        });
      }
    });

    return Array.from(products.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [findings]);

  /* =======================================================
     SELECT FIRST PRODUCT AUTOMATICALLY
  ======================================================= */

  useEffect(() => {
    if (productOptions.length === 0) {
      setSelectedProductId("");

      return;
    }

    const selectionExists = productOptions.some((product) => product.id === selectedProductId);

    if (!selectionExists) {
      setSelectedProductId(productOptions[0].id);
    }
  }, [productOptions, selectedProductId]);

  /*
   * Reset hover state when
   * switching products.
   */
  useEffect(() => {
    setActiveSalesBar(null);
    setActivePayoutBar(null);
  }, [selectedProductId]);

  const selectedProduct = productOptions.find((product) => product.id === selectedProductId);

  /* =======================================================
     PRODUCT-SPECIFIC FINDINGS
  ======================================================= */

  const salesFinding = getProductFinding(findings, "sales_deviation", selectedProductId);

  const payoutFinding = getProductFinding(findings, "payout_discrepancy", selectedProductId);

  /* =======================================================
     OVERALL FINDINGS
  ======================================================= */

  const doctorFinding = getFinding(findings, "doctor_concentration");

  /*
   * Keep support for your
   * current finding type while
   * also accepting territory
   * variants if the backend
   * naming changes.
   */
  const territoryFinding =
    getFinding(findings, "cross_territory_concentration") ??
    getFinding(findings, "territory_distribution") ??
    getFinding(findings, "territory_concentration");

  /* =======================================================
     SALES DATA
  ======================================================= */

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

  /* =======================================================
     PAYOUT DATA
  ======================================================= */

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

  /* =======================================================
     DOCTOR DATA
  ======================================================= */

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

  /* =======================================================
     TERRITORY DATA
  ======================================================= */

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

  return (
    <div className="investigation-analytics">
      {/* ==================================================
          PRODUCT ANALYSIS
      ================================================== */}

      <section className="product-analysis-section">
        <div className="analysis-section-header">
          <div className="analysis-section-heading">
            <h2>Product Analysis</h2>

            <p>Sales and payout behaviour for the selected product</p>
          </div>

          <div className="product-analysis-selector">
            <label htmlFor="product-analysis-product">Product</label>

            <select
              id="product-analysis-product"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              disabled={productOptions.length === 0}
            >
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name ? `${product.id} • ${product.name}` : product.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* -----------------------------------------------
            SELECTED PRODUCT CONTEXT
        ----------------------------------------------- */}

        {selectedProduct && (
          <div className="product-analysis-context">
            <span className="product-analysis-id">{selectedProduct.id}</span>

            {selectedProduct.name && (
              <>
                <span className="product-analysis-divider">•</span>

                <span className="product-analysis-name">{selectedProduct.name}</span>
              </>
            )}
          </div>
        )}

        <div className="product-analysis-grid">
          {/* ==============================================
              SALES PERFORMANCE
          ============================================== */}

          <div className="chart-card">
            <div className="chart-heading">
              <div>
                <h3>Sales Performance</h3>

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
              <p className="chart-empty">No sales comparison available for this product.</p>
            )}
          </div>

          {/* ==============================================
              PAYOUT COMPARISON
          ============================================== */}

          <div className="chart-card">
            <div className="chart-heading">
              <div>
                <h3>Payout Comparison</h3>

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
              <p className="chart-empty">No payout comparison available for this product.</p>
            )}
          </div>
        </div>
      </section>

      {/* ==================================================
          OVERALL BEHAVIOUR
      ================================================== */}

      <section className="overall-behaviour-section">
        <div className="analysis-section-header">
          <div className="analysis-section-heading">
            <h2>Overall Behaviour</h2>

            <p>Cross-product doctor and territory behaviour for the investigation period</p>
          </div>

          <span className="overall-scope-badge">ALL PRODUCTS</span>
        </div>

        <div className="overall-behaviour-grid">
          {/* ==============================================
              DOCTOR CONCENTRATION
          ============================================== */}

          <div className="chart-card pie-chart-card">
            <div className="chart-heading">
              <div>
                <h3>Doctor Concentration</h3>

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

          {/* ==============================================
              TERRITORY DISTRIBUTION
          ============================================== */}

          <div className="chart-card pie-chart-card">
            <div className="chart-heading">
              <div>
                <h3>Territory Distribution</h3>

                <p>Attributed sales by selling territory</p>
              </div>
            </div>

            {territoryChartData.length > 0 ? (
              <div className="chart-container pie-chart-container">
                <AnimateOnView>
                  <DynamicPieChart
                    data={territoryChartData}
                    dataKey="sales"
                    nameKey="territory_name"
                  />
                </AnimateOnView>
              </div>
            ) : (
              <p className="chart-empty">No territory data available.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default InvestigationCharts;
